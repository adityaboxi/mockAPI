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

    if (state === 'completed') {
      return res.json({
        status: 'completed',
        message: '✅ Import successful',
        detail: `Project "${result?.name || 'Untitled'}" created with ${result?.endpoints || 0} endpoints.`,
        progress: 100
      });
    } else if (state === 'failed') {
      return res.json({
        status: 'failed',
        message: '❌ Import failed',
        detail: job.failedReason || 'Unknown error occurred',
        progress: 0
      });
    } else if (state === 'active') {
      return res.json({
        status: 'processing',
        message: '⏳ Processing...',
        detail: progress > 0 ? `${Math.round(progress)}% complete` : 'Worker is creating project and endpoints.',
        progress: progress
      });
    } else {
      return res.json({
        status: 'queued',
        message: '⏳ Queued...',
        detail: 'Waiting for worker to pick up the job.',
        progress: 0
      });
    }
  } catch (err) {
    console.error('[import-status] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = getImportStatus;