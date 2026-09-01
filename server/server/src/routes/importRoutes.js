// server/routes/openApiRoutes.js
require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const express = require('express');
const multer = require('multer');
const { importOpenApi, upload } = require('../controllers/importOpenApi');
const getImportStatus = require('../controllers/importStatus');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Middleware wrapper to handle Multer upload errors gracefully.
 */
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds allowed limit (max 10MB).' });
      }
      return res.status(400).json({ error: `File upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message || 'Invalid file uploaded.' });
    }
    next();
  });
};

/**
 * @route   POST /api/import-openapi
 * @desc    Upload and import OpenAPI / Swagger JSON or YAML specification
 * @access  Private (Authenticated)
 */
router.post('/import-openapi', authenticateToken, handleUpload, importOpenApi);

/**
 * @route   GET /api/import-status/:jobId
 * @desc    Check asynchronous OpenAPI import worker progress
 * @access  Private (Authenticated)
 */
router.get('/import-status/:jobId', authenticateToken, (req, res, next) => {
  const { jobId } = req.params;
  if (!jobId || !jobId.trim()) {
    return res.status(400).json({ error: 'Valid jobId parameter is required.' });
  }
  next();
}, getImportStatus);

module.exports = router;