const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// ---------- Redis connection (matching server.js) ----------
const REDIS_HOST = process.env.REDIS_HOST || 'redis-external';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const connectionOpts = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

// ---------- Queue instance (must match worker's queue name) ----------
const importQueue = new Queue('openapi-import', { connection: connectionOpts });

async function getImportStatus(req, res) {
  try {
    const { jobId } = req.params;
    const job = await importQueue.getJob(jobId);

    if (!job) {
      console.warn(`[import-status] Job ${jobId} not found`);
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const result = job.returnvalue;
    const progress = job.progress || 0;

    console.log(`[import-status] Job ${jobId} state: ${state}, progress: ${progress}, result:`, result);

    // Map states to frontend‑friendly format
    if (state === 'completed') {
      return res.json({
        status: 'completed',
        message: '✅ Import successful',
        detail: result
          ? `Project "${result.name || 'Untitled'}" created with ${result.endpoints || 0} endpoints.`
          : 'Import completed.',
        progress: 100,
        result, // optional, for debugging
      });
    } else if (state === 'failed') {
      return res.json({
        status: 'failed',
        message: '❌ Import failed',
        detail: job.failedReason || 'Unknown error occurred',
        progress: 0,
      });
    } else {
      // active, waiting, delayed, paused, etc. – all become 'loading'
      return res.json({
        status: 'loading',
        message: '⏳ Processing...',
        detail: progress > 0
          ? `${Math.round(progress)}% complete`
          : 'Worker is creating project and endpoints.',
        progress: progress,
      });
    }
  } catch (err) {
    console.error('[import-status] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to check job status' });
  }
}

module.exports = getImportStatus;