// Mock logger
jest.mock('../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock metrics
global.metrics = {
  dbOperationLatency: {
    labels: jest.fn().mockReturnThis(),
    observe: jest.fn()
  },
  coingeckoApiErrors: {
    labels: jest.fn().mockReturnThis(),
    inc: jest.fn()
  },
  statsCalculated: {
    labels: jest.fn().mockReturnThis(),
    inc: jest.fn()
  },
  deviationCalculated: {
    labels: jest.fn().mockReturnThis(),
    inc: jest.fn()
  }
};

// Mock NATS
jest.mock('nats', () => ({
  connect: jest.fn().mockResolvedValue({
    subscribe: jest.fn().mockReturnValue({
      unsubscribe: jest.fn()
    }),
    publish: jest.fn(),
    close: jest.fn()
  }),
  StringCodec: jest.fn().mockReturnValue({
    encode: jest.fn(),
    decode: jest.fn()
  }),
  JSONCodec: jest.fn().mockReturnValue({
    encode: jest.fn(),
    decode: jest.fn()
  })
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.MONGODB_URI = 'mongodb://localhost:27017/crypto-stats-test';
process.env.NATS_URL = 'nats://localhost:4222';
process.env.COINGECKO_API_KEY = 'test-api-key';

// Increase timeout for tests
jest.setTimeout(30000);

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');

let mongoServer;

global.beforeAll = async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
};

global.afterAll = async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
};

// Export mocks and app for use in tests
module.exports = {
  metrics,
  app
}; 