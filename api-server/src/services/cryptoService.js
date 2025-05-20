import axios from 'axios';
import { CryptoStats } from '../models/CryptoStats.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const SUPPORTED_COINS = ['bitcoin', 'ethereum', 'matic-network'];

function validateCoinGeckoResponse(data, coinId) {
  if (!data || !data[coinId]) {
    throw new AppError(`No data available for ${coinId}`, 404);
  }

  const coinData = data[coinId];
  if (!coinData.usd || !coinData.usd_market_cap || coinData.usd_24h_change === undefined) {
    throw new AppError(`Incomplete data for ${coinId}`, 502);
  }

  return coinData;
}

export async function storeCryptoStats() {
  try {
    const response = await axios.get(`${COINGECKO_API}/simple/price`, {
      params: {
        ids: SUPPORTED_COINS.join(','),
        vs_currencies: 'usd',
        include_market_cap: true,
        include_24hr_change: true
      },
      timeout: 5000 // 5 second timeout
    });

    const stats = [];
    for (const coinId of SUPPORTED_COINS) {
      try {
        const coinData = validateCoinGeckoResponse(response.data, coinId);
        stats.push({
          coinId,
          price: coinData.usd,
          marketCap: coinData.usd_market_cap,
          change24h: coinData.usd_24h_change
        });
      } catch (error) {
        logger.error(`Error processing data for ${coinId}:`, error);
        // Continue with other coins even if one fails
        continue;
      }
    }

    if (stats.length === 0) {
      throw new AppError('Failed to process any coin data', 502);
    }

    await CryptoStats.insertMany(stats);
    logger.info('Successfully stored crypto stats');
    return stats;
  } catch (error) {
    if (error.response) {
      // CoinGecko API error
      logger.error('CoinGecko API error:', {
        status: error.response.status,
        data: error.response.data
      });
      throw new AppError('Error fetching data from CoinGecko', 502);
    }
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
      deviation: Number(standardDeviation.toFixed(2))
    };
  } catch (error) {
    logger.error(`Error calculating price deviation for ${coinId}:`, error);
    throw error;
  }
} 