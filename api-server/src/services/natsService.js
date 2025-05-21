import { connect, JSONCodec } from 'nats';
import logger from '../config/logger.js';
import { storeCryptoStats } from './cryptoService.js';

let natsClient = null;
const jc = JSONCodec();

export const initNatsConnection = async () => {
  try {
    natsClient = await connect({ 
      servers: process.env.NATS_URL,
      reconnect: true,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2500
    });

    logger.info('Connected to NATS server');

    // Set up subscription for crypto updates
    const sub = natsClient.subscribe('crypto.update');
    (async () => {
      for await (const msg of sub) {
        try {
          const data = jc.decode(msg.data);
          logger.debug('Received crypto update:', data);
          // Handle the message
          msg.respond(jc.encode({ status: 'received' }));
        } catch (error) {
          logger.error('Error processing NATS message:', error);
          msg.respond(jc.encode({ status: 'error', message: error.message }));
        }
      }
    })().catch(error => {
      logger.error('NATS subscription error:', error);
    });

    return natsClient;
  } catch (error) {
    logger.error('Failed to connect to NATS:', error);
    throw error;
  }
};

export const getNatsClient = () => {
  if (!natsClient) {
    throw new Error('NATS client not initialized');
  }
  return natsClient;
};

export const publishEvent = async (subject, data) => {
  if (!natsClient) {
    throw new Error('NATS client not initialized');
  }
  try {
    await natsClient.publish(subject, jc.encode(data));
    logger.debug(`Published to ${subject}:`, data);
  } catch (error) {
    logger.error(`Error publishing to ${subject}:`, error);
    throw error;
  }
};

export const closeNatsConnection = async () => {
  if (natsClient) {
    await natsClient.drain();
    natsClient = null;
    logger.info('NATS connection closed');
  }
};

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