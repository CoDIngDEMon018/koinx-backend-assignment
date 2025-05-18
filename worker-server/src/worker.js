// worker-server/src/worker.js
import { CryptoUpdateScheduler } from './services/scheduler.js';
import { initNATS, closeNATS, getNatsStatus } from './config/nats.js';
import { logger } from './config/logger.js';
import http from 'http';
import process from 'process';

// Configuration constants
const HEALTH_CHECK_PORT = process.env.HEALTH_PORT || 3001;
const SHUTDOWN_TIMEOUT = 10000; // 10 seconds

const scheduler = new CryptoUpdateScheduler();
let isShuttingDown = false;

// Create health check server
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'OK',
      uptime: process.uptime(),
      scheduler: scheduler.getStatus(),
      nats: getNatsStatus(),
      memory: process.memoryUsage(),
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const startHealthServer = () => {
  healthServer.listen(HEALTH_CHECK_PORT, () => {
    logger.info(`Health check server running on port ${HEALTH_CHECK_PORT}`);
  });
};

// Validate environment variables
const validateEnvironment = () => {
  const requiredVars = ['NATS_URL'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error('Missing required environment variables:', missingVars);
    process.exit(1);
  }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}, initiating shutdown...`);
  
  try {
    // Stop accepting new jobs
    scheduler.stop();

    // Close health server
    await new Promise((resolve) => {
      healthServer.close(() => {
        logger.info('Health server closed');
        resolve();
      });
    });

    // Close NATS connection
    await closeNATS();

    // Force shutdown if timeout reached
    setTimeout(() => {
      logger.error('Shutdown timeout reached, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT).unref();

    logger.info('Clean shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Process event handlers
const registerProcessHandlers = () => {
  process
    .on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    .on('SIGINT', () => gracefulShutdown('SIGINT'))
    .on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    })
    .on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
};

// Main worker initialization
const startWorker = async () => {
  try {
    validateEnvironment();
    logger.info('Starting worker server...', {
      nodeVersion: process.version,
      pid: process.pid,
      env: process.env.NODE_ENV,
    });

    await initNATS();
    scheduler.start();
    startHealthServer();
    registerProcessHandlers();

    // Periodic status logging
    setInterval(() => {
      logger.info('Worker Status', {
        memory: process.memoryUsage(),
        schedulerStatus: scheduler.getStatus(),
        natsStatus: getNatsStatus(),
      });
    }, 60000); // Every minute

    logger.info('Worker server started successfully');
  } catch (error) {
    logger.error('Worker startup failed:', {
      error: error.message,
      stack: error.stack,
    });
    await gracefulShutdown('startupFailure');
  }
};

// Start the worker
startWorker();