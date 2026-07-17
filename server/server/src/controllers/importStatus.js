// server/src/controllers/importStatus.js
const importQueue = require('../queues/importQueue');

async function getImportStatus(req, res) {
  try {
    const { jobId } = req.params;
    const job = await importQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const result = job.returnvalue;
    const progress = job.progress || 0;

    console.log(`[import-status] Job ${jobId} state: ${state}, progress: ${progress}`);

    // Map all non‑terminal states to 'loading'
    if (state === 'completed') {
      return res.json({
        status: 'completed',
        message: '✅ Import successful',
        detail: `Project "${result?.name || 'Untitled'}" created with ${result?.endpoints || 0} endpoints.`,
        progress: 100,
      });
    } else if (state === 'failed') {
      return res.json({
        status: 'failed',
        message: '❌ Import failed',
        detail: job.failedReason || 'Unknown error occurred',
        progress: 0,
      });
    } else {
      // active, waiting, delayed, etc. – all become 'loading'
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
    res.status(500).json({ error: err.message });
  }
}

module.exports = getImportStatus;