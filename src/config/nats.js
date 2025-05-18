// worker-server/src/config/nats.js
import { connect, StringCodec, JSONCodec, headers } from 'nats';
import { logger } from './logger.js';

const sc = StringCodec();
const jc = JSONCodec();
let nc = null;

// Enhanced connection tracking
let connectionState = {
  healthy: false,
  lastActivity: null,
  reconnectAttempts: 0
};

export const initNATS = async () => {
  try {
    // Validate NATS_URL before connecting
    if (!process.env.NATS_URL) {
      throw new Error('NATS_URL environment variable not set');
    }

    nc = await connect({
      servers: process.env.NATS_URL,
      reconnect: true,
      maxReconnectAttempts: process.env.NATS_MAX_RECONNECT || -1,
      reconnectTimeWait: 2500,
      pingInterval: 30000,
      timeout: 10000,
      waitOnFirstConnect: true,
      headers: true,
      // Enhanced TLS configuration
      tls: process.env.NATS_TLS ? {
        caFile: process.env.NATS_CA_PATH,
        keyFile: process.env.NATS_KEY_PATH,
        certFile: process.env.NATS_CERT_PATH
      } : undefined,
    });

    // Event handlers with enhanced logging
    nc.addEventListener('connect', () => {
      connectionState = {
        healthy: true,
        lastActivity: new Date(),
        reconnectAttempts: 0
      };
      logger.info(`NATS: Connected to ${nc.server.toString()} [${nc.info?.version}]`);
    });

    nc.addEventListener('disconnect', () => {
      connectionState.healthy = false;
      logger.warn('NATS: Disconnected', {
        server: nc.server?.toString(),
        lastError: nc.lastError?.message
      });
    });

    nc.addEventListener('reconnect', () => {
      connectionState.reconnectAttempts++;
      logger.info('NATS: Reconnecting attempt', {
        attempt: connectionState.reconnectAttempts
      });
    });

    nc.addEventListener('error', (err) => {
      logger.error('NATS: Connection error', {
        code: err.code,
        message: err.message,
        server: nc.server?.toString(),
        stack: err.stack
      });
    });

    nc.addEventListener('close', () => {
      connectionState.healthy = false;
      logger.warn('NATS: Connection closed', {
        duration: connectionState.lastActivity 
          ? Date.now() - connectionState.lastActivity 
          : 'N/A'
      });
    });

    startConnectionWatcher();
    startLatencyMonitor();

    logger.info('NATS connection established');
    return nc;
  } catch (error) {
    logger.error('NATS: Initial connection failed', {
      error: error.message,
      stack: error.stack,
      config: {
        url: process.env.NATS_URL,
        tls: Boolean(process.env.NATS_TLS)
      }
    });
    process.exit(1);
  }
};

export const publishEvent = async (subject, payload, headers = {}) => {
  if (!nc || !connectionState.healthy) {
    throw new Error(`NATS: Connection unavailable [Status: ${getNatsStatus().status}]`);
  }

  try {
    const h = headers();
    const messageId = crypto.randomUUID();
    h.set('x-message-id', messageId);
    h.set('x-source', 'crypto-worker');
    Object.entries(headers).forEach(([key, value]) => h.set(key, value));

    const ack = await nc.request(subject, jc.encode(payload), {
      headers: h,
      timeout: 5000
    });

    logger.debug(`NATS: Published to ${subject}`, {
      messageId,
      ack: sc.decode(ack.data),
      payloadSize: JSON.stringify(payload).length
    });

    return ack;
  } catch (error) {
    logger.error('NATS: Publish failed', {
      subject,
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
};

const startConnectionWatcher = () => {
  setInterval(() => {
    if (!connectionState.healthy) {
      logger.warn('NATS: Connection health check failed', getNatsStatus());
    }
  }, 30000);
};

const startLatencyMonitor = () => {
  setInterval(async () => {
    if (connectionState.healthy) {
      try {
        const start = Date.now();
        await nc.flush();
        const latency = Date.now() - start;
        logger.debug('NATS: Connection latency', { latency });
      } catch (error) {
        logger.warn('NATS: Latency check failed', { error: error.message });
      }
    }
  }, 60000);
};

export const closeNATS = async () => {
  if (nc) {
    try {
      await nc.drain();
      logger.info('NATS: Connection drained', {
        stats: nc.stats()
      });
    } catch (error) {
      logger.error('NATS: Drain failed', { error: error.message });
      await nc.close();
    }
  }
};

// Enhanced status reporting
export const getNatsStatus = () => ({
  status: connectionState.healthy ? 'healthy' : 'unhealthy',
  server: nc?.server?.toString(),
  version: nc?.info?.version,
  uptime: connectionState.lastActivity 
    ? Date.now() - connectionState.lastActivity 
    : 0,
  stats: nc?.stats(),
  lastError: nc?.lastError?.message
});

process.on('SIGTERM', async () => {
  await closeNATS();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeNATS();
  process.exit(0);
});