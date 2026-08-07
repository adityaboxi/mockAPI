require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const SystemEventLog = require('../models/SystemEventLog');
const { storeMockDefinition } = require('../utils/redisMock');
const { addMockSyncJob } = require('../queues/mockSyncQueue');

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

// ─── Helper: Get supported protocols from env ────────────────
function getSupportedProtocols() {
  const protocols = process.env.SUPPORTED_PROTOCOLS
    ? process.env.SUPPORTED_PROTOCOLS.split(',').map(p => p.trim().toLowerCase())
    : ['http', 'https'];
  return protocols;
}

// ─── Helper: Build actual full URL with protocol ─────────────
function buildActualFullUrl(protocol, host, projectId, version, urlPath, pathParams, queryParams) {
  // Ensure protocol is valid
  const supported = getSupportedProtocols();
  const normalizedProtocol = protocol.toLowerCase();
  
  // Default to 'https' if protocol not supported (fallback)
  const finalProtocol = supported.includes(normalizedProtocol) ? normalizedProtocol : 'https';
  
  // Clean the URL path
  const resolvedPath = (urlPath || '')
    .split('/')
    .filter(Boolean)
    .map(segment => {
      // Check if segment is a path parameter (starts with :)
      if (segment.startsWith(':')) {
        const paramKey = segment.substring(1);
        const param = pathParams.find(p => p.key === paramKey);
        return param ? param.value || `{${paramKey}}` : segment;
      }
      return segment;
    })
    .join('/');

  // Build the full URL
  let fullUrl = `${finalProtocol}://${host}/p/${projectId}/${version}`;
  if (resolvedPath) {
    fullUrl += `/${resolvedPath}`;
  }
  
  // Add query parameters
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
  // Allow alphanumeric, underscore, hyphen, forward slash, colon (for params)
  if (!/^[a-zA-Z0-9/:_-]*$/.test(urlpath)) {
    return { valid: false, error: 'URL path contains invalid characters' };
  }
  return { valid: true };
}

