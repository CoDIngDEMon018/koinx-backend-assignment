import express from 'express';
import { getLatestStats, getPriceDeviation } from '../services/cryptoService.js';

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const { coin } = req.query;
    if (!coin) {
      return res.status(400).json({ error: 'Coin parameter is required' });
    }

    const stats = await getLatestStats(coin);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/deviation', async (req, res) => {
  try {
    const { coin } = req.query;
    if (!coin) {
      return res.status(400).json({ error: 'Coin parameter is required' });
    }

    const deviation = await getPriceDeviation(coin);
    res.json(deviation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 