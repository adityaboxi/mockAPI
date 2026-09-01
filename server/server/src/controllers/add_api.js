// server/server/src/controllers/add_api.js
require('../opentelemetry/universal-logger');

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const SystemEventLog = require('../models/SystemEventLog');
const { storeMockDefinition } = require('../utils/redisMock');
const { addMockSyncJob } = require('../queues/mockSyncQueue');
const { redisClient } = require('../config/redis');

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

// ─── Helper: Get supported protocols by environment ───────────
function getSupportedProtocols() {
  if (process.env.SUPPORTED_PROTOCOLS) {
    return process.env.SUPPORTED_PROTOCOLS.split(',').map((p) => p.trim().toLowerCase());
  }
  const isProd = process.env.NODE_ENV === 'production';
  return isProd ? ['https'] : ['http'];
}

// ─── Helper: Build actual full URL with environment protocol ──
function buildActualFullUrl(protocol, host, projectId, version, urlPath, pathParams, queryParams) {
  const supported = getSupportedProtocols();
  const isProd = process.env.NODE_ENV === 'production';
  const defaultProtocol = isProd ? 'https' : 'http';

  const normalizedProtocol = (protocol || defaultProtocol).toLowerCase();
  const finalProtocol = supported.includes(normalizedProtocol) ? normalizedProtocol : defaultProtocol;

  const resolvedPath = (urlPath || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith(':')) {
        const paramKey = segment.substring(1);
        const param = pathParams ? pathParams.find((p) => p.key === paramKey) : null;
        return param ? param.value || `{${paramKey}}` : segment;
      }
      return segment;
    })
    .join('/');

  let fullUrl = `${finalProtocol}://${host}/p/${projectId}/${version}`;
  if (resolvedPath) {
    fullUrl += `/${resolvedPath}`;
  }

  if (queryParams && Array.isArray(queryParams) && queryParams.length) {
    const qs = queryParams
      .filter((q) => q.key && q.value)
      .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`)
      .join('&');
    if (qs) fullUrl += `?${qs}`;
  }

  return fullUrl;
}

// ─── Helper: Validate URL path ──────────────────────────────
function validateAndNormalizeUrlPath(urlpath) {
  if (!urlpath || typeof urlpath !== 'string') {
    return { valid: false, error: 'Invalid URL path' };
  }
  let normalized = urlpath.trim().replace(/^\/+|\/+$/g, '');
  if (!/^[a-zA-Z0-9/:_-]*$/.test(normalized)) {
    return { valid: false, error: 'URL path contains invalid characters' };
  }
  return { valid: true, path: normalized };
}

// ─── Main Controller ──────────────────────────────────────────
async function add_api(req, res) {
  const { project_id, urlpath, apihistorydata, airesponse } = req.body;
  const username = req.user?.username;

  if (!project_id || !urlpath || !apihistorydata) {
    return res.status(400).json({
      error: 'Missing required fields: project_id, urlpath, apihistorydata',
    });
  }

  const pathValidation = validateAndNormalizeUrlPath(urlpath);
  if (!pathValidation.valid) {
    return res.status(400).json({ error: pathValidation.error });
  }
  const cleanUrlPath = pathValidation.path;
  const aiResponseBool = airesponse === true || airesponse === 'true';

  try {
    const project = await Project.findOne({ id: project_id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.isActive) {
      return res.status(403).json({
        error: 'Cannot add APIs to an inactive project. Please activate the project first.',
      });
    }

    const isOwner = project.username === username;
    const isMember = project.members && project.members.includes(username);
    if (!isOwner && !isMember && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'You are not a member of this workspace' });
    }

    if (isOwner && !isMember) {
      await Project.updateOne({ id: project_id }, { $addToSet: { members: username } });
      if (!project.members) project.members = [];
      project.members.push(username);
    }

    const maxApis = project.issubdcribe ? 30 : 5;
    const currentNoofApis = project.noofApis || 0;
    if (currentNoofApis >= maxApis) {
      return res.status(403).json({
        error: `API limit reached. ${
          project.issubdcribe
            ? 'Subscribed projects can have up to 30 APIs.'
            : 'Unsubscribed projects can have up to 5 APIs. Please subscribe to increase the limit.'
        }`,
      });
    }

    let projectHistory = await ProjectApiHistory.findOne({
      $or: [{ projectID: project.id }, { projectCode: project.invitationCode }],
    });

    if (!projectHistory) {
      projectHistory = new ProjectApiHistory({
        projectID: project.id,
        projectCode: project.invitationCode,
        accessByUsernames: [username],
        endpoints: [],
      });
    } else if (!projectHistory.accessByUsernames.includes(username)) {
      projectHistory.accessByUsernames.push(username);
    }

    if (projectHistory.endpoints.some((ep) => ep.baseUrlPath === cleanUrlPath)) {
      return res.status(409).json({
        error: 'URL path already exists. Use /update-api to add a new version.',
      });
    }

    const {
      protocol,
      method,
      pathParams = [],
      queryParams = [],
      requestBody = null,
      responseBody = null,
      isAuthEnabled = false,
      authScheme = 'BearerAuth',
      latency = 0,
      rateLimit = 0,
      headers = [],
      responseHeaders = [],
      cookies = [],
      statusCode = 200,
      expectedToken = '',
      expectedApiKey = '',
    } = apihistorydata;

    if (!method) {
      return res.status(400).json({ error: 'HTTP method is required' });
    }

    const upperMethod = method.toUpperCase();
    if (!ALLOWED_METHODS.includes(upperMethod)) {
      return res.status(400).json({
        error: `Invalid method. Allowed: ${ALLOWED_METHODS.join(', ')}`,
      });
    }

    const SUPPORTED_PROTOCOLS = getSupportedProtocols();
    const isProd = process.env.NODE_ENV === 'production';
    const defaultProto = isProd ? 'https' : 'http';
    const normalizedProtocol = (protocol || defaultProto).toLowerCase();

    if (!SUPPORTED_PROTOCOLS.includes(normalizedProtocol)) {
      return res.status(400).json({
        error: `Protocol '${protocol}' not supported in ${isProd ? 'production' : 'development'}. Allowed: ${SUPPORTED_PROTOCOLS.join(', ')}`,
      });
    }

    const host = process.env.HOST || 'localhost:8080';
    const version = 'v1';
    const customId = project.id;

    const actualFullUrl = buildActualFullUrl(
      normalizedProtocol,
      host,
      customId,
      version,
      cleanUrlPath,
      pathParams,
      queryParams
    );

    let parsedStatus = Number(statusCode) || 200;
    if (parsedStatus < 100 || parsedStatus > 599) parsedStatus = 200;

    const newVersionObj = {
      protocol: normalizedProtocol,
      method: upperMethod,
      urlPath: cleanUrlPath,
      pathParams,
      queryParams,
      requestBody,
      responseBody,
      version,
      actualFullUrl,
      airesponse: aiResponseBool,
      isAuthEnabled: Boolean(isAuthEnabled),
      authScheme,
      latency: Math.max(0, Number(latency) || 0),
      rateLimit: Math.max(0, Number(rateLimit) || 0),
      headers,
      responseHeaders,
      cookies,
      statusCode: parsedStatus,
      expectedToken: expectedToken || '',
      expectedApiKey: expectedApiKey || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newEndpoint = {
      baseUrlPath: cleanUrlPath,
      versions: [newVersionObj],
      accessBy: [username],
      noofVersions: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    projectHistory.endpoints.push(newEndpoint);
    await projectHistory.save();

    await Project.updateOne({ id: project_id }, { $inc: { noofApis: 1 } });

    const definitionData = {
      projectId: customId,
      version,
      method: upperMethod,
      urlpath: cleanUrlPath,
      apihistorydata: newVersionObj,
    };

    try {
      await storeMockDefinition(customId, version, upperMethod, cleanUrlPath, definitionData);
    } catch (cacheErr) {
      console.warn('[add-api] storeMockDefinition warning:', cacheErr.message);
    }

    try {
      await addMockSyncJob('set', definitionData);
    } catch (queueErr) {
      console.warn('[add-api] addMockSyncJob warning:', queueErr.message);
    }

    let newLog = null;
    try {
      newLog = await SystemEventLog.create({
        projectId: project_id,
        method: upperMethod,
        url: cleanUrlPath,
        action: 'created',
        version,
        username,
        statusCode: 201,
        createdAt: new Date(),
      });
    } catch (logErr) {
      console.warn('[add-api] SystemEventLog warning:', logErr.message);
    }

    if (req.io && newLog && (!redisClient || !redisClient.isOpen)) {
      req.io.to(project_id).emit('new_api_log', newLog.toObject ? newLog.toObject() : newLog);
    }

    try {
      if (redisClient && redisClient.isOpen) {
        await redisClient.del(`api_history:${project_id}`);
        await redisClient.del(`user_apis:${username}`);
        await redisClient.del(`user:projects:${username}`);
        await redisClient.publish('api_history_update', JSON.stringify({ projectId: project_id }));
      } else if (req.io) {
        req.io.to(project_id).emit('api_history_update', { projectId: project_id });
      }
    } catch (_) {
      if (req.io) {
        req.io.to(project_id).emit('api_history_update', { projectId: project_id });
      }
    }

    return res.status(201).json({
      success: true,
      message: `New API endpoint '${cleanUrlPath}' created with version ${version}`,
      actualFullUrl,
      protocol: normalizedProtocol,
      version: version,
    });
  } catch (error) {
    console.error('[add-api] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

module.exports = add_api;