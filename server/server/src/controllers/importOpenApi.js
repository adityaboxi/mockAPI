const yaml = require('js-yaml');
const multer = require('multer');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const SystemEventLog = require('../models/SystemEventLog');

// ---------- Multer configuration ----------
const upload = multer({ storage: multer.memoryStorage() });

// ---------- Redis connection ----------
const REDIS_HOST = process.env.REDIS_HOST || 'redis-external';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const connectionOpts = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

// ---------- Queue instances ----------
const importQueue = new Queue('openapi-import', { connection: connectionOpts });
const projectQueue = new Queue('projectQueue', { connection: connectionOpts });
const mockSyncQueue = new Queue('mockSyncQueue', { connection: connectionOpts });

// ---------- Helper: Generate Project ID ----------
function generateProjectId(username, projectName) {
  const sanitized = projectName.replace(/[^a-zA-Z0-9]/g, '_');
  return `${username}_${sanitized}`;
}

// ---------- Helper: Extract endpoints from spec ----------
function extractEndpointsFromSpec(spec) {
  const basePath = spec.basePath || '';
  const endpointsMap = {};

  Object.keys(spec.paths || {}).forEach(rawPath => {
    const fullPath = basePath + rawPath;
    const pathObj = spec.paths[rawPath];

    Object.keys(pathObj || {}).forEach(method => {
      if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) return;
      const operation = pathObj[method];
      const version = 'v1';
      const versionedPath = `/${version}${fullPath}`;

      if (!endpointsMap[fullPath]) {
        endpointsMap[fullPath] = { baseUrlPath: fullPath, versions: [] };
      }

      endpointsMap[fullPath].versions.push({
        method: method.toUpperCase(),
        urlPath: versionedPath,
        version: version,
        protocol: 'https',
        statusCode: 200,
        requestBody: operation?.requestBody?.content?.['application/json']?.schema?.example || null,
        responseBody: operation?.responses?.['200']?.content?.['application/json']?.schema?.example || null,
        summary: operation?.summary || '',
        description: operation?.description || '',
        operationId: operation?.operationId || `${method}_${rawPath.replace(/\//g, '_')}`,
      });
    });
  });

  return Object.values(endpointsMap);
}

