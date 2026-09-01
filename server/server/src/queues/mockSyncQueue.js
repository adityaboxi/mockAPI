require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const { Queue } = require('bullmq');

const connectionOpts = {
  url: process.env.REDIS_URL || 'redis://redis-external:6379',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const mockSyncQueue = new Queue('mockSyncQueue', {
  connection: connectionOpts,
});

async function addMockSyncJob(action, data) {
  if (!['set', 'delete'].includes(action)) {
    throw new Error(`[Queue] Invalid action: ${action}`);
  }
  try {
    const job = await mockSyncQueue.add('sync', { action, ...data }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    return job;
  } catch (err) {
    console.error('[Queue] Failed to add job:', err.message);
    throw err;
  }
}

module.exports = { mockSyncQueue, addMockSyncJob };


