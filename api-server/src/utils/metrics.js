import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Create a registry
const register = new Registry();

// API metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

// Database metrics
const dbOperationDuration = new Histogram({
  name: 'db_operation_duration_seconds',
  help: 'Duration of database operations in seconds',
  labelNames: ['operation', 'collection'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1]
});

// External API metrics
const externalApiDuration = new Histogram({
  name: 'external_api_duration_seconds',
  help: 'Duration of external API calls in seconds',
  labelNames: ['service', 'endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const externalApiErrors = new Counter({
  name: 'external_api_errors_total',
  help: 'Total number of external API errors',
  labelNames: ['service', 'endpoint', 'status_code']
});

// NATS metrics
const natsMessagesPublished = new Counter({
  name: 'nats_messages_published_total',
  help: 'Total number of NATS messages published',
  labelNames: ['subject']
});

const natsMessagesReceived = new Counter({
  name: 'nats_messages_received_total',
  help: 'Total number of NATS messages received',
  labelNames: ['subject']
});

// Business metrics
const cryptoStatsStored = new Counter({
  name: 'crypto_stats_stored_total',
  help: 'Total number of crypto stats stored',
  labelNames: ['coin_id']
});

const deviationCalculated = new Counter({
  name: 'deviation_calculated_total',
  help: 'Total number of deviation calculations',
  labelNames: ['coin_id']
});

// System metrics
const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['type']
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(dbOperationDuration);
register.registerMetric(externalApiDuration);
register.registerMetric(externalApiErrors);
register.registerMetric(natsMessagesPublished);
register.registerMetric(natsMessagesReceived);
register.registerMetric(cryptoStatsStored);
register.registerMetric(deviationCalculated);
register.registerMetric(activeConnections);

export const metrics = {
  httpRequestDuration,
  dbOperationDuration,
  externalApiDuration,
  externalApiErrors,
  natsMessagesPublished,
  natsMessagesReceived,
  cryptoStatsStored,
  deviationCalculated,
  activeConnections,
  register
}; 