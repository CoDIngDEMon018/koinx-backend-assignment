import axios from 'axios';
import { CryptoStats } from '../models/CryptoStats.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const SUPPORTED_COINS = ['bitcoin', 'ethereum', 'matic-network'];

async function fetchCryptoData(coinId) {
  try {
    const response = await axios.get(`${COINGECKO_API}/simple/price`, {
      params: {
        ids: coinId,
        vs_currencies: 'usd',
        include_market_cap: true,
        include_24hr_change: true
      },
      timeout: 5000
    });

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
    await CryptoStats.insertMany(stats);
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
    const stats = await CryptoStats.findOne({ coinId })
      .sort({ timestamp: -1 })
      .lean();

    if (!stats) {
      throw new AppError(`No stats found for ${coinId}`, 404);
    }

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
    const stats = await CryptoStats.find({ coinId })
      .sort({ timestamp: -1 })
      .limit(100)
      .select('price')
      .lean();

    if (stats.length === 0) {
      throw new AppError(`No stats found for ${coinId}`, 404);
    }

    const prices = stats.map(stat => stat.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const squareDiffs = prices.map(price => Math.pow(price - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    const standardDeviation = Math.sqrt(avgSquareDiff);

    return {
      deviation: Number(standardDeviation.toFixed(2)),
      sampleSize: prices.length
    };
  } catch (error) {
    logger.error(`Error calculating price deviation for ${coinId}:`, error);
    throw error;
  }
} 