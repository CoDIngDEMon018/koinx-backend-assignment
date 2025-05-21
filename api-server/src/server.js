// api-server/src/server.js
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initNATS, closeNATS } from './config/nats.js';
// import app from './app.js';
import { logger } from './config/logger.js';
import cluster from 'cluster';
import process from 'process';
import os from 'os';
import http from 'http';
import app from '../app.js';

const PORT = process.env.PORT || 3000;
const HEALTH_PORT = process.env.HEALTH_PORT || 3001;
const SHUTDOWN_TIMEOUT = 15000; // 15 seconds graceful shutdown window
const CPU_COUNT = process.env.CLUSTER_MODE ? os.cpus().length : 1;

// Health check server
const healthServer = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/health') {
    res.end(JSON.stringify({
      status: 'OK',
      uptime: process.uptime(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      nats: getNATSStatus().connected ? 'connected' : 'disconnected'
    }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

const validateEnvironment = () => {
  const requiredVars = ['MONGODB_URI', 'NATS_URL'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error('Missing required environment variables:', missingVars);
    process.exit(1);
  }
};

const registerProcessHandlers = () => {
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      // Close health server
      await new Promise((resolve) => {
        healthServer.close(() => {
          logger.info('Health server closed');
          resolve();
        });
      });

      // Close application server
      await new Promise((resolve) => {
        app.server.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      });

      // Close connections
      await Promise.all([
        disconnectDatabase(),
        closeNATS()
      ]);

      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process
    .on('SIGTERM', () => shutdown('SIGTERM'))
    .on('SIGINT', () => shutdown('SIGINT'))
    .on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('uncaughtException');
    })
    .on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
};

const startServer = async () => {
  try {
    validateEnvironment();
    
    logger.info('Starting API server', {
      nodeVersion: process.version,
      pid: process.pid,
      environment: process.env.NODE_ENV,
      clusterMode: CPU_COUNT > 1
    });

    // Initialize core services
    await connectDatabase();
    await initNATS();

    // Start health server
    healthServer.listen(HEALTH_PORT, () => {
      logger.info(`Health check server running on port ${HEALTH_PORT}`);
    });

    // Start main application
    app.server = app.listen(PORT, () => {
      logger.info(`API server running on port ${PORT}`);
    });

    // Register process handlers
    registerProcessHandlers();

    // Periodic status logging
    setInterval(() => {
      logger.info('Server Status', {
        memory: process.memoryUsage(),
        connections: app.server._connections,
        databaseStatus: mongoose.connection.readyState,
        natsStatus: getNATSStatus()
      });
    }, 60000); // Every minute

  } catch (error) {
    logger.error('Server startup failed:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Cluster mode implementation
if (cluster.isPrimary && CPU_COUNT > 1) {
  logger.info(`Master ${process.pid} is running`);
  
  // Fork workers
  for (let i = 0; i < CPU_COUNT; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    logger.warn(`Worker ${worker.process.pid} died`);
    if (!isShuttingDown) cluster.fork();
  });
} else {
  startServer();
}