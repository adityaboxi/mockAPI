const express = require('express');
const { importOpenApi, upload } = require('../controllers/importOpenApi');
const getImportStatus = require('../controllers/importStatus');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/import-openapi', authenticateToken, upload.single('file'), importOpenApi);

router.get('/import-status/:jobId', authenticateToken, getImportStatus);

module.exports = router;