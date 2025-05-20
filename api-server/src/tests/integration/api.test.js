import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../../app.js';
import { CryptoStats } from '../../models/CryptoStats.js';

// Mock dependencies
jest.mock('../../models/CryptoStats.js');

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/stats', () => {
    it('should return latest stats for a valid coin', async () => {
      const mockStats = {
        price: 50000,
        marketCap: 1000000000000,
        change24h: 2.5
      };

      CryptoStats.findOne.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/stats')
        .query({ coin: 'bitcoin' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        price: 50000,
        marketCap: 1000000000000,
        '24hChange': 2.5
      });
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
      expect(response.body).toHaveProperty('message', 'Invalid coin. Supported coins are: bitcoin, ethereum, matic-network');
    });
  });

  describe('GET /api/deviation', () => {
    it('should calculate standard deviation correctly', async () => {
      const mockPrices = [
        { price: 40000 },
        { price: 45000 },
        { price: 50000 }
      ];

      CryptoStats.find.mockResolvedValue(mockPrices);

      const response = await request(app)
        .get('/api/deviation')
        .query({ coin: 'bitcoin' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('deviation');
      expect(response.body).toHaveProperty('sampleSize', 3);
    });

    it('should return 404 when no data available', async () => {
      CryptoStats.find.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/deviation')
        .query({ coin: 'bitcoin' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'No stats found for bitcoin');
    });
  });
}); 