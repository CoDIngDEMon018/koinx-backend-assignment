import { AppError } from './errorHandler.js';

const SUPPORTED_COINS = ['bitcoin', 'ethereum', 'matic-network'];

export const validateRequest = (req, res, next) => {
  try {
    // Validate coin parameter for /stats and /deviation endpoints
    if (req.path === '/stats' || req.path === '/deviation') {
      const { coin } = req.query;
      
      if (!coin) {
        throw new AppError('Coin parameter is required', 400);
      }

      if (!SUPPORTED_COINS.includes(coin.toLowerCase())) {
        throw new AppError(
          `Invalid coin. Supported coins are: ${SUPPORTED_COINS.join(', ')}`,
          400
        );
      }

      // Normalize coin parameter
      req.query.coin = coin.toLowerCase();
    }

    // Validate request headers
    const contentType = req.get('Content-Type');
    if (req.method === 'POST' && contentType !== 'application/json') {
      throw new AppError('Content-Type must be application/json', 415);
    }

    // Validate request body for POST requests
    if (req.method === 'POST' && Object.keys(req.body).length === 0) {
      throw new AppError('Request body cannot be empty', 400);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const validateCoin = (req, res, next) => {
  const { coin } = req.query;
  
  if (!coin) {
    throw new AppError('Coin parameter is required', 400);
  }

  const validCoins = ['bitcoin', 'ethereum', 'matic-network'];
  if (!validCoins.includes(coin.toLowerCase())) {
    throw new AppError(`Invalid coin. Supported coins are: ${validCoins.join(', ')}`, 400);
  }

  next();
};

export const validatePagination = (req, res, next) => {
  const { limit = '100', offset = '0' } = req.query;
  
  const limitNum = parseInt(limit);
  const offsetNum = parseInt(offset);

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
    throw new AppError('Limit must be a number between 1 and 1000', 400);
  }

  if (isNaN(offsetNum) || offsetNum < 0) {
    throw new AppError('Offset must be a non-negative number', 400);
  }

  // Add validated values to request for use in route handlers
  req.pagination = {
    limit: limitNum,
    offset: offsetNum
  };

  next();
}; 