import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { swaggerOptions } from './src/config/swagger.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { validateRequest } from './src/middleware/validator.js';
import { rateLimiter } from './src/middleware/rateLimiter.js';
import { timeout } from './src/middleware/timeout.js';
import cryptoRoutes from './src/routes/cryptoRoutes.js';
import healthRoutes from './src/routes/healthRoutes.js';
import { initNatsConnection } from './src/services/natsService.js';
import logger from './src/utils/logger.js';
import prometheus from 'prom-client';
import responseTime from 'response-time';
import { rateLimit } from 'express-rate-limit';
import { validateEnv } from './src/config/env.js';
import { metrics } from './src/utils/metrics.js';
import { metricsMiddleware } from './src/middleware/metricsMiddleware.js';
import { globalLimiter } from './src/middleware/rateLimiter.js';

// Validate environment variables
validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(timeout(5000));
app.use(globalLimiter);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later'
});

app.use(limiter);

// Metrics middleware
app.use(metricsMiddleware);

// Routes
app.use('/health', healthRoutes);
app.use('/api', validateRequest, cryptoRoutes);

// Create a custom metrics registry
const register = new prometheus.Registry();
register.setDefaultLabels({ app: 'crypto-api' });

// Enable default system metrics with custom prefix
prometheus.collectDefaultMetrics({
  register,
  prefix: 'api_',
  timeout: 5000
});

// Custom metrics definitions
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status', 'status_class'],
  buckets: [0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status', 'status_class'],
  registers: [register]
});

const httpRequestErrors = new prometheus.Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status', 'error_type'],
  registers: [register]
});

const httpRequestsInProgress = new prometheus.Gauge({
  name: 'http_requests_in_progress',
  help: 'Current number of in-progress HTTP requests',
  labelNames: ['method', 'route'],
  registers: [register]
});

const httpRequestSizeBytes = new prometheus.Histogram({
  name: 'http_request_size_bytes',
  help: 'HTTP request body size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000],
  registers: [register]
});

const httpResponseSizeBytes = new prometheus.Histogram({
  name: 'http_response_size_bytes',
  help: 'HTTP response body size in bytes',
  labelNames: ['method', 'route', 'status'],
  buckets: [100, 1000, 10000, 100000],
  registers: [register]
});

// Business-specific metrics
const coinsRequestedTotal = new prometheus.Counter({
  name: 'coins_requested_total',
  help: 'Total number of cryptocurrency information requests',
  labelNames: ['coin_id', 'source'],
  registers: [register]
});

// Middleware configuration
app.use(responseTime((req, res, time) => {
  const route = req.route?.path || req.path;
  const status = res.statusCode;
  const statusClass = `${Math.floor(status / 100)}xx`;
  const contentLength = parseInt(res.get('Content-Length') || '0', 10);
  
  // Record duration metrics
  httpRequestDuration.labels({
    method: req.method,
    route,
    status,
    status_class: statusClass
  }).observe(time / 1000);

  // Record response size
  httpResponseSizeBytes.labels({
    method: req.method,
    route,
    status
  }).observe(contentLength);

  // Track errors
  if (status >= 400) {
    const errorType = status >= 500 ? 'server' : 'client';
    httpRequestErrors.labels({
      method: req.method,
      route,
      status,
      error_type: errorType
    }).inc();
  }

  // Track business metrics for specific routes
  if (route.startsWith('/coins/')) {
    const coinId = req.params.id?.toLowerCase();
    if (coinId) {
      coinsRequestedTotal.labels({
        coin_id: coinId,
        source: req.get('X-Request-Source') || 'unknown'
      }).inc();
    }
  }
}));

// Request tracking middleware
app.use((req, res, next) => {
  const route = req.route?.path || req.path;
  const method = req.method;
  
  // Track in-progress requests
  httpRequestsInProgress.labels({ method, route }).inc();
  
  // Track request size
  const contentLength = parseInt(req.get('Content-Length') || '0', 10);
  httpRequestSizeBytes.labels({ method, route }).observe(contentLength);

  // Track total requests
  res.on('finish', () => {
    const status = res.statusCode;
    const statusClass = `${Math.floor(status / 100)}xx`;
    
    httpRequestsTotal.labels({
      method,
      route,
      status,
      status_class: statusClass
    }).inc();
    
    httpRequestsInProgress.labels({ method, route }).dec();
  });

  next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.register.metrics());
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message });
    res.status(500).end();
  }
});

// Add metrics to health checks
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    metrics: register.getMetricsAsJSON().map(m => m.name)
  });
});

// Error handling
app.use(errorHandler);

// Initialize services
async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connected to MongoDB');

    // Initialize NATS connection
    await initNatsConnection();

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;