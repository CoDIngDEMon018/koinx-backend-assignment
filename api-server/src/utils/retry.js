import { AppError } from '../middleware/errorHandler.js';
import logger from './logger.js';

export async function withRetry(operation, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED']
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = retryableErrors.some(err => 
        error.code === err || error.message.includes(err)
      );

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      logger.warn(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms`, {
        error: error.message,
        code: error.code
      });

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increase delay for next attempt
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw new AppError(
    `Operation failed after ${maxRetries} retries: ${lastError.message}`,
    502
  );
} 