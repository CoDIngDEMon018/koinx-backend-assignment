import { Router } from 'express';
import mongoose from 'mongoose';
import os from 'os';
import process from 'process';
import axios from 'axios';
import { nc, getNATSStatus } from '../config/nats.js';
import { logger } from '../config/logger.js';
import packageJson from '../../package.json' assert { type: 'json' };

const router = Router();
const MB = 1024 * 1024;

// Cache health check results for 5 seconds
let cachedStatus = null;
let lastChecked = 0;

const serviceCheck = async (name, checkFn) => {
  const start = Date.now();
  try {
    const result = await checkFn();
    return {
      name,
      status: 'healthy',
      latency: Date.now() - start,
      details: result
    };
  } catch (error) {
    logger.warn(`Health check failed: ${name}`, error);
    return {
      name,
      status: 'unhealthy',
      latency: Date.now() - start,
      error: error.message,
      code: error.code
    };
  }
};

const systemChecks = {
  database: () => mongoose.connection.readyState === 1 ? 
    { version: mongoose.version, collections: Object.keys(mongoose.connection.collections) } : 
    Promise.reject(new Error('Database disconnected')),
  
  nats: async () => {
    const status = getNATSStatus();
    return status.connected ? 
      { version: nc.info?.version, pending: status.pendingMessages } : 
      Promise.reject(new Error('NATS disconnected'));
  },

  coingecko: async () => {
    const response = await axios.head(`${process.env.COINGECKO_API_BASE}/ping`);
    return response.status === 200 ? 
      { latency: response.duration } : 
      Promise.reject(new Error('CoinGecko unavailable'));
  },

  memory: () => ({
    usage: process.memoryUsage(),
    system: {
      free: os.freemem() / MB,
      total: os.totalmem() / MB
    }
  }),

  storage: () => ({
    disks: os.cpus().map(() => ({
      free: os.freemem() / MB,
      total: os.totalmem() / MB
    }))
  })
};

router.get('/deep', async (req, res) => {
  // Cache with 5-second freshness
  if (Date.now() - lastChecked < 5000) {
    return res.json(cachedStatus);
  }

  const checks = await Promise.allSettled(
    Object.entries(systemChecks).map(([name, check]) => 
      serviceCheck(name, check)
    )
  );

  const checkResults = checks.reduce((acc, curr) => {
    acc[curr.value.name] = curr.value;
    return acc;
  }, {});

  const allHealthy = Object.values(checkResults)
    .every(check => check.status === 'healthy');

  const status = {
    status: allHealthy ? 'healthy' : 'degraded',
    version: packageJson.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    system: {
      node: process.version,
      platform: process.platform,
      memory: {
        rss: process.memoryUsage().rss / MB,
        heapTotal: process.memoryUsage().heapTotal / MB,
        heapUsed: process.memoryUsage().heapUsed / MB
      }
    },
    checks: checkResults,
    links: {
      documentation: 'https://api.example.com/health',
      statusPage: 'https://status.example.com'
    }
  };

  cachedStatus = status;
  lastChecked = Date.now();

  res
    .set('Cache-Control', 'no-store')
    .status(allHealthy ? 200 : 503)
    .json(status);
});

// Basic liveness probe
router.get('/live', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Readiness check
router.get('/ready', async (req, res) => {
  const ready = mongoose.connection.readyState === 1 && nc.isConnected();
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    database: mongoose.connection.readyState === 1,
    nats: nc.isConnected()
  });
});

export default router;