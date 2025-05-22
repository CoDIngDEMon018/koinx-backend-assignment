const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const { swaggerOptions } = require('./src/config/swagger.js');
const { errorHandler } = require('./src/middleware/errorHandler.js');
const { validateRequest } = require('./src/middleware/validator.js');
const { rateLimiter } = require('./src/middleware/rateLimiter.js');
const { timeout } = require('./src/middleware/timeout.js');
const cryptoRoutes = require('./src/routes/cryptoRoutes.js');
const healthRoutes = require('./src/routes/healthRoutes.js');
const { initNatsConnection } = require('./src/services/natsService.js');
const logger = require('./src/utils/logger.js');
const prometheus = require('prom-client');
const responseTime = require('response-time');
const { rateLimit } = require('express-rate-limit');
const { validateEnv } = require('./src/config/env.js');
const { metrics } = require('./src/utils/metrics.js');
const { metricsMiddleware } = require('./src/middleware/metricsMiddleware.js');
const { globalLimiter } = require('./src/middleware/rateLimiter.js');
const morgan = require('morgan');
const routes = require('./src/routes/index.js');

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
app.use(morgan('dev'));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerOptions));

// Routes
app.use('/health', healthRoutes);
routes(app);

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
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start the server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = app;