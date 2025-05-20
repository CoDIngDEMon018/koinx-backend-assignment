import express from 'express';
import mongoose from 'mongoose';
import { connect } from 'nats';

const router = express.Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date(),
    services: {
      database: mongoose.connection.readyState === 1 ? 'OK' : 'ERROR',
      nats: global.natsConnection?.connected ? 'OK' : 'ERROR'
    }
  };

  const isHealthy = Object.values(health.services).every(status => status === 'OK');
  res.status(isHealthy ? 200 : 503).json(health);
});

router.get('/ready', async (req, res) => {
  const ready = {
    status: 'OK',
    timestamp: new Date(),
    services: {
      database: mongoose.connection.readyState === 1 ? 'OK' : 'ERROR',
      nats: global.natsConnection?.connected ? 'OK' : 'ERROR'
    }
  };

  const isReady = Object.values(ready.services).every(status => status === 'OK');
  res.status(isReady ? 200 : 503).json(ready);
});

export default router; 