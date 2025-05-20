import { connect } from 'nats';
import { validateEnv } from './config/env.js';
import { metrics } from './utils/metrics.js';
import logger from './utils/logger.js';
import { storeCryptoStats } from './services/cryptoService.js';

// Validate environment variables
validateEnv();

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async function connectToNats() {
  try {
    const natsClient = await connect({
      url: process.env.NATS_URL,
      reconnect: true,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2000
    });

    logger.info('Connected to NATS server');
    metrics.activeConnections.labels({ type: 'nats' }).inc();

    natsClient.on('error', (err) => {
      logger.error('NATS connection error', { error: err.message });
      metrics.activeConnections.labels({ type: 'nats' }).dec();
    });

    natsClient.on('close', () => {
      logger.warn('NATS connection closed');
      metrics.activeConnections.labels({ type: 'nats' }).dec();
    });

    return natsClient;
  } catch (error) {
    logger.error('Failed to connect to NATS', { error: error.message });
    throw error;
  }
}

async function publishUpdateEvent(natsClient) {
  try {
    const startTime = process.hrtime();
    const result = await storeCryptoStats();
    
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    metrics.externalApiDuration
      .labels({ service: 'coingecko', endpoint: 'prices' })
      .observe(duration);

    if (result.stats.length > 0) {
      await natsClient.publish('crypto.stats.updated', JSON.stringify(result));
      metrics.natsMessagesPublished.labels({ subject: 'crypto.stats.updated' }).inc();
      logger.info('Published crypto stats update', { 
        statsCount: result.stats.length,
        errorCount: result.errors.length
      });
    }
  } catch (error) {
    logger.error('Error publishing update event', { error: error.message });
    metrics.externalApiErrors
      .labels({ 
        service: 'coingecko',
        endpoint: 'prices',
        status_code: error.response?.status || 'unknown'
      })
      .inc();
  }
}

async function startWorker() {
  try {
    const natsClient = await connectToNats();
    
    // Schedule job
    const schedule = process.env.CRON_SCHEDULE || '*/15 * * * *';
    logger.info(`Scheduling crypto stats update job: ${schedule}`);

    setInterval(async () => {
      await publishUpdateEvent(natsClient);
    }, 15 * 60 * 1000); // 15 minutes

    // Handle process termination
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM signal');
      await natsClient.drain();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT signal');
      await natsClient.drain();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Worker startup failed', { error: error.message });
    process.exit(1);
  }
}

startWorker(); 