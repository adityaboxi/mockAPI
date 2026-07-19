const multer = require('multer');
const yaml = require('js-yaml');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// ---------- Redis connection (same as your server) ----------
const REDIS_HOST = process.env.REDIS_HOST || 'redis-external';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const connectionOpts = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

// ---------- Queue instance ----------
const importQueue = new Queue('openapi-import', { connection: connectionOpts });

const upload = multer({ storage: multer.memoryStorage() });

async function importOpenApi(req, res) {
  try {
    const { projectName } = req.body;
    const file = req.file;

    // 1. Validate input
    if (!projectName || !file) {
      return res.status(400).json({ error: 'Project name and file are required' });
    }

    // 2. Parse file content
    const content = file.buffer.toString('utf-8');
    const isJson = file.originalname.endsWith('.json') || file.mimetype === 'application/json';
    let spec;

    try {
      spec = isJson ? JSON.parse(content) : yaml.load(content);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid file format: ' + err.message });
    }

    // 3. Validate OpenAPI spec
    if (!spec || !spec.paths || Object.keys(spec.paths).length === 0) {
      return res.status(400).json({ error: 'No paths found in OpenAPI spec' });
    }

    // 4. Enqueue job – queue name must match worker's queue
    const job = await importQueue.add('import', {
      projectName,
      spec,
      username: req.user.username,
    });

    console.log(`[import-openapi] Job enqueued: ${job.id} for user ${req.user.username}`);

    // 5. Respond with jobId for polling
    res.status(202).json({
      jobId: job.id,
      message: 'Import queued successfully. Poll /api/import-status/:jobId for progress.'
    });
  } catch (err) {
    console.error('[import-openapi] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { importOpenApi, upload };