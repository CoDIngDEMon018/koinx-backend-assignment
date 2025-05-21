import { CryptoStats } from '../models/CryptoStats.js';
import logger from '../config/logger.js';

export async function storeCryptoStats(stats) {
  try {
    await CryptoStats.insertMany(stats);
    logger.info('Successfully stored crypto stats');
  } catch (error) {
    logger.error('Error storing crypto stats:', error);
    throw error;
  }
} 