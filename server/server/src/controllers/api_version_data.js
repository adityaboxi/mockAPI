// server/controllers/api_version_data.js
require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { connectRedis } = require('../config/redis');

const CACHE_TTL = 60; // 1 minute cache TTL

async function api_version_data(req, res) {
  const { projectId, username, baseurlpath, version } = req.body;
  const authUsername = req.user?.username;

  if (!projectId || !username || !baseurlpath || !version) {
    return res.status(400).json({
      error: 'Missing required fields: projectId, username, baseurlpath, version',
    });
  }

  if (authUsername !== username && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: User mismatch' });
  }

  const cleanPath = String(baseurlpath).trim().replace(/^\/+|\/+$/g, '');
  const cacheKey = `api_version:${projectId}:${encodeURIComponent(cleanPath)}:${version}`;

  try {
    const client = await connectRedis();
    if (client && client.isOpen) {
      const cached = await client.get(cacheKey);
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    }
  } catch (_) {}

  try {
    const project = await Project.findOne({ id: projectId }).lean();
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isMember =
      project.username === username ||
      (project.members && project.members.includes(username)) ||
      req.user?.role === 'admin';

    if (!isMember) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
    }

    const projectHistory = await ProjectApiHistory.findOne({
      $or: [{ projectID: project.id }, { projectCode: project.invitationCode }],
    }).lean();

    if (!projectHistory) {
      return res.status(404).json({ error: 'API history not found for this workspace' });
    }

    const endpoint = (projectHistory.endpoints || []).find(
      (ep) =>
        ep.baseUrlPath === cleanPath ||
        ep.baseUrlPath === `/${cleanPath}` ||
        ep.baseUrlPath.replace(/^\/+|\/+$/g, '') === cleanPath
    );

    if (!endpoint) {
      return res.status(404).json({ error: `Endpoint '${cleanPath}' not found in workspace history` });
    }

    const versionData = (endpoint.versions || []).find((v) => v.version === version);
    if (!versionData) {
      return res.status(404).json({ error: `Version '${version}' not found for endpoint '${cleanPath}'` });
    }

    const isProd = process.env.NODE_ENV === 'production';
    const defaultProtocol = isProd ? 'https' : 'http';

    const responsePayload = {
      success: true,
      data: {
        protocol: versionData.protocol || defaultProtocol,
        method: versionData.method || 'GET',
        urlPath: versionData.urlPath || cleanPath,
        pathParams: versionData.pathParams || [],
        queryParams: versionData.queryParams || [],
        requestBody: versionData.requestBody || null,
        responseBody: versionData.responseBody || null,
        version: versionData.version || version,
        actualFullUrl: versionData.actualFullUrl || '',
        includeAiresponse: versionData.airesponse === true || versionData.includeAiresponse === true,
        isAuthEnabled: Boolean(versionData.isAuthEnabled),
        authScheme: versionData.authScheme || 'BearerAuth',
        latency: Number(versionData.latency) || 0,
        rateLimit: Number(versionData.rateLimit) || 0,
        headers: versionData.headers || [],
        responseHeaders: versionData.responseHeaders || [],
        cookies: versionData.cookies || [],
        statusCode: Number(versionData.statusCode) || 200,
        expectedToken: versionData.expectedToken || '',
        expectedApiKey: versionData.expectedApiKey || '',
      },
    };

    try {
      const client = await connectRedis();
      if (client && client.isOpen) {
        await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(responsePayload));
      }
    } catch (_) {}

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('[api-version-data] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

module.exports = api_version_data;