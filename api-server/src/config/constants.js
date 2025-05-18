/**
 * Application-wide constants and configurations
 * @namespace Constants
 */

// Cryptocurrency Configuration
export const CRYPTO = Object.freeze({
  SUPPORTED_COINS: new Set([
    'bitcoin',
    'ethereum',
    'matic-network'
  ]),
  
  // Coin metadata for API responses
  COIN_METADATA: {
    'bitcoin': { 
      name: 'Bitcoin',
      symbol: 'BTC',
      coinGeckoId: 'bitcoin'
    },
    'ethereum': {
      name: 'Ethereum',
      symbol: 'ETH',
      coinGeckoId: 'ethereum'
    },
    'matic-network': {
      name: 'Polygon',
      symbol: 'MATIC',
      coinGeckoId: 'matic-network'
    }
  },

  // Price deviation thresholds
  DEVIATION_THRESHOLDS: {
    WARNING: 5,    // 5%
    CRITICAL: 10    // 10%
  }
});

// Caching Configuration
export const CACHE = Object.freeze({
  TTL: {
    DEFAULT: 300,            // 5 minutes
    HISTORICAL_DATA: 1800,   // 30 minutes
    COIN_LIST: 86400         // 24 hours
  },
  KEYS: {
    COIN_STATS: (coinId) => `stats:${coinId}`,
    HISTORICAL: (coinId) => `history:${coinId}`
  }
});

// API Configuration
export const API = Object.freeze({
  COINGECKO: {
    BASE_URL: 'https://api.coingecko.com/api/v3',
    ENDPOINTS: {
      MARKET_DATA: '/coins/markets',
      PRICE_HISTORY: '/coins/{id}/market_chart'
    },
    RATE_LIMIT: 10 // Requests per minute
  },
  
  DEFAULTS: {
    FIAT_CURRENCY: 'usd',
    MAX_DATA_POINTS: 100
  }
});

// Error Configuration
export const ERRORS = Object.freeze({
  CODES: {
    INVALID_COIN: 'API_001',
    RATE_LIMITED: 'API_002',
    EXTERNAL_API_FAILURE: 'API_503'
  },
  MESSAGES: {
    DEFAULT: 'An unexpected error occurred',
    MISSING_PARAM: 'Required parameter is missing',
    INVALID_INPUT: 'Invalid input format'
  }
});

// Application Security
export const SECURITY = Object.freeze({
  RATE_LIMITS: {
    PUBLIC: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX: 100
    },
    SENSITIVE: {
      WINDOW_MS: 60 * 60 * 1000, // 1 hour
      MAX: 30
    }
  },
  REQUEST_SIZE: '10mb'
});

// Pagination Defaults
export const PAGINATION = Object.freeze({
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100
});

// Validation Constants
export const VALIDATION = Object.freeze({
  PRICE: {
    MIN: 0,
    MAX: Number.MAX_SAFE_INTEGER
  },
  MARKET_CAP: {
    MIN: 1_000_000 // $1M
  }
});

/**
 * Helper to validate supported coins
 * @param {string} coinId - Cryptocurrency ID to validate
 * @returns {boolean} True if supported
 */
export const isValidCoin = (coinId) => CRYPTO.SUPPORTED_COINS.has(coinId);

/**
 * Get metadata for a supported coin
 * @param {string} coinId - Cryptocurrency ID
 * @returns {Object|null} Coin metadata or null
 */
export const getCoinMetadata = (coinId) => 
  CRYPTO.COIN_METADATA[coinId] || null;