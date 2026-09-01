require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const importQueue = require('../queues/importQueue');

async function getImportStatus(req, res) {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        error: 'Job ID is required',
        code: 'JOB_ID_REQUIRED',
      });
    }

    const job = await importQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
      });
    }

    const state = await job.getState();
    const progress = job.progress || 0;
    const result = job.returnvalue;
    const failedReason = job.failedReason;

    let status = 'processing';
    let message = 'Processing...';
    let detail = '';

    if (state === 'completed') {
      status = 'completed';
      message = 'Import completed successfully';
      detail = result ? `Imported ${result.endpointsCount || 0} endpoints` : '';
    } else if (state === 'failed') {
      status = 'failed';
      message = 'Import failed';
      detail = failedReason || 'Unknown error';
    } else if (['waiting', 'active', 'delayed'].includes(state)) {
      status = 'processing';
      message = `Import in progress (${Math.round(progress)}%)`;
      detail = 'The import job is being processed.';
    } else {
      status = 'unknown';
      message = `Job state: ${state}`;
    }

    return res.json({
      jobId,
      status,
      progress,
      message,
      detail,
      result: state === 'completed' ? result : undefined,
    });
  } catch (err) {
    console.error('[import-status] Error:', err.message);
    return res.status(500).json({
      error: 'Failed to check job status',
      code: 'STATUS_CHECK_FAILED',
      details: err.message,
    });
  }
}

module.exports = getImportStatus;