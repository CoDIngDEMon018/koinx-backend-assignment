import { connect } from 'nats';
import logger from '../utils/logger.js';
import { storeCryptoStats } from './cryptoService.js';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const SUBJECT = 'crypto.update';

let nc = null;

export async function initNatsConnection() {
  try {
    nc = await connect({
      servers: NATS_URL,
      reconnect: true,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2000
    });

    logger.info(`Connected to NATS server at ${nc.getServer()}`);

    // Subscribe to update events
    const sub = nc.subscribe(SUBJECT);
    
    for await (const msg of sub) {
      try {
        const data = JSON.parse(new TextDecoder().decode(msg.data));
        if (data.trigger === 'update') {
          logger.info('Received update trigger from NATS');
          await storeCryptoStats();
        }
      } catch (error) {
        logger.error('Error processing NATS message:', error);
      }
    }

    return nc;
  } catch (error) {
    logger.error('Failed to connect to NATS:', error);
    throw error;
  }
}

export async function closeNatsConnection() {
  if (nc) {
    await nc.drain();
    logger.info('NATS connection closed');
  }
}

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await closeNatsConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await closeNatsConnection();
  process.exit(0);
}); 