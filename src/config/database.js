import mongoose from 'mongoose';
import { logger } from './logger.js';

// Global configuration for production safety
mongoose.set('strictQuery', true); // Enable strict query mode
mongoose.set('autoIndex', false); // Disable automatic index creation
mongoose.set('bufferCommands', false); // Disable command buffering
mongoose.set('bufferTimeoutMS', 0); // Immediate failure on disconnected state

export const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Fast failure on initial connection
      maxPoolSize: 10, // Optimal for most applications
      minPoolSize: 2, // Maintain minimum connections
      socketTimeoutMS: 30000, // Close idle connections after 30s
      heartbeatFrequencyMS: 10000, // Regular connection checks
      retryWrites: true, // Enable retryable writes
      w: 'majority', // Write concern for production
      appName: 'crypto-stats-api', // Identify in MongoDB logs
      family: 4, // Force IPv4 to avoid DNS issues
    });

    logger.info(`MongoDB Connected: ${conn.connection.host} [v${conn.connection.version}]`);
  } catch (error) {
    logger.error('Database connection error:', {
      message: error.message,
      stack: error.stack,
      host: error.hostname || 'unknown',
    });
    process.exit(1);
  }
};

// Comprehensive connection event handling
mongoose.connection.on('connecting', () => {
  logger.debug('MongoDB: Establishing connection...');
});

mongoose.connection.on('connected', () => {
  logger.info('MongoDB: Connection established');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB: Connection lost');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB: Connection restored');
});

mongoose.connection.on('close', () => {
  logger.warn('MongoDB: Connection closed permanently');
});

mongoose.connection.on('error', (error) => {
  logger.error('MongoDB driver error:', {
    name: error.name,
    message: error.message,
    code: error.code,
    codeName: error.codeName,
  });
});

// Graceful shutdown handler
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close(true);
    logger.info('MongoDB: Connection closed through app termination');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to close MongoDB connection:', error);
    process.exit(1);
  }
});