// ---------- Main import controller ----------
async function importOpenApi(req, res) {
  try {
    const { projectId, projectName } = req.body;
    const file = req.file;
    const username = req.user?.username || req.user?.email || req.user?.id;

    // =============================================================
    // STEP 1: VALIDATE INPUT
    // =============================================================
    if (!file) {
      return res.status(400).json({ 
        error: 'File is required',
        code: 'NO_FILE'
      });
    }

    if (!username) {
      return res.status(401).json({ 
        error: 'Authentication required - username not found',
        code: 'UNAUTHORIZED'
      });
    }

    // =============================================================
    // STEP 2: DETERMINE PROJECT ID
    // =============================================================
    let finalProjectId = projectId;

    if (!finalProjectId && projectName) {
      finalProjectId = generateProjectId(username, projectName);
    }

    if (!finalProjectId) {
      return res.status(400).json({ 
        error: 'Project ID or Project Name is required',
        code: 'PROJECT_ID_REQUIRED'
      });
    }

    console.log(`[import-openapi] Processing import for project: ${finalProjectId} by user: ${username}`);

    // =============================================================
    // STEP 3: CHECK IF PROJECT EXISTS IN DATABASE
    // =============================================================
    const existingProject = await Project.findOne({ 
      id: finalProjectId,
      $or: [
        { username: username },                    // User is the creator
        { members: { $in: [username] } }          // User is a member
      ]
    });

    // 🚨 CRITICAL: If project doesn't exist, FUCK OFF
    if (!existingProject) {
      console.warn(`[import-openapi] ❌ Project not found or user not authorized: ${finalProjectId}`);
      
      const projectExists = await Project.findOne({ id: finalProjectId });
      
      if (projectExists) {
        return res.status(403).json({
          error: 'You do not have access to this project',
          code: 'PROJECT_ACCESS_DENIED',
          projectId: finalProjectId,
          message: 'You are not a member or creator of this project. Please ask the project owner to add you.'
        });
      }
      
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
        projectId: finalProjectId,
        message: `Project "${finalProjectId}" does not exist. Please create it first or select an existing project.`
      });
    }

    console.log(`[import-openapi] ✅ Project exists: ${finalProjectId} (${existingProject.projectname})`);

    // =============================================================
    // STEP 4: PARSE FILE CONTENT
    // =============================================================
    const content = file.buffer.toString('utf-8');
    const isJson = file.originalname.endsWith('.json') || file.mimetype === 'application/json';
    let spec;

    try {
      spec = isJson ? JSON.parse(content) : yaml.load(content);
    } catch (err) {
      return res.status(400).json({ 
        error: 'Invalid file format: ' + err.message,
        code: 'INVALID_FORMAT'
      });
    }

    // =============================================================
    // STEP 5: VALIDATE OPENAPI SPEC
    // =============================================================
    if (!spec || !spec.paths || Object.keys(spec.paths).length === 0) {
      return res.status(400).json({ 
        error: 'No paths found in OpenAPI spec',
        code: 'NO_PATHS'
      });
    }

    // =============================================================
    // STEP 6: EXTRACT ENDPOINTS
    // =============================================================
    const endpoints = extractEndpointsFromSpec(spec);
    console.log(`[import-openapi] Extracted ${endpoints.length} endpoints`);

    if (endpoints.length === 0) {
      return res.status(400).json({ 
        error: 'No valid endpoints found in the OpenAPI spec',
        code: 'NO_ENDPOINTS'
      });
    }

    // =============================================================
    // STEP 7: SAVE TO PROJECT API HISTORY
    // =============================================================
    let projectHistory = await ProjectApiHistory.findOne({ projectID: finalProjectId });

    if (projectHistory) {
      projectHistory.endpoints = endpoints;
      projectHistory.updatedAt = new Date();
      await projectHistory.save();
      console.log(`[import-openapi] Updated ProjectApiHistory for: ${finalProjectId}`);
    } else {
      projectHistory = new ProjectApiHistory({
        projectID: finalProjectId,
        projectCode: finalProjectId,
        accessByUsernames: [username],
        endpoints: endpoints,
      });
      await projectHistory.save();
      console.log(`[import-openapi] Created ProjectApiHistory for: ${finalProjectId}`);
    }

    // =============================================================
    // STEP 8: CREATE SYSTEM EVENT LOGS
    // =============================================================
    const systemLogs = [];
    for (const endpoint of endpoints) {
      for (const ver of endpoint.versions) {
        systemLogs.push({
          projectId: finalProjectId,
          username: username,
          action: 'updated',
          method: ver.method,
          url: ver.urlPath,
          version: ver.version,
          accessByUsername: [username],
          statusCode: 201,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    if (systemLogs.length > 0) {
      await SystemEventLog.insertMany(systemLogs);
      console.log(`[import-openapi] Created ${systemLogs.length} system event logs`);
    }

    // =============================================================
    // STEP 9: PUBLISH TO REDIS
    // =============================================================
    try {
      const redisClient = new IORedis(connectionOpts);
      await redisClient.publish('api_history_update', JSON.stringify({ projectId: finalProjectId }));
      await redisClient.quit();
      console.log(`[import-openapi] Published API history update for: ${finalProjectId}`);
    } catch (err) {
      console.error('[import-openapi] Failed to publish history update:', err);
    }

    // =============================================================
    // STEP 10: ENQUEUE BULLMQ JOBS
    // =============================================================
    
    // 10a. Enqueue project container job
    await projectQueue.add('create-or-update-project', {
      action: 'update',
      projectId: finalProjectId,
      isActive: true,
    });
    console.log(`[import-openapi] Enqueued project container job for: ${finalProjectId}`);

    // 10b. Enqueue mock sync jobs for each API
    let apiCount = 0;
    for (const endpoint of endpoints) {
      for (const ver of endpoint.versions) {
        await mockSyncQueue.add('sync-api', {
          action: 'set',
          projectId: finalProjectId,
          versionData: {
            version: ver.version,
            method: ver.method,
            urlPath: ver.urlPath,
            protocol: ver.protocol || 'https',
            requestBody: ver.requestBody,
            responseBody: ver.responseBody,
            statusCode: ver.statusCode || 200,
            summary: ver.summary || '',
            description: ver.description || '',
          }
        });
        apiCount++;
      }
    }
    console.log(`[import-openapi] Enqueued ${apiCount} API sync jobs for: ${finalProjectId}`);

    // 10c. Enqueue the main import job for status tracking
    const job = await importQueue.add('import', {
      projectId: finalProjectId,
      projectName: existingProject.projectname,
      spec,
      username,
      endpointsCount: endpoints.length,
      apiCount: apiCount,
    });

    console.log(`[import-openapi] Job enqueued: ${job.id} for user ${username}`);

    // =============================================================
    // STEP 11: RETURN SUCCESS RESPONSE
    // =============================================================
    res.status(202).json({
      success: true,
      jobId: job.id,
      projectId: finalProjectId,
      projectName: existingProject.projectname,
      endpoints: endpoints.length,
      apiCount: apiCount,
      message: `Import queued successfully. Poll /api/import-status/${job.id} for progress.`
    });

  } catch (err) {
    console.error('[import-openapi] Error:', err);
    res.status(500).json({ 
      error: 'Failed to import OpenAPI spec',
      code: 'INTERNAL_ERROR',
      details: err.message 
    });
  }
}

module.exports = { importOpenApi, upload };


