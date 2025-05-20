import rateLimit from 'express-rate-limit';
import { AppError } from './errorHandler.js';

export const createRateLimiter = (windowMs, max) => {
  return rateLimit({
    windowMs: windowMs || 15 * 60 * 1000, // 15 minutes
    max: max || 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    handler: (req, res, next, options) => {
      next(new AppError(options.message, 429));
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });
};

// Different rate limiters for different routes
export const globalLimiter = createRateLimiter();
export const strictLimiter = createRateLimiter(60 * 1000, 10); // 10 requests per minute 