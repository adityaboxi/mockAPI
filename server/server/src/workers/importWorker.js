require('../opentelemetry/universal-logger');  // <-- Add this line FIRST
require('dotenv').config();

const { Worker, Queue } = require('bullmq');
const { v4: uuidv4 } = require('uuid');
const IORedis = require('ioredis');

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const SystemEventLog = require('../models/SystemEventLog');

// ---------- Redis Connection ----------
const REDIS_URL = process.env.REDIS_URL || 'redis://redis-external:6379';
const queueConnection = {
  connection: {
    url: REDIS_URL,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
};

const externalRedis = new IORedis(REDIS_URL);
externalRedis.on('error', (err) => console.error('[importWorker] Redis error:', err.message));

// Queues used to trigger container spin‑up and API sync
const projectQueue = new Queue('projectQueue', queueConnection);
const mockSyncQueue = new Queue('mockSyncQueue', queueConnection);

// ---------- Worker: OpenAPI Import ----------
const importWorker = new Worker(
  'importQueue',
  async (job) => {
    const { projectName, spec, username, projectId: existingProjectId } = job.data;
    console.log(`[importWorker] 🚀 Starting job ${job.id} for user ${username}, project "${projectName}"`);

    await job.updateProgress(10);

    // Validate input
    if ((!projectName && !existingProjectId) || !spec || !username) {
      throw new Error('Missing required job data: projectName, spec, or username');
    }
    if (!spec.paths || typeof spec.paths !== 'object') {
      throw new Error('Invalid OpenAPI spec: missing "paths" object');
    }

    // Parse all endpoints
    const protocol = process.env.PROTOCOL || 'http';
    const host = process.env.HOST || 'localhost:8080';
    const basePath = spec.basePath || '';
    const endpointsMap = {};

    let finalProjectId = existingProjectId;
    if (!finalProjectId && projectName) {
      const sanitized = projectName.replace(/[^a-zA-Z0-9]/g, '_');
      finalProjectId = `${username}_${sanitized}`;
    }

    Object.keys(spec.paths).forEach((rawPath) => {
      const fullPath = basePath + rawPath;
      const pathObj = spec.paths[rawPath];

      Object.keys(pathObj || {}).forEach((method) => {
        const methodLower = method.toLowerCase();
        if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(methodLower)) return;

        const operation = pathObj[method];
        const version = 'v1';
        const versionedPath = `/${version}${fullPath}`;
        const cleanPath = versionedPath.startsWith('/') ? versionedPath.slice(1) : versionedPath;
        const actualFullUrl = `${protocol}://${host}/p/${finalProjectId}/${cleanPath}`;

        if (!endpointsMap[fullPath]) {
          endpointsMap[fullPath] = { baseUrlPath: fullPath, versions: [] };
        }

        endpointsMap[fullPath].versions.push({
          method: method.toUpperCase(),
          urlPath: versionedPath,
          version,
          protocol,
          statusCode: 200,
          requestBody: operation?.requestBody?.content?.['application/json']?.schema?.example || null,
          responseBody: operation?.responses?.['200']?.content?.['application/json']?.schema?.example || null,
          summary: operation?.summary || '',
          description: operation?.description || '',
          operationId: operation?.operationId || `${method}_${rawPath.replace(/\//g, '_')}`,
          actualFullUrl,
        });
      });
    });

    const endpointsArray = Object.values(endpointsMap);
    if (endpointsArray.length === 0) {
      throw new Error('No valid HTTP methods found in the OpenAPI spec');
    }

    console.log(`[importWorker] 📊 Parsed ${endpointsArray.length} endpoints from spec`);
    await job.updateProgress(35);

    // Create or Fetch Project in MongoDB
    let project = await Project.findOne({ id: finalProjectId });
    const invitationCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    if (!project) {
      project = new Project({
        id: finalProjectId,
        projectname: projectName || finalProjectId,
        username,
        invitationCode,
        members: [username],
        isActive: true,
      });
      await project.save();
    }

    await job.updateProgress(55);

    // Store Endpoint History
    let projectHistory = await ProjectApiHistory.findOne({ projectID: finalProjectId });
    if (projectHistory) {
      projectHistory.endpoints = endpointsArray;
      projectHistory.updatedAt = new Date();
      await projectHistory.save();
    } else {
      projectHistory = new ProjectApiHistory({
        projectID: finalProjectId,
        projectCode: finalProjectId,
        accessByUsernames: [username],
        endpoints: endpointsArray,
      });
      await projectHistory.save();
    }

    await job.updateProgress(70);

    // Create Micro-batched System Event Audit Logs
    const systemLogs = [];
    for (const endpoint of endpointsArray) {
      for (const ver of endpoint.versions) {
        systemLogs.push({
          projectId: finalProjectId,
          username,
          action: 'imported',
          method: ver.method,
          url: ver.urlPath,
          version: ver.version,
          accessByUsername: [username],
          statusCode: 201,
          createdAt: new Date(),
        });
      }
    }
    if (systemLogs.length > 0) {
      await SystemEventLog.insertMany(systemLogs, { ordered: false }).catch(() => {});
    }

    // Broadcast Real-Time Update
    await externalRedis.publish('api_history_update', JSON.stringify({ projectId: finalProjectId })).catch(() => {});

    await job.updateProgress(80);

    // Trigger container provisioning
    await projectQueue.add('create-project', {
      action: 'create',
      projectId: finalProjectId,
    });

    // Enqueue Mock API Sync Jobs
    for (const endpoint of endpointsArray) {
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
      }
    }

    await job.updateProgress(100);

    return {
      name: projectName,
      endpoints: endpointsArray.length,
      projectId: finalProjectId,
      status: 'completed',
    };
  },
  {
    ...queueConnection,
    concurrency: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
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
async function shutdown() {
  await importWorker.close().catch(() => {});
  await projectQueue.close().catch(() => {});
  await mockSyncQueue.close().catch(() => {});
  await externalRedis.quit().catch(() => {});
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = importWorker;