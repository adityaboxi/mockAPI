// server/queues/aiQueue.js
require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const { Queue } = require('bullmq');

const connectionOpts = {
  url: process.env.REDIS_URL || 'redis://redis-external:6379',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    return Math.min(times * 100, 3000);
  },
};

const aiQueue = new Queue('ai-queue', {
  connection: connectionOpts,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed job metadata for 1 hour
      count: 1000, // Keep last 1,000 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed job trace for 24 hours
      count: 2000, // Keep last 2,000 failed jobs for debugging
    },
  },
});

// Intercept queue errors to prevent unhandled node process termination
aiQueue.on('error', (err) => {
  console.error('[aiQueue] Redis connection or BullMQ internal error:', err.message);
});

module.exports = aiQueue;