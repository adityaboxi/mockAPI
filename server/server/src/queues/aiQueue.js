// server/server/src/queues/aiQueue.js
require('../opentelemetry/universal-logger');

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
      delay: 2000, // 2s -> 4s -> 8s backoff on AI provider rate limits
    },
    removeOnComplete: {
      age: 3600,  // Keep completed jobs for 1 hour
      count: 1000, // Retain last 1,000 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours for debugging
      count: 2000,
    },
  },
});

aiQueue.on('error', (err) => {
  console.error('[aiQueue] Redis connection or BullMQ internal error:', err.message);
});

module.exports = aiQueue;