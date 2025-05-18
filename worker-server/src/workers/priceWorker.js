// worker-server/src/workers/priceWorker.js
import { logger } from '../config/logger.js';
import { getCoinMetadata, CRYPTO } from '../config/constants.js';
import { publishEvent, getNATSHealth } from '../config/nats.js';
import { fetchCoinGeckoData } from '../services/coingecko.js';
import { storeCryptoStats } from '../services/statsService.js';
import { CacheService } from '../services/cacheService.js';
import { ExponentialBackoff } from '../utils/backoff.js';
import { performance } from 'perf_hooks';

export class PriceWorker {
  constructor() {
    this.state = {
      circuit: 'CLOSED',
      consecutiveFailures: 0,
      metrics: {
        totalCoinsProcessed: 0,
        successfulCoins: 0,
        failedCoins: 0,
        totalDuration: 0
      },
      lastSuccessfulRun: null
    };

    this.backoff = new ExponentialBackoff({
      initialDelay: 1000,
      maxDelay: 30000,
      factor: 2
    });

    this.CONFIG = {
      maxConsecutiveFailures: 5,
      circuitResetTimeout: 60000,
      healthCheckTimeout: 5000,
      maxRetriesPerCoin: 3,
      batchSize: 5
    };

    this.activeOperations = new Set();
    this.shutdownSignal = false;
  }

  async execute() {
    if (this.shutdownSignal || this.state.circuit === 'OPEN') {
      logger.warn('Skipping execution due to shutdown or open circuit');
      return;
    }

    try {
      await this._performHealthChecks();
      const startTime = performance.now();
      
      const results = await this._processCoinBatch();
      await this._handleSuccessfulRun(results, startTime);
      
      return results;
    } catch (error) {
      await this._handleExecutionError(error);
      throw error;
    }
  }

  async _processCoinBatch() {
    const results = {
      processedCoins: [],
      failedCoins: [],
      duration: 0
    };

    const startTime = performance.now();
    
    // Process coins in batches for better resource management
    const coinQueue = [...CRYPTO.SUPPORTED_COINS];
    while (coinQueue.length > 0) {
      const batch = coinQueue.splice(0, this.CONFIG.batchSize);
      await Promise.all(batch.map(coinId => this._processSingleCoin(coinId, results)));
    }

    await this._postProcessRun(results);
    results.duration = performance.now() - startTime;
    
    return results;
  }

  async _processSingleCoin(coinId, results) {
    const operationId = Symbol();
    this.activeOperations.add(operationId);

    try {
      const data = await this.backoff.retry(
        () => this._fetchAndProcessCoin(coinId),
        this.CONFIG.maxRetriesPerCoin
      );

      await this._storeAndPublish(data);
      results.processedCoins.push(coinId);
      this.state.metrics.successfulCoins++;
    } catch (error) {
      results.failedCoins.push(coinId);
      this.state.metrics.failedCoins++;
      logger.error('Coin processing failed', this._errorContext(coinId, error));
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  async _fetchAndProcessCoin(coinId) {
    const metadata = getCoinMetadata(coinId);
    if (!metadata) throw new Error(`Invalid coin ID: ${coinId}`);

    const rawData = await fetchCoinGeckoData(metadata.coinGeckoId);
    return this._transformData(coinId, rawData);
  }

  _transformData(coinId, rawData) {
    return {
      coinId,
      price: rawData.current_price,
      marketCap: rawData.market_cap,
      change24h: rawData.price_change_percentage_24h,
      timestamp: new Date(),
      source: 'CoinGecko',
      volatility: Math.abs(rawData.price_change_percentage_24h)
    };
  }

  async _storeAndPublish(data) {
    const storePromise = storeCryptoStats(data);
    const publishPromise = publishEvent('crypto.update', {
      coin: data.coinId,
      price: data.price,
      timestamp: data.timestamp.toISOString(),
      volatility: data.volatility
    });

    await Promise.all([storePromise, publishPromise]);
  }

  async _postProcessRun(results) {
    await this._invalidateCache();
    await this._emitMetrics(results);
    
    logger.info('Batch processing completed', {
      successful: results.processedCoins.length,
      failed: results.failedCoins.length,
      duration: results.duration
    });
  }

  async _performHealthChecks() {
  const checks = {
    nats: getNATSHealth().connected,
    cache: CacheService.isConnected(),
    database: await DatabaseService.isConnected() // <-- Add this line
  };

  if (!Object.values(checks).every(Boolean)) {
    throw new Error('Health check failed for services: ' +
      Object.entries(checks).filter(([, status]) => !status).map(([service]) => service).join(', '));
  }
}

  async _handleSuccessfulRun(results, startTime) {
    this.backoff.reset();
    this.state.consecutiveFailures = 0;
    this.state.lastSuccessfulRun = new Date();
    
    this.state.metrics = {
      ...this.state.metrics,
      totalCoinsProcessed: this.state.metrics.totalCoinsProcessed + results.processedCoins.length,
      totalDuration: this.state.metrics.totalDuration + (performance.now() - startTime)
    };

    await publishEvent('worker.metrics', this._metricsPayload('success', results));
  }

  async _handleExecutionError(error) {
    this.state.consecutiveFailures++;
    this.backoff.next();

    logger.error('Execution failed', this._errorContext(null, error));
    await publishEvent('worker.metrics', this._metricsPayload('error', null, error));

    if (this.state.consecutiveFailures >= this.CONFIG.maxConsecutiveFailures) {
      await this._triggerCircuitBreaker();
    }
  }

  async _triggerCircuitBreaker() {
    this.state.circuit = 'OPEN';
    logger.warn('Circuit breaker activated');
    
    await publishEvent('worker.metrics', this._metricsPayload('circuit_opened'));
    
    setTimeout(() => {
      this.state.circuit = 'HALF_OPEN';
      logger.info('Circuit breaker reset to half-open state');
    }, this.CONFIG.circuitResetTimeout);
  }

  async _invalidateCache() {
    try {
      await CacheService.invalidate('stats:*');
      logger.debug('Cache invalidation successful');
    } catch (error) {
      logger.error('Cache invalidation failed', this._errorContext(null, error));
    }
  }

  _metricsPayload(eventType, results, error = null) {
    return {
      event: eventType,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      metrics: this.state.metrics,
      ...(results && { processed: results.processedCoins.length }),
      ...(error && { error: error.message }),
      circuitState: this.state.circuit,
      consecutiveFailures: this.state.consecutiveFailures
    };
  }

  _errorContext(coinId, error) {
    return {
      ...(coinId && { coinId }),
      error: error.message,
      stack: error.stack,
      retryCount: this.backoff.attempts,
      circuitState: this.state.circuit
    };
  }

  async gracefulShutdown() {
    this.shutdownSignal = true;
    logger.info('Initiating graceful shutdown...');

    // Wait for active operations to complete
    while (this.activeOperations.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
      logger.debug(`Waiting for ${this.activeOperations.size} operations...`);
    }

    await this._cleanupResources();
    logger.info('Shutdown completed');
    process.exit(0);
  }

  async _cleanupResources() {
    try {
      await CacheService.close();
      // Add other resource cleanup as needed
    } catch (error) {
      logger.error('Resource cleanup failed', this._errorContext(null, error));
    }
  }
}

// Process signal handlers
const worker = new PriceWorker();

process
  .on('SIGTERM', () => worker.gracefulShutdown())
  .on('SIGINT', () => worker.gracefulShutdown())
  .on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
    worker.gracefulShutdown();
  })
  .on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    worker.gracefulShutdown();
  });