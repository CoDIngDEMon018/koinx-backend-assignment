// api-server/test/routes/crypto-stats.route.test.js
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDatabase } = require('../src/config/database');
import { mockNATS } from '../mocks/nats.mock.js';

// Mock NATS connection before all tests
jest.mock('../src/config/nats.js', () => require('../mocks/nats.mock.js'));

describe('Crypto Statistics Routes', () => {
  let mongoServer;
  let testData;

  beforeAll(async () => {
    // Create in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    await connectDatabase(mongoServer.getUri());

    // Create test data
    testData = [
      {
        coinId: 'bitcoin',
        price: 50000,
        timestamp: new Date()
      },
      {
        coinId: 'ethereum',
        price: 3000,
        timestamp: new Date()
      }
    ];

    // Insert test data
    await mongoose.connection.collection('cryptostats').insertMany(testData);
  }, 60000); // Increase timeout to 60 seconds

  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
    jest.restoreAllMocks();
  });

  describe('GET /api/stats', () => {
    it('should return latest stats for all coins', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return 404 when no stats available', async () => {
      // Clear the collection
      await mongoose.connection.collection('cryptostats').deleteMany({});

      const response = await request(app)
        .get('/api/stats')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('No stats available');

      // Restore test data
      await mongoose.connection.collection('cryptostats').insertMany(testData);
    });
  });

  describe('GET /api/stats/:coin', () => {
    it('should return latest stats for a specific coin', async () => {
      const response = await request(app)
        .get('/api/stats/bitcoin')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('coinId', 'bitcoin');
      expect(response.body.data).toHaveProperty('price');
    });

    it('should return 404 for non-existent coin', async () => {
      const response = await request(app)
        .get('/api/stats/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('No stats found for non-existent');
    });
  });

  describe('GET /api/deviation', () => {
    it('should return price deviation for a coin', async () => {
      const response = await request(app)
        .get('/api/deviation?coin=bitcoin')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('deviation');
      expect(response.body.data).toHaveProperty('sampleSize');
    });

    it('should return 400 when coin parameter is missing', async () => {
      const response = await request(app)
        .get('/api/deviation')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Coin parameter is required');
    });

    it('should return 404 when no data available for coin', async () => {
      const response = await request(app)
        .get('/api/deviation?coin=non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('No data available for non-existent');
    });
  });

  describe('Edge Cases', () => {
    it('should handle extreme numeric values', async () => {
      // Insert test data with extreme values
      await mongoose.connection.collection('cryptostats').insertOne({
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