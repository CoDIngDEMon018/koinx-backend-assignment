import express from 'express';
import { getLatestStats, getPriceDeviation } from '../services/cryptoService.js';
import { validateCoin, validatePagination } from '../middleware/validator.js';
import { globalLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply rate limiting to all routes
router.use(globalLimiter);

router.get('/stats', validateCoin, async (req, res, next) => {
  try {
    const { coin } = req.query;
    const stats = await getLatestStats(coin);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get('/deviation', validateCoin, validatePagination, async (req, res, next) => {
  try {
    const { coin } = req.query;
    const deviation = await getPriceDeviation(coin);
    res.json(deviation);
  } catch (error) {
    next(error);
  }
});

export default router; 