// ─── Main controller ──────────────────────────────────────────
async function add_api(req, res) {
  const { project_id, urlpath, apihistorydata, airesponse } = req.body;
  const username = req.user?.username;

  // ─── 1. Validate required fields ──────────────────────────
  if (!project_id || !urlpath || !apihistorydata) {
    return res.status(400).json({ 
      error: 'Missing required fields: project_id, urlpath, apihistorydata' 
    });
  }

  const aiResponseBool = airesponse === true || airesponse === 'true';

  // ─── 2. Validate URL path ──────────────────────────────────
  const pathValidation = validateUrlPath(urlpath);
  if (!pathValidation.valid) {
    return res.status(400).json({ error: pathValidation.error });
  }

  try {
    // ─── 3. Fetch project ──────────────────────────────────
    const project = await Project.findOne({ id: project_id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // ─── 4. Check if project is active ──────────────────
    if (!project.isActive) {
      return res.status(403).json({
        error: 'Cannot add APIs to an inactive project. Please activate the project first.'
      });
    }

    // ─── 5. Add user to members if not present ────────────
    if (!project.members.includes(username)) {
      project.members.push(username);
      await project.save();
    }

    // ─── 6. Check API limit based on subscription ──────────
    const maxApis = project.issubdcribe ? 30 : 5;
    if (project.noofApis >= maxApis) {
      return res.status(403).json({
        error: `API limit reached. ${project.issubdcribe ? 'Subscribed projects can have up to 30 APIs.' : 'Unsubscribed projects can have up to 5 APIs. Please subscribe to increase the limit.'}`
      });
    }

    // ─── 7. Project history ────────────────────────────────
    let projectHistory = await ProjectApiHistory.findOne({ projectCode: project.invitationCode });
    if (!projectHistory) {
      projectHistory = new ProjectApiHistory({
        projectID: project.id,
        projectCode: project.invitationCode,
        accessByUsernames: [username],
        endpoints: []
      });
    } else if (!projectHistory.accessByUsernames.includes(username)) {
      projectHistory.accessByUsernames.push(username);
    }

    // ─── 8. Check if endpoint already exists ──────────────
    if (projectHistory.endpoints.some(ep => ep.baseUrlPath === urlpath)) {
      return res.status(409).json({ 
        error: 'URL path already exists. Use /update-api to add a new version.' 
      });
    }

    // ─── 9. Extract fields from apihistorydata ──────────────
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

    // ─── 10. Validate required fields ──────────────────────
    if (!protocol) {
      return res.status(400).json({ error: 'protocol is required' });
    }
    
    if (!method) {
      return res.status(400).json({ error: 'method is required' });
    }
    
    if (!ALLOWED_METHODS.includes(method.toUpperCase())) {
      return res.status(400).json({ 
        error: `Invalid method. Allowed: ${ALLOWED_METHODS.join(', ')}` 
      });
    }

    // ─── 11. Validate protocol ──────────────────────────────
    const SUPPORTED_PROTOCOLS = getSupportedProtocols();
    const normalizedProtocol = protocol.toLowerCase();
    
    if (!SUPPORTED_PROTOCOLS.includes(normalizedProtocol)) {
      return res.status(400).json({ 
        error: `Protocol '${protocol}' not supported. Allowed: ${SUPPORTED_PROTOCOLS.join(', ')}` 
      });
    }

    // ─── 12. Validate auth fields ──────────────────────────
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

    // ─── 13. Validate status code range ────────────────────
    if (statusCode < 100 || statusCode > 599) {
      return res.status(400).json({ 
        error: 'statusCode must be between 100 and 599' 
      });
    }

    // ─── 14. Get host from environment ──────────────────────
    const host = process.env.HOST;
    if (!host) {
      return res.status(500).json({ error: 'HOST environment variable is not set' });
    }

    // ─── 15. Build actual full URL ──────────────────────────
    const version = 'v1';
    const customId = project.id;

    const actualFullUrl = buildActualFullUrl(
      normalizedProtocol,  // Use normalized protocol
      host, 
      customId, 
      version, 
      urlpath, 
      pathParams, 
      queryParams
    );

    // ─── 16. Build version object ──────────────────────────
    const newVersionObj = {
      protocol: normalizedProtocol,  // Store normalized protocol
      method,
      urlPath: urlpath,
      pathParams,
      queryParams,
      requestBody,
      responseBody,
      version,
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
      updatedAt: new Date()
    };

    const newEndpoint = {
      baseUrlPath: urlpath,
      versions: [newVersionObj],
      accessBy: [username],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // ─── 17. Save to ProjectApiHistory ─────────────────────
    projectHistory.endpoints.push(newEndpoint);
    await projectHistory.save();

    // ─── 18. Increment project API count ──────────────────
    project.noofApis += 1;
    await project.save();

    // ─── 19. Store in Redis & queue ──────────────────────
    const definitionData = {
      projectId: customId,
      version,
      method,
      urlpath,
      apihistorydata: newVersionObj,
    };

    await storeMockDefinition(customId, version, method, urlpath, definitionData);
    await addMockSyncJob('set', definitionData);

    // ─── 20. Log event ────────────────────────────────────
    const newLog = await SystemEventLog.create({
      projectId: project_id,
      method: method.toUpperCase(),
      url: urlpath,
      action: 'created',
      version,
      username,
      statusCode: 201,
      createdAt: new Date()
    });

    if (req.io) {
      req.io.to(project_id).emit('new_api_log', newLog.toObject());
    }

    // ─── 21. Return success response ──────────────────────
    return res.status(201).json({
      success: true,
      message: `New API endpoint '${urlpath}' created with version ${version}`,
      actualFullUrl,
      protocol: normalizedProtocol,
      version: version
    });

  } catch (error) {
    console.error('[add-api] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = add_api;