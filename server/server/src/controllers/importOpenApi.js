require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const yaml = require('js-yaml');
const multer = require('multer');
const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const SystemEventLog = require('../models/SystemEventLog');
const { connectRedis } = require('../config/redis');
const importQueue = require('../queues/importQueue');
const projectQueue = require('../queues/projectQueue');
const { mockSyncQueue, addMockSyncJob } = require('../queues/mockSyncQueue');

// ---------- Multer configuration ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// ---------- Helper: Generate Project ID (username_projectName) ----------
function generateProjectId(username, projectName) {
  const sanitized = projectName.replace(/[^a-zA-Z0-9]/g, '_');
  return `${username}_${sanitized}`;
}

// ---------- Helper: Build actual full URL with project ID ----------
function buildActualFullUrl(protocol, host, projectId, version, urlPath, pathParams, queryParams) {
  let resolvedPath = urlPath || '';
  (pathParams || []).forEach(({ key, value }) => {
    resolvedPath = resolvedPath.replace(new RegExp(`:${key}`, 'g'), value || `{${key}}`);
  });

  if (resolvedPath.startsWith('/')) resolvedPath = resolvedPath.slice(1);
  let fullUrl = `${protocol}://${host}/p/${projectId}/${resolvedPath}`;

  if (queryParams?.length) {
    const qs = queryParams
      .filter((q) => q.key && q.value)
      .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`)
      .join('&');
    if (qs) fullUrl += `?${qs}`;
  }

  return fullUrl;
}

// ---------- Helper: Extract endpoints from spec ----------
function extractEndpointsFromSpec(spec) {
  const basePath = spec.basePath || '';
  const endpointsMap = {};

  Object.keys(spec.paths || {}).forEach((rawPath) => {
    const fullPath = basePath + rawPath;
    const pathObj = spec.paths[rawPath];

    Object.keys(pathObj || {}).forEach((method) => {
      if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) return;
      const operation = pathObj[method];
      const version = 'v1';
      const versionedPath = `/${version}${fullPath.startsWith('/') ? fullPath : `/${fullPath}`}`;

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
        pathParams: [],
        queryParams: operation?.parameters?.filter((p) => p.in === 'query').map((p) => ({ key: p.name, value: '' })) || [],
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

    if (!file) {
      return res.status(400).json({
        error: 'File is required',
        code: 'NO_FILE',
      });
    }

    if (!username) {
      return res.status(401).json({
        error: 'Authentication required - username not found',
        code: 'UNAUTHORIZED',
      });
    }

    let finalProjectId = projectId;
    if (!finalProjectId && projectName) {
      finalProjectId = generateProjectId(username, projectName);
    }

    if (!finalProjectId) {
      return res.status(400).json({
        error: 'Project ID or Project Name is required',
        code: 'PROJECT_ID_REQUIRED',
      });
    }

    const existingProject = await Project.findOne({
      id: finalProjectId,
      $or: [{ username: username }, { members: username }],
    }).lean();

    if (!existingProject) {
      const projectExists = await Project.findOne({ id: finalProjectId }).lean();
      if (projectExists) {
        return res.status(403).json({
          error: 'You do not have access to this project',
          code: 'PROJECT_ACCESS_DENIED',
          projectId: finalProjectId,
          message: 'You are not a member or creator of this project.',
        });
      }

      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
        projectId: finalProjectId,
        message: `Project "${finalProjectId}" does not exist. Please create it first.`,
      });
    }

    const content = file.buffer.toString('utf-8');
    const isJson = file.originalname?.endsWith('.json') || file.mimetype === 'application/json';
    let spec;

    try {
      spec = isJson ? JSON.parse(content) : yaml.load(content);
    } catch (err) {
      return res.status(400).json({
        error: 'Invalid file format: ' + err.message,
        code: 'INVALID_FORMAT',
      });
    }

    if (!spec || !spec.paths || Object.keys(spec.paths).length === 0) {
      return res.status(400).json({
        error: 'No paths found in OpenAPI spec',
        code: 'NO_PATHS',
      });
    }

    const endpoints = extractEndpointsFromSpec(spec);
    if (endpoints.length === 0) {
      return res.status(400).json({
        error: 'No valid endpoints found in the OpenAPI spec',
        code: 'NO_ENDPOINTS',
      });
    }

    const protocol = process.env.PROTOCOL || 'http';
    const host = process.env.HOST || 'localhost:8080';

    for (const endpoint of endpoints) {
      for (const ver of endpoint.versions) {
        ver.actualFullUrl = buildActualFullUrl(
          protocol,
          host,
          finalProjectId,
          ver.version,
          ver.urlPath,
          ver.pathParams || [],
          ver.queryParams || []
        );
        ver.protocol = protocol;
      }
    }

    let projectHistory = await ProjectApiHistory.findOne({
      $or: [{ projectID: finalProjectId }, { projectCode: existingProject.invitationCode }],
    });

    if (projectHistory) {
      projectHistory.endpoints = endpoints;
      projectHistory.updatedAt = new Date();
      await projectHistory.save();
    } else {
      projectHistory = new ProjectApiHistory({
        projectID: finalProjectId,
        projectCode: existingProject.invitationCode || finalProjectId,
        accessByUsernames: [username],
        endpoints: endpoints,
      });
      await projectHistory.save();
    }

    const systemLogs = [];
    for (const endpoint of endpoints) {
      for (const ver of endpoint.versions) {
        systemLogs.push({
          projectId: finalProjectId,
          username: username,
          action: 'created',
          method: ver.method,
          url: ver.urlPath,
          version: ver.version,
          accessByUsername: [username],
          statusCode: 201,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    if (systemLogs.length > 0) {
      await SystemEventLog.insertMany(systemLogs);
    }

    try {
      const client = await connectRedis();
      if (client.isOpen) {
        await client.publish('api_history_update', JSON.stringify({ projectId: finalProjectId }));
      }
    } catch (_) {}

    await projectQueue.add('create-or-update-project', {
      action: 'update',
      projectId: finalProjectId,
      isActive: true,
    });

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
            protocol: ver.protocol || protocol,
            requestBody: ver.requestBody,
            responseBody: ver.responseBody,
            statusCode: ver.statusCode || 200,
            summary: ver.summary || '',
            description: ver.description || '',
            actualFullUrl: ver.actualFullUrl,
          },
        });
        apiCount++;
      }
    }

    const job = await importQueue.add('import', {
      projectId: finalProjectId,
      projectName: existingProject.projectname,
      spec,
      username,
      endpointsCount: endpoints.length,
      apiCount: apiCount,
    });

    return res.status(202).json({
      success: true,
      jobId: job.id,
      projectId: finalProjectId,
      projectName: existingProject.projectname,
      endpoints: endpoints.length,
      apiCount: apiCount,
      message: `Import queued successfully. Poll /api/import-status/${job.id} for progress.`,
    });
  } catch (err) {
    console.error('[import-openapi] Error:', err.message);
    return res.status(500).json({
      error: 'Failed to import OpenAPI spec',
      code: 'INTERNAL_ERROR',
      details: err.message,
    });
  }
}

module.exports = { importOpenApi, upload };