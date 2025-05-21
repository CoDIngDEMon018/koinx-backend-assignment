// api-server/test/routes/crypto-stats.route.test.js
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../src/app.js');
const { connectDatabase } = require('../../src/config/database.js');
const { mockNATS } = require('../mocks/nats.mock.js');

// Mock NATS connection before all tests
jest.mock('../../src/config/nats.js', () => mockNATS);

describe('Crypto Statistics Routes', () => {
  let mongoServer;
  let testData;

  beforeAll(async () => {
    // Create in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    await connectDatabase(mongoServer.getUri());

    // Create test data for all supported coins
    testData = {
      bitcoin: {
        coinId: 'bitcoin',
        price: 45000,
        marketCap: 850_000_000_000,
        change24h: 1.8,
        timestamp: new Date()
      },
      ethereum: {
        coinId: 'ethereum',
        price: 3200,
        marketCap: 380_000_000_000,
        change24h: -0.5,
        timestamp: new Date()
      },
      matic: {
        coinId: 'matic-network',
        price: 1.2,
        marketCap: 8_500_000_000,
        change24h: 2.1,
        timestamp: new Date()
      }
    };

    // Insert test data
    await mongoose.connection.db
      .collection('cryptostats')
      .insertMany(Object.values(testData));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    // Reset database state before each test
    await mongoose.connection.db
      .collection('cryptostats')
      .deleteMany({});
    await mongoose.connection.db
      .collection('cryptostats')
      .insertMany(Object.values(testData));
  });

  describe('GET /api/stats', () => {
    it('should return 200 with valid cryptocurrency stats', async () => {
      const testCases = [
        { coin: 'bitcoin', expected: testData.bitcoin },
        { coin: 'ethereum', expected: testData.ethereum },
        { coin: 'matic-network', expected: testData.matic }
      ];

      for (const { coin, expected } of testCases) {
        const res = await request(app)
          .get('/api/stats')
          .query({ coin });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          price: expected.price,
          marketCap: expected.marketCap,
          '24hChange': expected.change24h
        });
        expect(typeof res.body.price).toBe('number');
        expect(res.body.price).toBeGreaterThan(0);
      }
    });

    it('should return 400 for missing coin parameter', async () => {
      const res = await request(app)
        .get('/api/stats');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Missing required parameter: coin',
        message: 'Please provide a coin parameter (bitcoin, ethereum, or matic-network)'
      });
    });

    it('should return 400 for invalid coin parameter', async () => {
      const res = await request(app)
        .get('/api/stats')
        .query({ coin: 'invalid-coin' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Invalid coin parameter',
        message: 'Supported coins: bitcoin, ethereum, matic-network'
      });
    });

    it('should return 404 when no stats available', async () => {
      // Clear all test data
      await mongoose.connection.db
        .collection('cryptostats')
        .deleteMany({});

      const res = await request(app)
        .get('/api/stats')
        .query({ coin: 'bitcoin' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: 'No stats found for bitcoin'
      });
    });

    it('should return 503 when external services unavailable', async () => {
      // Simulate database failure
      await mongoose.disconnect();

      const res = await request(app)
        .get('/api/stats')
        .query({ coin: 'bitcoin' });

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({
        error: 'Service unavailable'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle extreme numeric values', async () => {
      // Insert test data with extreme values
      await mongoose.connection.db
        .collection('cryptostats')
        .insertOne({
          coinId: 'bitcoin',
          price: Number.MAX_SAFE_INTEGER,
          marketCap: Number.MAX_VALUE,
          change24h: 1000,
          timestamp: new Date()
        });

      const res = await request(app)
        .get('/api/stats')
        .query({ coin: 'bitcoin' });

      expect(res.status).toBe(200);
      expect(res.body.price).toBe(Number.MAX_SAFE_INTEGER);
      expect(res.body.marketCap).toBe(Number.MAX_VALUE);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10).fill().map(() => 
        request(app)
          .get('/api/stats')
          .query({ coin: 'bitcoin' })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject(testData.bitcoin);
      });
    });
  });
});