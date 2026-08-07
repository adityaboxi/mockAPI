require('../opentelemetry/universal-logger');  // <-- Add this line FIRST
const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const SystemEventLog = require('../models/SystemEventLog');
const { storeMockDefinition } = require('../utils/redisMock');
const { addMockSyncJob } = require('../queues/mockSyncQueue');

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Helper: Get supported protocols from env ────────────────
function getSupportedProtocols() {
  const protocols = process.env.SUPPORTED_PROTOCOLS
    ? process.env.SUPPORTED_PROTOCOLS.split(',').map(p => p.trim().toLowerCase())
    : ['http', 'https'];
  return protocols;
}

// ─── Helper: Build actual full URL with protocol ─────────────
function buildActualFullUrl(protocol, host, projectId, version, urlPath, pathParams, queryParams) {
  // Normalize protocol
  const supported = getSupportedProtocols();
  const normalizedProtocol = protocol.toLowerCase();
  const finalProtocol = supported.includes(normalizedProtocol) ? normalizedProtocol : 'https';
  
  let resolvedPath = urlPath || '';
  pathParams.forEach(({ key, value }) => {
    const escapedKey = escapeRegExp(key);
    resolvedPath = resolvedPath.replace(new RegExp(`:${escapedKey}`, 'g'), value || `{${key}}`);
  });
  if (resolvedPath.startsWith('/')) resolvedPath = resolvedPath.slice(1);
  
  let fullUrl = `${finalProtocol}://${host}/p/${projectId}/${version}`;
  if (resolvedPath) {
    fullUrl += `/${resolvedPath}`;
  }
  
  if (queryParams?.length) {
    const qs = queryParams
      .filter(q => q.key && q.value)
      .map(q => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`)
      .join('&');
    if (qs) fullUrl += `?${qs}`;
  }
  return fullUrl;
}

// ─── Helper: Validate URL path ──────────────────────────────
function validateUrlPath(urlpath) {
  if (!urlpath || typeof urlpath !== 'string') {
    return { valid: false, error: 'Invalid URL path' };
  }
  if (!/^[a-zA-Z0-9/:_-]*$/.test(urlpath)) {
    return { valid: false, error: 'URL path contains invalid characters' };
  }
  return { valid: true };
}

async function update_api(req, res) {
  const { project_id, urlpath, apihistorydata, airesponse } = req.body;
  const username = req.user?.username;

  if (!project_id || !urlpath || !apihistorydata) {
    return res.status(400).json({ error: 'Missing required fields: project_id, urlpath, apihistorydata' });
  }

  const aiResponseBool = airesponse === true || airesponse === 'true';

  // ─── Validate URL path ──────────────────────────────────────
  const pathValidation = validateUrlPath(urlpath);
  if (!pathValidation.valid) {
    return res.status(400).json({ error: pathValidation.error });
  }

  try {
    // ─── 1. Fetch project ──────────────────────────────────
    const project = await Project.findOne({ id: project_id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // ─── 2. Check if project is active ──────────────────
    if (!project.isActive) {
      return res.status(403).json({
        error: 'Cannot update APIs in an inactive project. Please activate the project first.'
      });
    }

    // ─── 3. Add user to members if not present ────────────
    if (!project.members.includes(username)) {
      project.members.push(username);
      await project.save();
    }

    // ─── 4. Fetch project history ──────────────────────────
    const projectHistory = await ProjectApiHistory.findOne({ projectCode: project.invitationCode });
    if (!projectHistory) {
      return res.status(404).json({ error: 'No API history found. Use /add-api first.' });
    }

    if (!projectHistory.accessByUsernames.includes(username)) {
      projectHistory.accessByUsernames.push(username);
    }

    // ─── 5. Find the endpoint ──────────────────────────────
    const endpointIndex = projectHistory.endpoints.findIndex(ep => ep.baseUrlPath === urlpath);
    if (endpointIndex === -1) {
      return res.status(404).json({ error: 'URL path not found. Use /add-api to create it.' });
    }

    const endpoint = projectHistory.endpoints[endpointIndex];

    // ─── 6. Version limit check (based on subscription) ────
    const maxVersions = project.issubdcribe ? 20 : 5;
    const currentVersions = endpoint.versions.length;
    if (currentVersions >= maxVersions) {
      return res.status(403).json({
        error: `Version limit reached. ${project.issubdcribe ? 'Subscribed projects can have up to 20 versions per endpoint.' : 'Unsubscribed projects can have up to 5 versions per endpoint. Please subscribe to increase the limit.'}`
      });
    }

    // ─── 7. Determine new version number ──────────────────
    const existingVersions = endpoint.versions || [];
    const lastNum = existingVersions.length > 0
      ? parseInt(existingVersions[existingVersions.length - 1].version.replace('v', ''), 10)
      : 0;
    const newVersion = `v${lastNum + 1}`;

    // ─── 8. Extract fields ──────────────────────────────────
    const {
      protocol,
      method,
      pathParams = [],
      queryParams = [],
      requestBody = null,
      responseBody = null,
      isAuthEnabled,
      authScheme,
      latency,
      rateLimit,
      headers = [],
      responseHeaders = [],
      cookies = [],
      statusCode,
      expectedToken = '',
      expectedApiKey = '',
    } = apihistorydata;

    // ─── 9. Validate protocol ──────────────────────────────
    if (!protocol) {
      return res.status(400).json({ error: 'protocol is required' });
    }
    
    if (!method) {
      return res.status(400).json({ error: 'method is required' });
    }
    
    if (!ALLOWED_METHODS.includes(method.toUpperCase())) {
      return res.status(400).json({ error: `Invalid method. Allowed: ${ALLOWED_METHODS.join(', ')}` });
    }

    const SUPPORTED_PROTOCOLS = getSupportedProtocols();
    const normalizedProtocol = protocol.toLowerCase();
    
    if (!SUPPORTED_PROTOCOLS.includes(normalizedProtocol)) {
      return res.status(400).json({ 
        error: `Protocol '${protocol}' not supported. Allowed: ${SUPPORTED_PROTOCOLS.join(', ')}` 
      });
    }

    // ─── 10. Validate auth fields ──────────────────────────
    if (isAuthEnabled === undefined) {
      return res.status(400).json({ error: 'isAuthEnabled is required' });
    }
    
    if (!authScheme) {
      return res.status(400).json({ error: 'authScheme is required' });
    }
    
    if (latency === undefined) {
      return res.status(400).json({ error: 'latency is required' });
    }
    
    if (rateLimit === undefined) {
      return res.status(400).json({ error: 'rateLimit is required' });
    }
    
    if (statusCode === undefined) {
      return res.status(400).json({ error: 'statusCode is required' });
    }
    
    if (typeof statusCode !== 'number') {
      return res.status(400).json({ error: 'statusCode must be a number' });
    }

    // ─── 11. Validate status code range ────────────────────
    if (statusCode < 100 || statusCode > 599) {
      return res.status(400).json({ 
        error: 'statusCode must be between 100 and 599' 
      });
    }

    // ─── 12. Get host from environment ──────────────────────
    const host = process.env.HOST;
    if (!host) {
      return res.status(500).json({ error: 'HOST environment variable is not set' });
    }

    const customId = project.id;

    // ─── 13. Build actual full URL ──────────────────────────
    const actualFullUrl = buildActualFullUrl(
      normalizedProtocol, 
      host, 
      customId, 
      newVersion, 
      urlpath, 
      pathParams, 
      queryParams
    );

    // ─── 14. Build new version object ──────────────────────
    const newVersionObj = {
      protocol: normalizedProtocol,
      method,
      urlPath: urlpath,
      pathParams,
      queryParams,
      requestBody,
      responseBody,
      version: newVersion,
      actualFullUrl,
      airesponse: aiResponseBool,
      isAuthEnabled,
      authScheme,
      latency,
      rateLimit,
      headers,
      responseHeaders,
      cookies,
      statusCode,
      expectedToken,
      expectedApiKey,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // ─── 15. Push new version and update counts ──────────
    endpoint.versions.push(newVersionObj);
    endpoint.noofVersions = endpoint.versions.length;
    endpoint.updatedAt = new Date();
    await projectHistory.save();

    // ─── 16. Store in Redis and queue ──────────────────────
    const definitionData = {
      projectId: customId,
      version: newVersion,
      method,
      urlpath,
      apihistorydata: newVersionObj,
    };

    await storeMockDefinition(customId, newVersion, method, urlpath, definitionData);
    await addMockSyncJob('set', definitionData);

    // ─── 17. Create system event log ──────────────────────
    const newLog = await SystemEventLog.create({
      projectId: project_id,
      method: method.toUpperCase(),
      url: urlpath,
      action: 'updated',
      version: newVersion,
      username,
      statusCode: 200,
      createdAt: new Date(),
    });

    if (req.io) {
      req.io.to(project_id).emit('new_api_log', newLog.toObject());
    }

    // ─── 18. Return success response ──────────────────────
    return res.status(200).json({
      success: true,
      message: `New version ${newVersion} added to endpoint '${urlpath}'`,
      version: newVersion,
      actualFullUrl,
      protocol: normalizedProtocol,
    });

  } catch (error) {
    console.error('[update-api] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = update_api;