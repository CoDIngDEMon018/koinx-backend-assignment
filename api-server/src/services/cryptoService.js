const axios = require('axios');
const { CryptoStats } = require('../models/CryptoStats');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const { withRetry } = require('../utils/retry');
const { metrics } = require('../../test/setup');

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const COINS = ['bitcoin', 'ethereum', 'matic-network'];

const fetchCoinPrice = async (coinId) => {
  try {
    const response = await axios.get(`${COINGECKO_API}/simple/price`, {
      params: {
        ids: coinId,
        vs_currencies: 'usd'
      },
      headers: {
        'x-cg-pro-api-key': process.env.COINGECKO_API_KEY
      }
    });

    return response.data[coinId]?.usd;
  } catch (error) {
    metrics.coingeckoApiErrors.labels({ coin: coinId }).inc();
    throw error;
  }
};

const storeCryptoStats = async () => {
  const stats = [];
  const errors = [];

  try {
    const results = await Promise.all(
      COINS.map(async (coinId) => {
        try {
          const price = await withRetry(() => fetchCoinPrice(coinId));
          if (price) {
            const stat = await CryptoStats.create({
              coinId,
              price,
              timestamp: new Date()
            });
            stats.push(stat);
            metrics.statsCalculated.labels({ coin: coinId }).inc();
          }
        } catch (error) {
          logger.error(`Error processing ${coinId}:`, error);
          errors.push({ coin: coinId, error: error.message });
        }
      })
    );

    if (stats.length === 0) {
      throw new AppError('Failed to process any coin data', 502);
    }

    return { stats, errors };
  } catch (error) {
    logger.error('Error storing crypto stats:', error);
    throw error;
  }
};

const getLatestStats = async (coinId) => {
  try {
    const startTime = Date.now();
    const stats = await CryptoStats.findOne({ coinId })
      .sort({ timestamp: -1 })
      .lean();

    metrics.dbOperationLatency
      .labels({ 
        operation: 'findOne',
        collection: 'cryptoStats'
      })
      .observe(Date.now() - startTime);

    if (!stats) {
      throw new AppError(`No stats found for ${coinId}`, 404);
    }

    return stats;
  } catch (error) {
    logger.error(`Error getting latest stats for ${coinId}:`, error);
    throw error;
  }
};

const getPriceDeviation = async (coinId) => {
  try {
    const startTime = Date.now();
    const stats = await CryptoStats.find({ coinId })
      .sort({ timestamp: -1 })
      .limit(100)
      .select('price')
      .lean();

    metrics.dbOperationLatency
      .labels({ 
        operation: 'find',
        collection: 'cryptoStats'
      })
      .observe(Date.now() - startTime);

    if (stats.length === 0) {
      throw new AppError(`No data available for ${coinId}`, 404);
    }

    const prices = stats.map(s => s.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
    const deviation = Math.sqrt(variance);

    metrics.deviationCalculated.labels({ coin: coinId }).inc();

    return {
      deviation,
      sampleSize: prices.length
    };
  } catch (error) {
    logger.error(`Error calculating price deviation for ${coinId}:`, error);
    throw error;
  }
};

module.exports = {
  storeCryptoStats,
  getLatestStats,
  getPriceDeviation
}; 