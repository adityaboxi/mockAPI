require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
async function api_version_data(req, res) {
const { projectId, username, baseurlpath, version } = req.body;
const authUsername = req.user?.username;
if (!projectId || !username || !baseurlpath || !version) {
return res.status(400).json({ error: 'Missing required fields: projectId, username, baseurlpath, version' });
  }
if (authUsername !== username) {
return res.status(403).json({ error: 'Access denied' });
  }
try {
const project = await Project.findOne({ id: projectId });
if (!project) {
return res.status(404).json({ error: 'Project not found' });
    }
const isMember = project.username === username || (project.members && project.members.includes(username));
if (!isMember) {
return res.status(403).json({ error: 'Access denied – not a member' });
    }
const projectHistory = await ProjectApiHistory.findOne({ projectCode: project.invitationCode });
if (!projectHistory) {
return res.status(404).json({ error: 'API history not found for this project' });
    }
const endpoint = projectHistory.endpoints.find(ep => ep.baseUrlPath === baseurlpath);
if (!endpoint) {
      console.error(`[api-version-data] Endpoint ${baseurlpath} not found in project ${projectId}`);
return res.status(404).json({ error: 'Endpoint not found' });
    }
const versionData = endpoint.versions.find(v => v.version === version);
if (!versionData) {
      console.error(`[api-version-data] Version ${version} not found in endpoint ${baseurlpath}. Available: ${endpoint.versions.map(v => v.version).join(', ')}`);
return res.status(404).json({ error: 'Version not found' });
    }
    res.status(200).json({
      success: true,
      data: {
        protocol: versionData.protocol,
        method: versionData.method,
        urlPath: versionData.urlPath,
        pathParams: versionData.pathParams || [],
        queryParams: versionData.queryParams || [],
        requestBody: versionData.requestBody,
        responseBody: versionData.responseBody,
        version: versionData.version,
        actualFullUrl: versionData.actualFullUrl,
        includeAiresponse: versionData.airesponse || false,
        isAuthEnabled: versionData.isAuthEnabled || false,
        authScheme: versionData.authScheme || 'BearerAuth',
        latency: versionData.latency || 0,
        rateLimit: versionData.rateLimit || 0,
        headers: versionData.headers || [],
        responseHeaders: versionData.responseHeaders || [],
        cookies: versionData.cookies || [],
        statusCode: versionData.statusCode || 200,
        expectedToken: versionData.expectedToken || '',
        expectedApiKey: versionData.expectedApiKey || '',
      }
    });
  } catch (error) {
    console.error('[api-version-data] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
module.exports = api_version_data;




/*
const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { internalRedis } = require('../config/redis');

const CACHE_TTL = 60; // seconds

async function api_version_data(req, res) {
  const { projectId, username, baseurlpath, version } = req.body;

  // Validate required fields
  if (!projectId || !username || !baseurlpath || !version) {
    return res.status(400).json({ error: 'Missing required fields: projectId, username, baseurlpath, version' });
  }

  // Authenticated user must match the requested username
  if (req.user.username !== username) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Build cache key
  const cacheKey = `cache:${username}:api_version_data:${projectId}:${baseurlpath}:${version}`;

  // 1. Try to serve from Redis cache
  try {
    const cached = await internalRedis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return res.status(200).json({ success: true, data });
    }
  } catch (err) {
    // Redis error – fall through to database
  }

  try {
    const project = await Project.findOne({ id: projectId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isMember = project.username === username || (project.members && project.members.includes(username));
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied – not a member' });
    }

    const projectHistory = await ProjectApiHistory.findOne({ projectCode: project.invitationCode });
    if (!projectHistory) {
      return res.status(404).json({ error: 'API history not found for this project' });
    }

    const endpoint = projectHistory.endpoints.find(ep => ep.baseUrlPath === baseurlpath);
    if (!endpoint) {
      console.error(`[api-version-data] Endpoint ${baseurlpath} not found in project ${projectId}`);
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    const versionData = endpoint.versions.find(v => v.version === version);
    if (!versionData) {
      console.error(`[api-version-data] Version ${version} not found in endpoint ${baseurlpath}. Available: ${endpoint.versions.map(v => v.version).join(', ')}`);
      return res.status(404).json({ error: 'Version not found' });
    }

    // Build response data
    const data = {
      protocol: versionData.protocol,
      method: versionData.method,
      urlPath: versionData.urlPath,
      pathParams: versionData.pathParams || [],
      queryParams: versionData.queryParams || [],
      requestBody: versionData.requestBody,
      responseBody: versionData.responseBody,
      version: versionData.version,
      actualFullUrl: versionData.actualFullUrl,
      includeAiresponse: versionData.airesponse || false,
      isAuthEnabled: versionData.isAuthEnabled || false,
      authScheme: versionData.authScheme || 'BearerAuth',
      latency: versionData.latency || 0,
      rateLimit: versionData.rateLimit || 0,
      headers: versionData.headers || [],
      responseHeaders: versionData.responseHeaders || [],
      cookies: versionData.cookies || [],
      statusCode: versionData.statusCode || 200,
      expectedToken: versionData.expectedToken || '',
      expectedApiKey: versionData.expectedApiKey || '',
    };

    // 2. Store in Redis cache
    try {
      await internalRedis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
    } catch (err) {
      // Cache set failed – no problem
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[api-version-data] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = api_version_data;*/