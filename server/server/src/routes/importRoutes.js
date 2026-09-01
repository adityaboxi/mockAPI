const express = require('express');
require('../opentelemetry/universal-logger');

const { importOpenApi, upload } = require('../controllers/importOpenApi');
const getImportStatus = require('../controllers/importStatus');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/import-openapi - Upload and import OpenAPI spec
router.post('/import-openapi', authenticateToken, upload.single('file'), importOpenApi);

// GET /api/import-status/:jobId - Check import job status
router.get('/import-status/:jobId', authenticateToken, getImportStatus);

module.exports = router;




