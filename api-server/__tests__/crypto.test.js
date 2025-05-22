import axios from 'axios';
import { storeCryptoStats, getLatestStats, getPriceDeviation } from '../src/services/cryptoService.js';
import { CryptoStats } from '../src/models/CryptoStats.js';
import { AppError } from '../src/middleware/errorHandler.js';
import metrics from '../src/utils/metrics.js';

// Mock dependencies
jest.mock('axios');
jest.mock('../src/models/CryptoStats.js', () => ({
  CryptoStats: {
    findOne: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        coinId: 'bitcoin',
        price: 50000,
        timestamp: new Date()
      })
    }),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { price: 50000 },
        { price: 51000 },
        { price: 49000 }
      ])
    }),
    create: jest.fn().mockResolvedValue({
      coinId: 'bitcoin',
      price: 50000,
      timestamp: new Date()
    })
  }
}));

// Mock metrics object
jest.mock('../src/utils/metrics', () => ({
  coingeckoApiErrors: { labels: jest.fn().mockReturnThis(), inc: jest.fn() },
  statsCalculated: { labels: jest.fn().mockReturnThis(), inc: jest.fn() },
  dbOperationLatency: { labels: jest.fn().mockReturnThis(), observe: jest.fn() },
  deviationCalculated: { labels: jest.fn().mockReturnThis(), inc: jest.fn() }
}));

// Mock axios.get to return expected data structure
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({
    data: {
      bitcoin: {
        usd: 50000,
        labels: ['bitcoin', 'btc']
      },
      ethereum: {
        usd: 3000,
        labels: ['ethereum', 'eth']
      },
      'matic-network': {
        usd: 1.5,
        labels: ['matic', 'polygon']
      }
    }
  })
}));

describe('CryptoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('storeCryptoStats', () => {
    it('should fetch and store crypto stats successfully', async () => {
      const mockData = {
        bitcoin: { usd: 50000 },
        ethereum: { usd: 3000 },
        'matic-network': { usd: 1.5 }
      };

      axios.get.mockResolvedValue({ data: mockData });
      CryptoStats.create.mockResolvedValue({ coinId: 'bitcoin', price: 50000 });

      await storeCryptoStats();

      expect(metrics.coingeckoApiErrors.labels).toHaveBeenCalled();
      expect(metrics.statsCalculated.labels).toHaveBeenCalled();
      expect(CryptoStats.create).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      axios.get.mockRejectedValue(new Error('API Error'));

      await expect(storeCryptoStats()).rejects.toThrow('Failed to process any coin data');
      expect(metrics.coingeckoApiErrors.labels).toHaveBeenCalled();
    });
  });

  describe('getLatestStats', () => {
    it('should return latest stats for a coin', async () => {
      const mockStats = { coinId: 'bitcoin', price: 50000 };
      CryptoStats.findOne.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockStats)
      });

      const result = await getLatestStats('bitcoin');

      expect(result).toEqual(mockStats);
      expect(metrics.dbOperationLatency.labels).toHaveBeenCalled();
    });

    it('should throw error if no stats found', async () => {
      CryptoStats.findOne.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null)
      });

      await expect(getLatestStats('bitcoin')).rejects.toThrow(AppError);
      expect(metrics.dbOperationLatency.labels).toHaveBeenCalled();
    });
  });

  describe('getPriceDeviation', () => {
    it('should calculate standard deviation correctly', async () => {
      const mockStats = [
        { price: 50000 },
        { price: 51000 },
        { price: 49000 }
      ];
      CryptoStats.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockStats)
      });

      const result = await getPriceDeviation('bitcoin');

      expect(result).toHaveProperty('deviation');
      expect(metrics.dbOperationLatency.labels).toHaveBeenCalled();
      expect(metrics.deviationCalculated.labels).toHaveBeenCalled();
    });

    it('should throw error if no data available', async () => {
      CryptoStats.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      });

      await expect(getPriceDeviation('bitcoin')).rejects.toThrow(AppError);
      expect(metrics.dbOperationLatency.labels).toHaveBeenCalled();
    });
  });
}); 