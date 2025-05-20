import { connect } from 'nats';
import { storeCryptoStats } from './cryptoService.js';
import logger from '../utils/logger.js';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const SUBJECT = 'crypto.update';

export async function startNatsSubscriber() {
  try {
    const nc = await connect({ servers: NATS_URL });
    logger.info('Connected to NATS server');

    const sub = nc.subscribe(SUBJECT);
    logger.info(`Subscribed to ${SUBJECT}`);

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
  } catch (error) {
    logger.error('Error connecting to NATS:', error);
    throw error;
  }
} 