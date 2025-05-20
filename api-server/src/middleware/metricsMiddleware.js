import { metrics } from '../utils/metrics.js';

export const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime();

  // Track response
  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds + nanoseconds / 1e9;

    metrics.httpRequestDuration
      .labels({
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode
      })
      .observe(duration);
  });

  next();
}; 