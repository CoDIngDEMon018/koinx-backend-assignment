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

export const validatePagination = (req, res, next) => {
  const { limit = '100', page = '1' } = req.query;
  
  const parsedLimit = parseInt(limit, 10);
  const parsedPage = parseInt(page, 10);

  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return next(new AppError('Limit must be between 1 and 100', 400));
  }

  if (isNaN(parsedPage) || parsedPage < 1) {
    return next(new AppError('Page must be greater than 0', 400));
  }

  req.query.limit = parsedLimit;
  req.query.page = parsedPage;
  next();
}; 