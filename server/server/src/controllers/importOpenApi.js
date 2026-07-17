const multer = require('multer');
const yaml = require('js-yaml');
const importQueue = require('../queues/importQueue');

const upload = multer({ storage: multer.memoryStorage() });

async function importOpenApi(req, res) {
  try {
    const { projectName } = req.body;
    const file = req.file;

    if (!projectName || !file) {
      return res.status(400).json({ error: 'Project name and file are required' });
    }

    const content = file.buffer.toString('utf-8');
    let spec;
    const isJson = file.originalname.endsWith('.json') || file.mimetype === 'application/json';
    
    try {
      spec = isJson ? JSON.parse(content) : yaml.load(content);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid file format: ' + err.message });
    }

    if (!spec || !spec.paths) {
      return res.status(400).json({ error: 'No paths found in OpenAPI spec' });
    }

    // ✅ Enqueue job – queue name must match the worker
    const job = await importQueue.add('import-openapi', {
      projectName,
      spec,
      username: req.user.username,
    });

    console.log(`[import-openapi] Job enqueued: ${job.id} for user ${req.user.username}`);

    res.status(202).json({ 
      jobId: job.id,
      message: 'Import queued successfully'
    });
  } catch (err) {
    console.error('[import-openapi] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { importOpenApi, upload };