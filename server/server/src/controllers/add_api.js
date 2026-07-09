const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const SystemEventLog = require('../models/SystemEventLog');
const { storeMockDefinition } = require('../utils/redisMock');
const { addMockSyncJob } = require('../queues/mockSyncQueue');

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
function buildActualFullUrl(protocol, host, projectId, version, urlPath, pathParams, queryParams) {
  const resolvedPath = (urlPath || '')
    .split('/')
    .filter(Boolean)
    .map(segment => {
      const param = pathParams.find(p => `:${p.key}` === segment);
      return param ? param.value || `{${param.key}}` : segment;
    })
    .join('/');

  let fullUrl = `${protocol}://${host}/p/${projectId}/${version}/${resolvedPath}`;
  if (queryParams?.length) {
    const qs = queryParams
      .filter(q => q.key && q.value)
      .map(q => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`)
      .join('&');
    if (qs) fullUrl += `?${qs}`;
  }
  return fullUrl;
}

async function add_api(req, res) {
  const { project_id, urlpath, apihistorydata, airesponse } = req.body;
  const username = req.user?.username;

  // ---- LOG: Incoming request ----
  console.log('\n📥 [add-api] Received request:');
  console.log('  project_id:', project_id);
  console.log('  urlpath:', urlpath);
  console.log('  airesponse:', airesponse);
  console.log('  username:', username);
  console.log('  apihistorydata:', JSON.stringify(apihistorydata, null, 2));

  if (!project_id || !urlpath || !apihistorydata) {
    return res.status(400).json({ error: 'Missing required fields: project_id, urlpath, apihistorydata' });
  }

  const aiResponseBool = airesponse === true || airesponse === 'true';

  try {
    // ---- LOG: Looking for project ----
    console.log(`🔍 [add-api] Looking for project with id: ${project_id}`);
    const project = await Project.findOne({ id: project_id });
    if (!project) {
      console.log(`❌ [add-api] Project not found: ${project_id}`);
      return res.status(404).json({ error: 'Project not found' });
    }
    console.log(`✅ [add-api] Project found: ${project.id} (${project.projectname})`);

    if (!project.members.includes(username)) {
      console.log(`👤 [add-api] Adding ${username} to project members.`);
      project.members.push(username);
      await project.save();
      console.log(`✅ [add-api] Member added.`);
    }

    // ---- ProjectHistory ----
    console.log(`📚 [add-api] Looking for ProjectApiHistory with projectCode: ${project.invitationCode}`);
    let projectHistory = await ProjectApiHistory.findOne({ projectCode: project.invitationCode });
    if (!projectHistory) {
      console.log(`🆕 [add-api] Creating new ProjectApiHistory for projectCode: ${project.invitationCode}`);
      projectHistory = new ProjectApiHistory({
        projectID: project.id,
        projectCode: project.invitationCode,
        accessByUsernames: [username],
        endpoints: []
      });
    } else if (!projectHistory.accessByUsernames.includes(username)) {
      console.log(`➕ [add-api] Adding ${username} to accessByUsernames.`);
      projectHistory.accessByUsernames.push(username);
    }

    // Check if endpoint already exists
    if (projectHistory.endpoints.some(ep => ep.baseUrlPath === urlpath)) {
      console.log(`⚠️ [add-api] URL path already exists: ${urlpath}`);
      return res.status(409).json({ error: 'URL path already exists. Use /update-api to add a new version.' });
    }

    // ---- Extract fields ----
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

    if (!protocol) return res.status(400).json({ error: 'protocol is required' });
    if (!method) return res.status(400).json({ error: 'method is required' });
    if (!ALLOWED_METHODS.includes(method.toUpperCase())) {
      return res.status(400).json({ error: `Invalid method. Allowed: ${ALLOWED_METHODS.join(', ')}` });
    }

    const SUPPORTED_PROTOCOLS = process.env.SUPPORTED_PROTOCOLS
      ? process.env.SUPPORTED_PROTOCOLS.split(',').map(p => p.trim().toLowerCase())
      : null;
    if (!SUPPORTED_PROTOCOLS) return res.status(500).json({ error: 'SUPPORTED_PROTOCOLS env variable is not set' });
    if (!SUPPORTED_PROTOCOLS.includes(protocol.toLowerCase())) {
      return res.status(400).json({ error: `Protocol '${protocol}' not supported. Allowed: ${SUPPORTED_PROTOCOLS.join(', ')}` });
    }

    if (isAuthEnabled === undefined) return res.status(400).json({ error: 'isAuthEnabled is required' });
    if (!authScheme) return res.status(400).json({ error: 'authScheme is required' });
    if (latency === undefined) return res.status(400).json({ error: 'latency is required' });
    if (rateLimit === undefined) return res.status(400).json({ error: 'rateLimit is required' });
    if (statusCode === undefined) return res.status(400).json({ error: 'statusCode is required' });
    if (typeof statusCode !== 'number') {
      return res.status(400).json({ error: 'statusCode must be a number' });
    }

    const host = process.env.HOST;
    if (!host) return res.status(500).json({ error: 'HOST environment variable is not set' });

    const version = 'v1';
    const customId = project.id;

    const actualFullUrl = buildActualFullUrl(
      protocol, host, customId, version, urlpath, pathParams, queryParams
    );

    // ---- Build version object ----
    const newVersionObj = {
      protocol,
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

    console.log(`📦 [add-api] New version object:`, JSON.stringify(newVersionObj, null, 2));

    const newEndpoint = {
      baseUrlPath: urlpath,
      versions: [newVersionObj],
      accessBy: [username],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log(`📦 [add-api] New endpoint object:`, JSON.stringify(newEndpoint, null, 2));

    projectHistory.endpoints.push(newEndpoint);
    await projectHistory.save();
    console.log(`✅ [add-api] ProjectApiHistory saved (${projectHistory.endpoints.length} endpoints).`);

    // ---- Prepare definition data for Redis & worker ----
    const definitionData = {
      projectId: customId,
      version,
      method,
      urlpath,
      apihistorydata: newVersionObj,
    };

    console.log(`📤 [add-api] Storing in Redis and enqueuing worker job with:`);
    console.log(JSON.stringify(definitionData, null, 2));

    await storeMockDefinition(customId, version, method, urlpath, definitionData);
    console.log(`✅ [add-api] Stored in Redis (mock definition).`);

    await addMockSyncJob('set', definitionData);
    console.log(`✅ [add-api] Enqueued mockSyncJob (set).`);

    // ---- Create system event log ----
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
    console.log(`📝 [add-api] SystemEventLog created:`, JSON.stringify(newLog.toObject(), null, 2));

    if (req.io) {
      req.io.to(project_id).emit('new_api_log', newLog.toObject());
    }

    return res.status(201).json({
      success: true,
      message: `New API endpoint '${urlpath}' created with version ${version}`,
      actualFullUrl
    });

  } catch (error) {
    console.error('[add-api] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = add_api;