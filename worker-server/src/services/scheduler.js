// worker-server/src/services/scheduler.js
import cron from 'node-cron';
import { PriceWorker } from '../workers/priceWorker.js';
import { logger } from '../config/logger.js';
import { AsyncLock } from '../utils/asyncLock.js';
import { validateCron } from '../validators/cronValidator.js';
import { metrics } from '../config/metrics.js';

export class CryptoUpdateScheduler {
  constructor() {
    this.lock = new AsyncLock();
    this.state = {
      isRunning: false,
      lastExecution: null,
      nextExecution: null,
      executionCount: 0,
      jobHistory: []
    };

    this.workerPool = Array.from({ length: process.env.WORKER_POOL_SIZE || 3 }, 
      () => new PriceWorker()
    );

    this.CONFIG = {
      maxConcurrent: 2,
      jobTimeout: 30000,
      timezone: 'UTC',
      missedExecutionPolicy: 'skip'
    };
  }

  start() {
    if (this.state.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    if (!validateCron(process.env.CRON_SCHEDULE)) {
      throw new Error('Invalid cron pattern');
    }

    this.job = cron.schedule(
      process.env.CRON_SCHEDULE,
      async () => {
        await this.lock.acquire('scheduler', async () => {
          await this._executeWithRetry();
        });
      },
      {
        scheduled: true,
        timezone: this.CONFIG.timezone,
        recoverMissedExecutions: this.CONFIG.missedExecutionPolicy === 'recover'
      }
    );

    this.state = {
      ...this.state,
      isRunning: true,
      nextExecution: this.job.nextDate().toISO(),
      startedAt: new Date()
    };

    logger.info('Scheduler started', {
      pattern: process.env.CRON_SCHEDULE,
      timezone: this.CONFIG.timezone,
      nextRun: this.state.nextExecution
    });

    this._startHealthServer();
  }

  async _executeWithRetry() {
    const jobId = Date.now();
    const startTime = Date.now();
    
    try {
      this.state.executionCount++;
      const currentWorker = this.workerPool[
        this.state.executionCount % this.workerPool.length
      ];

      logger.info('Job started', { jobId });

      const result = await Promise.race([
        currentWorker.execute(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Job timeout')), this.CONFIG.jobTimeout)
        )
      ]);

      this._recordExecution({
        jobId,
        status: 'success',
        duration: Date.now() - startTime,
        error: null
      });

      metrics.increment('jobs.success');
      logger.info('Job completed', { 
        jobId,
        duration: Date.now() - startTime
      });

    } catch (error) {
      this._recordExecution({
        jobId,
        status: 'failed',
        duration: Date.now() - startTime,
        error: error.message
      });

      metrics.increment('jobs.failed');
      logger.error('Job failed', { 
        jobId,
        error: error.message,
        stack: error.stack
      });

      if (this.CONFIG.missedExecutionPolicy === 'retry') {
        await this._scheduleRecovery();
      }
    } finally {
      this.state.lastExecution = new Date().toISOString();
      this.state.nextExecution = this.job.nextDate().toISO();
    }
  }

  async _scheduleRecovery() {
    logger.warn('Scheduling recovery job');
    setTimeout(() => {
      this.workerPool[0].execute().catch(() => {});
    }, 5000);
  }

  _recordExecution(execution) {
    this.state.jobHistory = [
      ...this.state.jobHistory.slice(-99), // Keep last 100 executions
      {
        ...execution,
        timestamp: new Date().toISOString()
      }
    ];
  }

  _startHealthServer() {
    this.healthServer = require('http').createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: this.state.isRunning ? 'running' : 'stopped',
        uptime: process.uptime(),
        ...this.state
      }));
    }).listen(process.env.HEALTH_PORT || 3002);
  }

  async stop() {
    if (!this.state.isRunning) return;

    this.job.stop();
    await Promise.all(
      this.workerPool.map(worker => worker.gracefulShutdown())
    );

    this.healthServer?.close();
    
    this.state = {
      ...this.state,
      isRunning: false,
      stoppedAt: new Date()
    };

    logger.info('Scheduler stopped', {
      totalExecutions: this.state.executionCount,
      lastExecution: this.state.lastExecution
    });
  }

  getStatus() {
    return {
      ...this.state,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }
}

// Process signal handlers
process
  .on('SIGTERM', () => this.stop())
  .on('SIGINT', () => this.stop());