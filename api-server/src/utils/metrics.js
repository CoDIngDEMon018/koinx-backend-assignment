import prometheus from 'prom-client';

// Create a custom registry
const register = new prometheus.Registry();
register.setDefaultLabels({ app: 'crypto-api' });

// Enable default metrics
prometheus.collectDefaultMetrics({
  register,
  prefix: 'api_',
  timeout: 5000
});

// Business metrics
export const metrics = {
  // CoinGecko API metrics
  coingeckoApiLatency: new prometheus.Histogram({
    name: 'coingecko_api_latency_seconds',
    help: 'Latency of CoinGecko API calls',
    labelNames: ['coin_id'],
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [register]
  }),

  coingeckoApiErrors: new prometheus.Counter({
    name: 'coingecko_api_errors_total',
    help: 'Total number of CoinGecko API errors',
    labelNames: ['coin_id', 'error_type'],
    registers: [register]
  }),

  // NATS metrics
  natsMessagesReceived: new prometheus.Counter({
    name: 'nats_messages_received_total',
    help: 'Total number of NATS messages received',
    registers: [register]
  }),

  natsMessageProcessingTime: new prometheus.Histogram({
    name: 'nats_message_processing_seconds',
    help: 'Time taken to process NATS messages',
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [register]
  }),

  // Database metrics
  dbOperationLatency: new prometheus.Histogram({
    name: 'db_operation_latency_seconds',
    help: 'Latency of database operations',
    labelNames: ['operation', 'collection'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1],
    registers: [register]
  }),

  // Business logic metrics
  statsCalculated: new prometheus.Counter({
    name: 'stats_calculated_total',
    help: 'Total number of statistics calculations',
    labelNames: ['coin_id', 'type'],
    registers: [register]
  }),

  deviationCalculated: new prometheus.Counter({
    name: 'deviation_calculated_total',
    help: 'Total number of deviation calculations',
    labelNames: ['coin_id'],
    registers: [register]
  })
};

export { register }; 