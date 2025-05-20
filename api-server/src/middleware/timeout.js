import { AppError } from './errorHandler.js';

export const timeout = (timeoutMs = 5000) => {
  return (req, res, next) => {
    const timeoutId = setTimeout(() => {
      next(new AppError('Request timeout', 408));
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeoutId);
    });

    next();
  };
}; 