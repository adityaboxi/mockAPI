require('dotenv').config();
const { Worker, Queue } = require('bullmq');
const { v4: uuidv4 } = require('uuid');
const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');

// ---------- Redis Connection (shared with the main server) ----------
const REDIS_URL = process.env.REDIS_URL || 'redis://redis-external:6379';
const queueConnection = {
  connection: {
    url: REDIS_URL,
    // Allow retries for resilience
    maxRetriesPerRequest: 5,
    enableReadyCheck: true,
  }
};

// Queues used to trigger container spin‑up and API sync
const projectQueue = new Queue('projectQueue', queueConnection);
const mockSyncQueue = new Queue('mockSyncQueue', queueConnection);

// ---------- Worker: OpenAPI Import ----------
const importWorker = new Worker(
  'importQueue',
  async (job) => {
    const { projectName, spec, username } = job.data;
    console.log(`[importWorker] Starting job ${job.id} for user ${username}, project "${projectName}"`);

    // 1. Update progress: starting
    await job.updateProgress(10);

    // Validate input
    if (!projectName || !spec || !username) {
      throw new Error('Missing required job data: projectName, spec, or username');
    }
    if (!spec.paths || typeof spec.paths !== 'object') {
      throw new Error('Invalid OpenAPI spec: missing "paths" object');
    }

    // 2. Parse all endpoints from the OpenAPI spec
    const basePath = spec.basePath || '';
    const endpointsMap = {};

    Object.keys(spec.paths).forEach(rawPath => {
      const fullPath = basePath + rawPath;
      const pathObj = spec.paths[rawPath];

      Object.keys(pathObj).forEach(method => {
        const methodLower = method.toLowerCase();
        if (!['get', 'post', 'put', 'delete', 'patch', 'options'].includes(methodLower)) return;

        const operation = pathObj[method];
        if (!endpointsMap[fullPath]) {
          endpointsMap[fullPath] = { baseUrlPath: fullPath, versions: [] };
        }

        endpointsMap[fullPath].versions.push({
          method: method.toUpperCase(),
          urlPath: fullPath,
          version: 'v1', // Default version – can be made configurable later
          protocol: 'https',
          statusCode: 200,
          requestBody: operation.requestBody?.content?.['application/json']?.schema?.example || null,
          responseBody: operation.responses?.['200']?.content?.['application/json']?.schema?.example || null,
        });
      });
    });

    const endpointsArray = Object.values(endpointsMap);
    if (endpointsArray.length === 0) {
      throw new Error('No valid HTTP methods found in the OpenAPI spec');
    }

    console.log(`[importWorker] Parsed ${endpointsArray.length} endpoints from spec`);
    await job.updateProgress(40); // Parsing complete

    // 3. Create project in MongoDB
    const projectId = uuidv4();
    const invitationCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newProject = new Project({
      id: projectId,
      projectname: projectName,
      username: username,
      invitationCode,
      members: [username],
      isActive: true,
      createdAt: new Date().toISOString()
    });
    await newProject.save();
    console.log(`[importWorker] Project ${projectId} created`);

    await job.updateProgress(60); // Project created

    // 4. Store endpoint history
    const projectApiHistory = new ProjectApiHistory({
      projectID: projectId,
      projectCode: projectId,
      accessByUsernames: [username],
      endpoints: endpointsArray,
    });
    await projectApiHistory.save();
    console.log(`[importWorker] Endpoint history saved for project ${projectId}`);

    await job.updateProgress(80); // Endpoints saved

    // 5. Trigger container provisioning (create or update)
    await projectQueue.add('create-project', {
      action: 'create',
      projectId,
    });
    console.log(`[importWorker] Enqueued project creation for ${projectId}`);

    // 6. Sync each endpoint to the mock‑server via OpenResty (with delay for container startup)
    const syncDelay = 5000; // 5 seconds to allow container to start
    for (const endpoint of endpointsArray) {
      for (const ver of endpoint.versions) {
        await mockSyncQueue.add(
          'sync-api',
          {
            action: 'set',
            projectId,
            versionData: {
              version: ver.version,
              method: ver.method,
              urlPath: ver.urlPath,
              protocol: ver.protocol,
              requestBody: ver.requestBody,
              responseBody: ver.responseBody,
              statusCode: ver.statusCode,
            }
          },
          { delay: syncDelay }
        );
      }
    }
    console.log(`[importWorker] Enqueued ${endpointsArray.length} API sync jobs for ${projectId}`);

    await job.updateProgress(100); // Fully complete

    // Return value for the `/api/import-status` endpoint
    return {
      name: projectName,
      endpoints: endpointsArray.length,
      projectId,
    };
  },
  {
    // Worker options
    ...queueConnection, // same connection for BullMQ
    concurrency: 1,     // process one import at a time (to avoid DB contention)
    attempts: 3,        // retry up to 3 times on failure
    backoff: {
      type: 'exponential',
      delay: 5000,      // wait 5s, then 10s, then 20s
    },
    removeOnComplete: { age: 3600 },  // keep completed jobs for 1 hour
    removeOnFail: { age: 86400 },     // keep failed jobs for 24 hours
  }
);

// ---------- Event Listeners ----------
importWorker.on('completed', (job) => {
  console.log(`[importWorker] ✅ Job ${job.id} completed successfully`);
});

importWorker.on('failed', (job, err) => {
  console.error(`[importWorker] ❌ Job ${job.id} failed:`, err.message);
});

// ---------- Graceful Shutdown ----------
process.on('SIGTERM', async () => {
  console.log('[importWorker] Received SIGTERM, closing worker...');
  await importWorker.close();
});

process.on('SIGINT', async () => {
  console.log('[importWorker] Received SIGINT, closing worker...');
  await importWorker.close();
});

module.exports = importWorker;