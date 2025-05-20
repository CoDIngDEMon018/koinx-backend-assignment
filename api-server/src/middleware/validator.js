import { AppError } from './errorHandler.js';

const SUPPORTED_COINS = ['bitcoin', 'ethereum', 'matic-network'];

export const validateCoin = (req, res, next) => {
  const { coin } = req.query;
  
  if (!coin) {
    return next(new AppError('Coin parameter is required', 400));
  }

  if (!SUPPORTED_COINS.includes(coin)) {
    return next(new AppError(
      `Invalid coin. Supported coins: ${SUPPORTED_COINS.join(', ')}`,
      400
    ));
  }

  next();
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