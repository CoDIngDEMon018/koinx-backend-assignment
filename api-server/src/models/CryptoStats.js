import mongoose from 'mongoose';

const cryptoSchema = new mongoose.Schema({
  coinId: {
    type: String,
    required: true,
    enum: ['bitcoin', 'ethereum', 'matic-network']
  },
  price: {
    type: Number,
    required: true
  },
  marketCap: {
    type: Number,
    required: true
  },
  change24h: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for efficient querying
cryptoSchema.index({ coinId: 1, timestamp: -1 });

export const CryptoStats = mongoose.model('CryptoStats', cryptoSchema); 