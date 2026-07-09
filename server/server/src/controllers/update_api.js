const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const SystemEventLog = require('../models/SystemEventLog');
const { storeMockDefinition } = require('../utils/redisMock');
const { addMockSyncJob } = require('../queues/mockSyncQueue');

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildActualFullUrl(protocol, host, projectId, version, urlPath, pathParams, queryParams) {
  let resolvedPath = urlPath || '';
  pathParams.forEach(({ key, value }) => {
    const escapedKey = escapeRegExp(key);
    resolvedPath = resolvedPath.replace(new RegExp(`:${escapedKey}`, 'g'), value || `{${key}}`);
  });
  if (resolvedPath.startsWith('/')) resolvedPath = resolvedPath.slice(1);
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

async function update_api(req, res) {
  const { project_id, urlpath, apihistorydata, airesponse } = req.body;
  const username = req.user?.username;

  // ---- LOG: Incoming request ----
  console.log('\n📥 [update-api] Received request:');
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
    console.log(`🔍 [update-api] Looking for project with id: ${project_id}`);
    const project = await Project.findOne({ id: project_id });
    if (!project) {
      console.log(`❌ [update-api] Project not found: ${project_id}`);
      return res.status(404).json({ error: 'Project not found' });
    }
    console.log(`✅ [update-api] Project found: ${project.id} (${project.projectname})`);

    if (!project.members.includes(username)) {
      console.log(`👤 [update-api] Adding ${username} to project members.`);
      project.members.push(username);
      await project.save();
      console.log(`✅ [update-api] Member added.`);
    }

    // ---- ProjectHistory ----
    console.log(`📚 [update-api] Looking for ProjectApiHistory with projectCode: ${project.invitationCode}`);
    const projectHistory = await ProjectApiHistory.findOne({ projectCode: project.invitationCode });
    if (!projectHistory) {
      console.log(`❌ [update-api] No ProjectApiHistory found for ${project.invitationCode}`);
      return res.status(404).json({ error: 'No API history found. Use /add-api first.' });
    }
    console.log(`✅ [update-api] ProjectApiHistory found with ${projectHistory.endpoints.length} endpoints.`);

    if (!projectHistory.accessByUsernames.includes(username)) {
      console.log(`➕ [update-api] Adding ${username} to accessByUsernames.`);
      projectHistory.accessByUsernames.push(username);
    }

    // ---- Find endpoint ----
    console.log(`🔍 [update-api] Looking for endpoint with baseUrlPath: ${urlpath}`);
    const endpointIndex = projectHistory.endpoints.findIndex(ep => ep.baseUrlPath === urlpath);
    if (endpointIndex === -1) {
      console.log(`❌ [update-api] Endpoint ${urlpath} not found.`);
      return res.status(404).json({ error: 'URL path not found. Use /add-api to create it.' });
    }
    console.log(`✅ [update-api] Endpoint found at index ${endpointIndex}.`);

    const endpoint = projectHistory.endpoints[endpointIndex];
    const existingVersions = endpoint.versions || [];
    const lastNum = existingVersions.length > 0
      ? parseInt(existingVersions[existingVersions.length - 1].version.replace('v', ''), 10)
      : 0;
    const newVersion = `v${lastNum + 1}`;
    console.log(`📌 [update-api] New version: ${newVersion} (last was ${lastNum > 0 ? existingVersions[existingVersions.length - 1].version : 'none'})`);

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

    const customId = project.id;

    const actualFullUrl = buildActualFullUrl(protocol, host, customId, newVersion, urlpath, pathParams, queryParams);
    console.log(`🔗 [update-api] Actual full URL: ${actualFullUrl}`);

    // ---- Build new version object ----
    const newVersionObj = {
      protocol,
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

    console.log(`📦 [update-api] New version object:`, JSON.stringify(newVersionObj, null, 2));

    // ---- Update endpoint ----
    endpoint.versions.push(newVersionObj);
    endpoint.updatedAt = new Date();
    await projectHistory.save();
    console.log(`✅ [update-api] ProjectApiHistory saved (new version added to endpoint).`);

    // ---- Prepare definition data for Redis & worker ----
    const definitionData = {
      projectId: customId,
      version: newVersion,
      method,
      urlpath,
      apihistorydata: newVersionObj,
    };

    console.log(`📤 [update-api] Storing in Redis and enqueuing worker job with:`);
    console.log(JSON.stringify(definitionData, null, 2));

    await storeMockDefinition(customId, newVersion, method, urlpath, definitionData);
    console.log(`✅ [update-api] Stored in Redis (mock definition).`);

    await addMockSyncJob('set', definitionData);
    console.log(`✅ [update-api] Enqueued mockSyncJob (set).`);

    // ---- Create system event log ----
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
    console.log(`📝 [update-api] SystemEventLog created:`, JSON.stringify(newLog.toObject(), null, 2));

    if (req.io) {
      req.io.to(project_id).emit('new_api_log', newLog.toObject());
    }

    return res.status(200).json({
      success: true,
      message: `New version ${newVersion} added to endpoint '${urlpath}'`,
      version: newVersion,
      actualFullUrl,
    });

  } catch (error) {
    console.error('[update-api] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = update_api;