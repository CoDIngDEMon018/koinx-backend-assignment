import axios from 'axios';
import { CryptoStats } from '../models/CryptoStats.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { withRetry } from '../utils/retry.js';
import { metrics } from '../utils/metrics.js';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const SUPPORTED_COINS = ['bitcoin', 'ethereum', 'matic-network'];

async function fetchCryptoData(coinId) {
  const startTime = Date.now();
  try {
    const response = await withRetry(
      () => axios.get(`${COINGECKO_API}/simple/price`, {
        params: {
          ids: coinId,
          vs_currencies: 'usd',
          include_market_cap: true,
          include_24hr_change: true
        },
        timeout: 5000
      }),
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 5000
      }
    );

    // Record API latency
    metrics.coingeckoApiLatency
      .labels({ coin_id: coinId })
      .observe((Date.now() - startTime) / 1000);

    if (!response.data || !response.data[coinId]) {
      throw new AppError(`No data available for ${coinId}`, 404);
    }

    const coinData = response.data[coinId];
    if (!coinData.usd || !coinData.usd_market_cap || coinData.usd_24h_change === undefined) {
      throw new AppError(`Incomplete data for ${coinId}`, 502);
    }

    return {
      coinId,
      price: coinData.usd,
      marketCap: coinData.usd_market_cap,
      change24h: coinData.usd_24h_change
    };
  } catch (error) {
    // Record API errors
    metrics.coingeckoApiErrors
      .labels({ 
        coin_id: coinId,
        error_type: error.response?.status || 'unknown'
      })
      .inc();

    if (error.response) {
      logger.error('CoinGecko API error:', {
        status: error.response.status,
        data: error.response.data,
        coinId
      });
      throw new AppError(`Error fetching data for ${coinId}`, 502);
    }
    throw error;
  }
}

export async function storeCryptoStats() {
  try {
    const stats = [];
    const errors = [];

    // Fetch data for each coin in parallel
    await Promise.all(
      SUPPORTED_COINS.map(async (coinId) => {
        try {
          const data = await fetchCryptoData(coinId);
          stats.push(data);
        } catch (error) {
          errors.push({ coinId, error: error.message });
          logger.error(`Error processing ${coinId}:`, error);
        }
      })
    );

    if (stats.length === 0) {
      throw new AppError('Failed to process any coin data', 502);
    }

    // Store successful results
    const startTime = Date.now();
    await CryptoStats.insertMany(stats);
    
    // Record DB operation latency
    metrics.dbOperationLatency
      .labels({ 
        operation: 'insertMany',
        collection: 'cryptoStats'
      })
      .observe((Date.now() - startTime) / 1000);

    logger.info('Successfully stored crypto stats', { 
      successCount: stats.length,
      errorCount: errors.length
    });

    return { stats, errors };
  } catch (error) {
    logger.error('Error storing crypto stats:', error);
    throw error;
  }
}

export async function getLatestStats(coinId) {
  try {
    const startTime = Date.now();
    const stats = await CryptoStats.findOne({ coinId })
      .sort({ timestamp: -1 })
      .lean();

    // Record DB operation latency
    metrics.dbOperationLatency
      .labels({ 
        operation: 'findOne',
        collection: 'cryptoStats'
      })
      .observe((Date.now() - startTime) / 1000);

    if (!stats) {
      throw new AppError(`No stats found for ${coinId}`, 404);
    }

    // Record stats calculation
    metrics.statsCalculated
      .labels({ 
        coin_id: coinId,
        type: 'latest'
      })
      .inc();

    return {
      price: stats.price,
      marketCap: stats.marketCap,
      '24hChange': stats.change24h
    };
  } catch (error) {
    logger.error(`Error getting latest stats for ${coinId}:`, error);
    throw error;
  }
}

export async function getPriceDeviation(coinId) {
  try {
    const startTime = Date.now();
    const stats = await CryptoStats.find({ coinId })
      .sort({ timestamp: -1 })
      .limit(100)
      .select('price')
      .lean();

    // Record DB operation latency
    metrics.dbOperationLatency
      .labels({ 
        operation: 'find',
        collection: 'cryptoStats'
      })
      .observe((Date.now() - startTime) / 1000);

    if (stats.length === 0) {
      throw new AppError(`No stats found for ${coinId}`, 404);
    }

    const prices = stats.map(stat => stat.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const squareDiffs = prices.map(price => Math.pow(price - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    const standardDeviation = Math.sqrt(avgSquareDiff);

    // Record deviation calculation
    metrics.deviationCalculated
      .labels({ coin_id: coinId })
      .inc();

    return {
      deviation: Number(standardDeviation.toFixed(2)),
      sampleSize: prices.length
    };
  } catch (error) {
    logger.error(`Error calculating price deviation for ${coinId}:`, error);
    throw error;
  }
} 