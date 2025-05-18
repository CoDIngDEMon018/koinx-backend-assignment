// api-server/src/controllers/statsController.js
import { getLatestStats, calculatePriceDeviation } from '../services/statsService.js';
import { logger } from '../config/logger.js';
import { ERRORS, CACHE, API } from '../config/constants.js';
import { redisClient } from '../config/redis.js';

// Cache TTL based on coin volatility
const CACHE_TTL = {
  HIGH_VOLATILITY: 60,    // 1 minute
  NORMAL: 300             // 5 minutes
};

export const getStats = async (req, res) => {
  const { coin } = req.validatedCoin;
  const cacheKey = CACHE.KEYS.COIN_STATS(coin.id);
  
  try {
    // Check cache first
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      logger.debug('Serving cached stats', { coin: coin.id });
      return res
        .set('Cache-Control', `public, max-age=${CACHE_TTL.NORMAL}`)
        .json(JSON.parse(cachedData));
    }

    // Fetch fresh data
    const stats = await getLatestStats(coin.id);
    
    // Calculate volatility-based TTL
    const ttl = Math.abs(stats.change24h) > 5 ? 
      CACHE_TTL.HIGH_VOLATILITY : 
      CACHE_TTL.NORMAL;

    // Prepare response
    const response = {
      data: {
        price: formatCurrency(stats.price),
        marketCap: formatLargeNumber(stats.marketCap),
        change24h: stats.change24h.toFixed(2) + '%',
        currency: API.DEFAULTS.FIAT_CURRENCY,
        coin: coin.metadata
      },
      meta: {
        updatedAt: new Date().toISOString(),
        source: 'CoinGecko API',
        cacheStatus: 'miss'
      }
    };

    // Cache the response
    await redisClient.set(cacheKey, JSON.stringify(response), 'EX', ttl);

    res
      .set({
        'Cache-Control': `public, max-age=${ttl}`,
        'X-API-Version': API.VERSION,
        'Content-Security-Policy': "default-src 'self'"
      })
      .json(response);

  } catch (error) {
    logger.error('Stats controller failed', {
      coin: coin.id,
      error: error.message,
      stack: error.stack
    });

    const statusCode = error.message.includes('not found') ? 404 : 500;
    
    res.status(statusCode).json({
      error: statusCode === 404 ? 
        ERRORS.MESSAGES.DATA_NOT_FOUND : 
        ERRORS.MESSAGES.SERVER_ERROR,
      code: statusCode === 404 ? 
        ERRORS.CODES.NOT_FOUND : 
        ERRORS.CODES.SERVER_ERROR,
      details: {
        coin: coin.id,
        attemptedAction: 'fetch statistics'
      },
      links: {
        documentation: API.DOCUMENTATION_URL,
        support: API.SUPPORT_CONTACT
      }
    });
  }
};

// Helper functions
const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: API.DEFAULTS.FIAT_CURRENCY,
    maximumFractionDigits: 2
  }).format(value);
};

const formatLargeNumber = (num) => {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1
  }).format(num);
};