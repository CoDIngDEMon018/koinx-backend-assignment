import { connect } from 'nats';
import cron from 'node-cron';
import logger from './utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const SUBJECT = 'crypto.update';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/15 * * * *';

let nc = null;
let isConnected = false;

async function connectToNats() {
  try {
    nc = await connect({
      servers: NATS_URL,
      reconnect: true,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2000
    });
    isConnected = true;
    logger.info(`Connected to NATS server at ${nc.getServer()}`);
    return true;
  } catch (error) {
    logger.error('Error connecting to NATS:', error);
    return false;
  }
}

async function publishUpdateEvent() {
  if (!isConnected) {
    logger.error('Not connected to NATS server');
    return;
  }

  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const message = { 
        trigger: 'update',
        timestamp: new Date().toISOString()
      };
      await nc.publish(SUBJECT, JSON.stringify(message));
      logger.info('Published update event to NATS');
      return;
    } catch (error) {
      retries++;
      logger.error(`Error publishing update event (attempt ${retries}/${MAX_RETRIES}):`, error);
      
      if (retries < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  logger.error('Failed to publish update event after maximum retries');
}

async function startWorker() {
  try {
    // Initial connection
    const connected = await connectToNats();
    if (!connected) {
      throw new Error('Failed to connect to NATS server');
    }

    // Handle NATS connection errors
    nc.on('error', async (error) => {
      logger.error('NATS connection error:', error);
      isConnected = false;
      
      // Attempt to reconnect
      const reconnected = await connectToNats();
      if (!reconnected) {
        logger.error('Failed to reconnect to NATS server');
        process.exit(1);
      }
    });

    // Schedule the job
    cron.schedule(CRON_SCHEDULE, () => {
      publishUpdateEvent();
    });

    logger.info(`Worker server started with schedule: ${CRON_SCHEDULE}`);
  } catch (error) {
    logger.error('Error starting worker server:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  if (nc) {
    await nc.drain();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  if (nc) {
    await nc.drain();
  }
  process.exit(0);
});

startWorker(); 