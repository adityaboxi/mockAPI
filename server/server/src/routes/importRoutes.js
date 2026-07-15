const express = require('express');
const { importOpenApi, upload } = require('../controllers/importOpenApi');
const getImportStatus = require('../controllers/importStatus');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/import-openapi – upload and queue
router.post('/import-openapi', authenticateToken, upload.single('file'), importOpenApi);

// GET /api/import-status/:jobId – poll job status
router.get('/import-status/:jobId', authenticateToken, getImportStatus);

module.exports = router;