const express = require('express');
const { getLatestStats, getPriceDeviation } = require('../services/cryptoService.js');
const { validateCoin, validatePagination } = require('../middleware/validator.js');
const { globalLimiter } = require('../middleware/rateLimiter.js');

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

module.exports = router; 