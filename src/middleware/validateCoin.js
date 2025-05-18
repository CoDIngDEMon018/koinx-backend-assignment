import { logger } from '../config/logger.js';
import { isValidCoin, getCoinMetadata, ERRORS } from '../config/constants.js';
import { rateLimiter } from './rateLimiter.js';

// Cache for 1 hour when listing coins
const CACHE_TTL = 3600;

/**
 * Coin parameter validation middleware
 * @middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {Object|void} Error response or continues to next middleware
 */
export const validateCoin = (req, res, next) => {
  const { coin } = req.query;
  
  // Rate limit failed validation attempts
  rateLimiter(req, res, () => {
    // Check parameter existence
    if (!coin || typeof coin !== 'string') {
      logger.warn('Missing coin parameter', {
        path: req.path,
        ip: req.ip,
        query: req.query
      });
      
      return res.status(400).json({
        error: ERRORS.MESSAGES.MISSING_PARAM,
        code: ERRORS.CODES.MISSING_PARAM,
        details: {
          parameter: 'coin',
          expected_format: 'string',
          example: '?coin=bitcoin'
        },
        documentation: 'https://api.example.com/docs/assets'
      });
    }

    // Sanitize and validate
    const sanitizedCoin = coin.trim().toLowerCase();
    
    if (!isValidCoin(sanitizedCoin)) {
      logger.warn('Invalid coin request', { 
        received: coin,
        sanitized: sanitizedCoin,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(400).json({
        error: ERRORS.MESSAGES.INVALID_INPUT,
        code: ERRORS.CODES.INVALID_COIN,
        supported_coins: Array.from(SUPPORTED_COINS),
        metadata: getCoinMetadata(sanitizedCoin) || 'Unknown cryptocurrency',
        details: {
          received: coin,
          validation: 'Must be one of supported cryptocurrencies'
        },
        links: {
          documentation: 'https://api.example.com/docs/assets',
          supported_coins_endpoint: '/api/assets'
        }
      });
    }

    // Add validated coin to request context
    req.validatedCoin = {
      id: sanitizedCoin,
      ...getCoinMetadata(sanitizedCoin)
    };

    next();
  });
};

/**
 * Endpoint to list supported cryptocurrencies
 * @route GET /api/assets
 */
export const listSupportedCoins = (req, res) => {
  res
    .set('Cache-Control', `public, max-age=${CACHE_TTL}`)
    .json({
      data: Array.from(SUPPORTED_COINS).map(coin => getCoinMetadata(coin)),
      last_updated: new Date().toISOString(),
      source: 'CoinGecko API v3'
    });
};