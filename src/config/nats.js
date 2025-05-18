// api-server/src/config/nats.js
import { connect, StringCodec, JSONCodec, headers } from 'nats';
import { logger } from './logger.js';
import { storeCryptoStats } from '../services/statsService.js';

const sc = StringCodec();
const jc = JSONCodec();
let nc = null;

// Global NATS configuration
const NATS_CONFIG = {
  servers: process.env.NATS_URL,
  reconnect: true,
  maxReconnectAttempts: -1, // Infinite retries
  reconnectTimeWait: 2500, // Exponential backoff base
  pingInterval: 30000, // Keepalive pings
  timeout: 10000, // Connection timeout
  waitOnFirstConnect: true, // Wait for first connection
  headers: true, // Enable header support
};

// Connection health status tracker
let connectionHealthy = false;

export const initNATS = async () => {
  try {
    nc = await connect({
      ...NATS_CONFIG,
      // Add TLS configuration if needed
      // tls: process.env.NATS_TLS ? { ... } : undefined,
    });

    // Connection event handlers
    nc.addEventListener('connect', () => {
      connectionHealthy = true;
      logger.info('NATS: Connection established');
      setupSubscriptions();
    });

    nc.addEventListener('disconnect', () => {
      connectionHealthy = false;
      logger.warn('NATS: Disconnected');
    });

    nc.addEventListener('reconnect', () => {
      logger.info('NATS: Reconnecting...');
    });

    nc.addEventListener('error', (err) => {
      logger.error('NATS: Connection error', {
        code: err.code,
        message: err.message,
        stack: err.stack,
      });
    });

    nc.addEventListener('close', () => {
      connectionHealthy = false;
      logger.warn('NATS: Connection closed permanently');
    });

    // Set up core subscriptions
    await setupSubscriptions();

    // Start health monitoring
    startHealthChecks();

    return nc;
  } catch (error) {
    logger.error('NATS: Connection failed', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    throw error;
  }
};

const setupSubscriptions = async () => {
  try {
    // Crypto update subscription
    const cryptoSub = nc.subscribe('crypto.update', {
      queue: 'crypto-stats-workers',
      max: 100, // Max messages without ACK
    });

    (async () => {
      for await (const msg of cryptoSub) {
        try {
          const data = jc.decode(msg.data);
          const h = msg.headers ?? headers();
          
          logger.debug('NATS: Received crypto update', {
            subject: msg.subject,
            headers: h?.toJSON(),
          });

          await storeCryptoStats();
          msg.respond(sc.encode('ACK'));
        } catch (error) {
          logger.error('NATS: Message processing failed', {
            subject: msg.subject,
            error: error.message,
            stack: error.stack,
          });
          msg.respond(sc.encode('NACK'));
        }
      }
    })();

    logger.info('NATS: Subscriptions initialized');
  } catch (error) {
    logger.error('NATS: Subscription setup failed', error);
  }
};

export const publishEvent = async (subject, payload, headers = {}) => {
  if (!nc || nc.isClosed()) {
    throw new Error('NATS: Connection not available');
  }

  try {
    const h = headers();
    Object.entries(headers).forEach(([key, value]) => h.set(key, value));

    await nc.publish(subject, jc.encode(payload), { headers: h });
    logger.debug(`NATS: Published to ${subject}`, {
      headers: h.toJSON(),
      payloadSize: JSON.stringify(payload).length,
    });
  } catch (error) {
    logger.error('NATS: Publish failed', {
      subject,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

const startHealthChecks = () => {
  setInterval(() => {
    if (!connectionHealthy) {
      logger.warn('NATS: Connection unhealthy - attempting reset');
      nc.drain().then(() => initNATS());
    }
  }, 60000); // Check every minute
};

export const closeNATS = async () => {
  if (nc) {
    await nc.drain().catch(() => nc.close());
    logger.info('NATS: Connection closed gracefully');
  }
};

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  await closeNATS();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeNATS();
  process.exit(0);
});

/**
 * @typedef {Object} NATSHealth
 * @property {boolean} connected - Connection status
 * @property {string} server - Connected server URL
 * @property {number} pendingMessages - Queued messages
 */

/**
 * Get current NATS connection health status
 * @returns {NATSHealth}
 */
export const getNATSHealth = () => ({
  connected: connectionHealthy,
  server: nc?.server?.toString(),
  pendingMessages: nc?.stats().outMsgs,
});