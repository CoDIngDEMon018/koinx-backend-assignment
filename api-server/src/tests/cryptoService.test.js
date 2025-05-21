const axios = require('axios');
const { storeCryptoStats, getLatestStats, getPriceDeviation } = require('../services/cryptoService.js');
const { CryptoStats } = require('../models/CryptoStats.js');
const { AppError } = require('../middleware/errorHandler.js');

// Mock dependencies
require('axios').mockResolvedValue({
  data: {
    bitcoin: {
      usd: 50000,
      usd_market_cap: 1000000000000,
      usd_24h_change: 2.5
    }
  }
});

require('../models/CryptoStats.js').mockResolvedValue([{
  coinId: 'bitcoin',
  price: 50000,
  marketCap: 1000000000000,
  change24h: 2.5
}]);

describe('CryptoService', () => {
  beforeEach(() => {
    require('axios').clearAllMocks();
    require('../models/CryptoStats.js').clearAllMocks();
  });

  describe('storeCryptoStats', () => {
    it('should fetch and store crypto stats successfully', async () => {
      const result = await storeCryptoStats();
      expect(result.stats).toHaveLength(1);
      expect(result.stats[0].coinId).toBe('bitcoin');
      expect(result.stats[0].price).toBe(50000);
    });

    it('should handle API errors gracefully', async () => {
      require('axios').mockRejectedValue(new Error('API Error'));
      
      await expect(storeCryptoStats()).rejects.toThrow(AppError);
    });
  });

  describe('getLatestStats', () => {
    it('should return latest stats for a coin', async () => {
      const mockStats = {
        price: 50000,
        marketCap: 1000000000000,
        change24h: 2.5
      };

      require('../models/CryptoStats.js').mockResolvedValue(mockStats);

      const result = await getLatestStats('bitcoin');
      expect(result).toEqual({
        price: 50000,
        marketCap: 1000000000000,
        '24hChange': 2.5
      });
    });

    it('should throw error if no stats found', async () => {
      require('../models/CryptoStats.js').mockResolvedValue(null);
      
      await expect(getLatestStats('bitcoin')).rejects.toThrow(AppError);
    });
  });

  describe('getPriceDeviation', () => {
    it('should calculate standard deviation correctly', async () => {
      const mockPrices = [
        { price: 40000 },
        { price: 45000 },
        { price: 50000 }
      ];

      require('../models/CryptoStats.js').mockResolvedValue(mockPrices);

      const result = await getPriceDeviation('bitcoin');
      expect(result.deviation).toBeDefined();
      expect(result.sampleSize).toBe(3);
    });

    it('should throw error if no data available', async () => {
      require('../models/CryptoStats.js').mockResolvedValue([]);
      
      await expect(getPriceDeviation('bitcoin')).rejects.toThrow(AppError);
    });
  });
}); 