import express from 'express';
import mongoose from 'mongoose';
import { natsClient } from '../services/natsService.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const natsStatus = natsClient.isConnected() ? 'connected' : 'disconnected';
    
    const status = mongoStatus === 'connected' && natsStatus === 'connected' ? 'healthy' : 'unhealthy';
    
    const response = {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: mongoStatus,
        nats: natsStatus
      }
    };

    logger.info('Health check', response);
    
    res.status(status === 'healthy' ? 200 : 503).json(response);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/ready', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const natsStatus = natsClient.isConnected() ? 'connected' : 'disconnected';
    
    const isReady = mongoStatus === 'connected' && natsStatus === 'connected';
    
    const response = {
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      services: {
        database: mongoStatus,
        nats: natsStatus
      }
    };

    logger.info('Readiness check', response);
    
    res.status(isReady ? 200 : 503).json(response);
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Readiness check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 