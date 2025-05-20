import { connect } from 'nats';
import cron from 'node-cron';
import logger from './utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const SUBJECT = 'crypto.update';

async function publishUpdateEvent(nc) {
  try {
    const message = { trigger: 'update' };
    await nc.publish(SUBJECT, JSON.stringify(message));
    logger.info('Published update event to NATS');
  } catch (error) {
    logger.error('Error publishing update event:', error);
  }
}

async function startWorker() {
  try {
    const nc = await connect({ servers: NATS_URL });
    logger.info('Connected to NATS server');

    // Schedule the job to run every 15 minutes
    cron.schedule('*/15 * * * *', () => {
      publishUpdateEvent(nc);
    });

    logger.info('Worker server started');
  } catch (error) {
    logger.error('Error starting worker server:', error);
    process.exit(1);
  }
}

startWorker(); 