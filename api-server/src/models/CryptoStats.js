import mongoose from 'mongoose';

const cryptoStatsSchema = new mongoose.Schema({
  coinId: {
    type: String,
    required: true,
    enum: ['bitcoin', 'ethereum', 'matic-network'],
    index: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  marketCap: {
    type: Number,
    required: true,
    min: 0
  },
  change24h: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for efficient querying of latest stats
cryptoStatsSchema.index({ coinId: 1, timestamp: -1 });

// Index for deviation calculation
cryptoStatsSchema.index({ coinId: 1, timestamp: -1 }, { 
  partialFilterExpression: { price: { $exists: true } }
});

// Add TTL index to automatically remove old data (optional)
// cryptoStatsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30 days

export const CryptoStats = mongoose.model('CryptoStats', cryptoStatsSchema); 