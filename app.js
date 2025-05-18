import prometheus from 'prom-client';
import responseTime from 'response-time';

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

// Secure metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    console.error('Metrics collection error:', error);
    res.status(500).end('Internal Server Error');
  }
});

// Add metrics to health checks
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    metrics: register.getMetricsAsJSON().map(m => m.name)
  });
});