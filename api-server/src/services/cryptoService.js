import axios from 'axios';
import { CryptoStats } from '../models/CryptoStats.js';
import logger from '../utils/logger.js';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const SUPPORTED_COINS = ['bitcoin', 'ethereum', 'matic-network'];

export async function storeCryptoStats() {
  try {
    const response = await axios.get(`${COINGECKO_API}/simple/price`, {
      params: {
        ids: SUPPORTED_COINS.join(','),
        vs_currencies: 'usd',
        include_market_cap: true,
        include_24hr_change: true
      }
    });

    const stats = [];
    for (const coinId of SUPPORTED_COINS) {
      const coinData = response.data[coinId];
      if (coinData) {
        stats.push({
          coinId,
          price: coinData.usd,
          marketCap: coinData.usd_market_cap,
          change24h: coinData.usd_24h_change
        });
      }
    }

    await CryptoStats.insertMany(stats);
    logger.info('Successfully stored crypto stats');
    return stats;
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
      throw new Error(`No stats found for ${coinId}`);
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
      throw new Error(`No stats found for ${coinId}`);
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