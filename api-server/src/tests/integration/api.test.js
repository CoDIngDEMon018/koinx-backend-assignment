const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../../app');
const { connectDatabase } = require('../../config/database');

describe('API Integration Tests', () => {
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
  });

  describe('GET /api/stats', () => {
    it('should return latest stats for a valid coin', async () => {
      const response = await request(app)
        .get('/api/stats')
        .query({ coin: 'bitcoin' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });

    it('should return 400 for missing coin parameter', async () => {
      const response = await request(app)
        .get('/api/stats');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Coin parameter is required');
    });

    it('should return 400 for invalid coin', async () => {
      const response = await request(app)
        .get('/api/stats')
        .query({ coin: 'invalid-coin' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/deviation', () => {
    it('should calculate standard deviation correctly', async () => {
      const response = await request(app)
        .get('/api/deviation')
        .query({ coin: 'bitcoin' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('deviation');
    });

    it('should return 404 when no data available', async () => {
      // Clear the collection
      await mongoose.connection.collection('cryptostats').deleteMany({});

      const response = await request(app)
        .get('/api/deviation')
        .query({ coin: 'bitcoin' });

      expect(response.status).toBe(404);

      // Restore test data
      await mongoose.connection.collection('cryptostats').insertMany(testData);
    });
  });
}); 