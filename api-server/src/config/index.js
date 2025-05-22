const config = {
  port: process.env.PORT || 3000,
  healthPort: process.env.HEALTH_PORT || 3001,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-stats',
  natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
  coingeckoApiKey: process.env.COINGECKO_API_KEY,
  nodeEnv: process.env.NODE_ENV || 'development'
};

module.exports = config; 