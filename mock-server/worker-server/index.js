require('./opentelemetry/universal-logger');  // <-- Add this line FIRST

require('dotenv').config();
const { Worker, Queue } = require('bullmq');
const Docker = require('dockerode');
const IORedis = require('ioredis');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

// ---------- MODELS -------------
const Project = require('./models/Project');
const ProjectApiHistory = require('./models/ProjectApiHistory');
const SystemEventLog = require('./models/SystemEventLog');

// ---------- CONFIG -------------
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const NETWORK = process.env.DOCKER_NETWORK || 'orch-net';
const IMAGE = process.env.PROJECT_IMAGE || 'project-container:latest';

console.log('[worker-server] 🚀 Starting worker-server (High-Concurrency Mode)...');
console.log(`[worker-server] 📌 Network: ${NETWORK}, Image: ${IMAGE}`);

// ---------- Redis connections ----------
const REDIS_HOST = process.env.REDIS_HOST || 'redis-external';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const connectionOpts = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

console.log(`[worker-server] 📌 External Redis: ${REDIS_HOST}:${REDIS_PORT}`);
const externalRedis = new IORedis({ host: REDIS_HOST, port: REDIS_PORT });
externalRedis.on('error', (err) => console.error('[Redis-external] Error:', err.message));

const INTERNAL_REDIS_HOST = process.env.INTERNAL_REDIS_HOST || 'redis-internal';
const INTERNAL_REDIS_PORT = parseInt(process.env.INTERNAL_REDIS_PORT || '6379', 10);
const internalRedis = new IORedis({ host: INTERNAL_REDIS_HOST, port: INTERNAL_REDIS_PORT });
internalRedis.on('error', (err) => console.error('[Redis-internal] Error:', err.message));

console.log(`[worker-server] 📌 Internal Redis: ${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`);

// ---------- Module-level BullMQ Queues (Reused to prevent connection leaks) ----------
const mockSyncQueue = new Queue('mockSyncQueue', { connection: connectionOpts });
const projectQueueProducer = new Queue('projectQueue', { connection: connectionOpts });

// ---------- Pool & Concurrency ----------
const POOL_SIZE = parseInt(process.env.POOL_SIZE, 10) || 10;
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY, 10) || 10;
console.log(`[worker-server] 📌 Pool size: ${POOL_SIZE}, Worker concurrency: ${WORKER_CONCURRENCY}`);

const containerNameFor = (projectId) => `proj-${projectId}`;

// ---------- Helper: ensure network exists ----------
async function ensureNetwork(networkName) {
  try {
    const networks = await docker.listNetworks({ filters: { name: [networkName] } });
    if (networks.length === 0) {
      console.log(`[worker-server] 🔨 Creating network: ${networkName} (bridge)`);
      await docker.createNetwork({ Name: networkName, Driver: 'bridge' });
      console.log(`[worker-server] ✅ Network ${networkName} created.`);
    } else {
      console.log(`[worker-server] ✅ Network ${networkName} already exists.`);
    }
  } catch (err) {
    console.error(`[worker-server] ❌ Failed to ensure network ${networkName}:`, err.message);
    throw err;
  }
}

// ---------- HELPERS ----------
async function getRoute(projectId) {
  const raw = await internalRedis.hget('routes', projectId);
  return raw ? JSON.parse(raw) : null;
}

async function setRoute(projectId, route) {
  await internalRedis.hset('routes', projectId, JSON.stringify(route));
}

async function removeRoute(projectId) {
  await internalRedis.hdel('routes', projectId);
}

const LOCK_TTL = 120;
async function lockProject(projectId) {
  const key = `lock:project:${projectId}`;
  const result = await internalRedis.set(key, 'busy', 'EX', LOCK_TTL, 'NX');
  return result === 'OK';
}

async function unlockProject(projectId) {
  await internalRedis.del(`lock:project:${projectId}`);
}

// ---------- Container Management ----------

async function getContainerInfo(containerName) {
  try {
    const containers = await docker.listContainers({ all: true, filters: { name: [containerName] } });
    if (containers.length === 0) return null;
    const container = docker.getContainer(containers[0].Id);
    const inspect = await container.inspect();
    return {
      container,
      isRunning: inspect.State.Running,
      isPaused: inspect.State.Paused,
    };
  } catch (err) {
    console.error(`[container] ❌ Error getting info for ${containerName}:`, err.message);
    return null;
  }
}

async function syncProjectContainer(containerName, projectId = null, timeout = 30000) {
  const baseUrl = `http://${containerName}:3000`;
  const start = Date.now();
  let healthOk = false;

  while (Date.now() - start < timeout) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        healthOk = true;
        break;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!healthOk) {
    console.error(`[sync] ❌ Health check failed for ${containerName} after ${timeout}ms`);
    return false;
  }

  // Preload all existing routes from MongoDB ProjectApiHistory into this container
  if (projectId) {
    try {
      const history = await ProjectApiHistory.findOne({
        $or: [{ projectID: projectId }, { projectCode: projectId }],
      });
      if (history && Array.isArray(history.endpoints)) {
        for (const ep of history.endpoints) {
          if (!ep || !Array.isArray(ep.versions)) continue;
          for (const ver of ep.versions) {
            const body = {
              version: ver.version,
              method: (ver.method || 'GET').toUpperCase(),
              urlpath: ver.urlPath || ep.baseUrlPath,
              definition: ver.toObject ? ver.toObject() : ver,
            };
            await fetch(`${baseUrl}/internal/apis`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error(`[sync] ❌ Error loading routes from DB for ${containerName}:`, err.message);
    }
  }

  try {
    const syncRes = await fetch(`${baseUrl}/internal/sync`, { method: 'POST' });
    if (!syncRes.ok) return false;
    await syncRes.json();
    return true;
  } catch (err) {
    console.error(`[sync] ❌ Error syncing ${containerName}:`, err.message);
    return false;
  }
}

async function waitForHealth(containerName, timeout = 30000) {
  const baseUrl = `http://${containerName}:3000`;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function ensureProjectContainerRunning(projectId) {
  const locked = await lockProject(projectId, 15);
  if (!locked) {
    await sleep(1000);
    const route = await getRoute(projectId);
    if (route && route.status === 'running') return true;
  }
  try {
    const name = containerNameFor(projectId);
    const info = await getContainerInfo(name);
    if (!info) return false;

    if (info.isPaused) {
      await info.container.unpause().catch(() => {});
      const healthy = await waitForHealth(name);
      if (!healthy) return false;
    } else if (!info.isRunning) {
      await info.container.start().catch(() => {});
      const healthy = await waitForHealth(name);
      if (!healthy) return false;
    } else {
      const healthy = await waitForHealth(name);
      if (!healthy) return false;
    }

    await setRoute(projectId, { containerName: name, status: 'running' });
    return true;
  } finally {
    await unlockProject(projectId).catch(() => {});
  }
}

async function ensureProjectContainer(projectId, isActive) {
  const name = containerNameFor(projectId);
  const info = await getContainerInfo(name);
  const desiredActiveState = isActive === true || isActive === 'true';

  if (!desiredActiveState) {
    if (!info) return true;
    if (info.isRunning && !info.isPaused) {
      await info.container.pause();
      await setRoute(projectId, { containerName: name, status: 'paused' });
      return true;
    }
    if (info.isPaused || !info.isRunning) {
      await setRoute(projectId, { containerName: name, status: info.isPaused ? 'paused' : 'stopped' });
      return true;
    }
    return true;
  }

  if (!info) {
    const locked = await lockProject(projectId);
    if (!locked) throw new Error(`Project ${projectId} locked`);

    try {
      const poolContainer = await acquirePoolContainer(name, projectId);
      let container;
      if (poolContainer) {
        container = poolContainer;
      } else {
        const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;
        container = await docker.createContainer({
          Image: IMAGE,
          name,
          Env: [
            `PROJECT_ID=${projectId}`,
            `INTERNAL_REDIS_URL=${internalRedisUrl}`,
            `FALLBACK_REDIS_URL=redis://host.docker.internal:6379`,
          ],
          HostConfig: {
            NetworkMode: NETWORK,
            RestartPolicy: { Name: 'no' },
            LogConfig: { Type: 'json-file', Config: { 'max-size': '5m', 'max-file': '2' } },
          },
          Labels: { 'managed-by': 'right-system' },
        });
        await container.start();
      }

      const synced = await syncProjectContainer(name, projectId);
      if (!synced) {
        await container.stop().catch(() => {});
        await container.remove({ force: true }).catch(() => {});
        throw new Error(`Sync failed for container ${name}`);
      }

      await setRoute(projectId, { containerName: name, status: 'running' });
      replenishPool().catch(() => {});
      return true;
    } finally {
      await unlockProject(projectId);
    }
  }

  if (info.isRunning && !info.isPaused) {
    await setRoute(projectId, { containerName: name, status: 'running' });
    return true;
  }

  if (info.isPaused) {
    await info.container.unpause();
    const healthy = await waitForHealth(name);
    if (!healthy) return false;
    await setRoute(projectId, { containerName: name, status: 'running' });
    return true;
  }

  if (!info.isRunning) {
    await info.container.start();
    const healthy = await waitForHealth(name);
    if (!healthy) return false;
    const synced = await syncProjectContainer(name, projectId);
    if (!synced) return false;
    await setRoute(projectId, { containerName: name, status: 'running' });
    return true;
  }

  return true;
}

async function callProjectContainer(projectId, method, path, body, retries = 5, delay = 2000) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const route = await getRoute(projectId);
      if (!route) throw new Error(`route not found for project ${projectId}`);
      const url = `http://${route.containerName}:3000${path}`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`project-container responded ${res.status}`);
      return await res.json().catch(() => ({}));
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`Failed after ${retries} attempts: ${lastError.message}`);
}

// ---------- Pool Management ----------
const POOL_LOCK_KEY = 'lock:pool:acquire';
const POOL_LOCK_TTL = 30;
const REPLENISH_LOCK_KEY = 'lock:pool:replenish';
const REPLENISH_LOCK_TTL = 30;

async function acquirePoolContainer(targetName, projectId) {
  const lock = await internalRedis.set(POOL_LOCK_KEY, 'busy', 'EX', POOL_LOCK_TTL, 'NX');
  if (lock !== 'OK') return null;

  try {
    const containers = await docker.listContainers({ all: true, filters: { name: ['proj-pool-'] } });
    const available = containers.find((c) => c.State === 'running' && c.Names.some((n) => n.startsWith('/proj-pool-')));
    if (!available) return null;

    const oldContainer = docker.getContainer(available.Id);
    await oldContainer.stop().catch(() => {});
    await oldContainer.remove({ force: true }).catch(() => {});

    const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;
    const newContainer = await docker.createContainer({
      Image: IMAGE,
      name: targetName,
      Env: [
        `PROJECT_ID=${projectId}`,
        `INTERNAL_REDIS_URL=${internalRedisUrl}`,
        `FALLBACK_REDIS_URL=redis://host.docker.internal:6379`,
      ],
      HostConfig: {
        NetworkMode: NETWORK,
        RestartPolicy: { Name: 'no' },
        LogConfig: { Type: 'json-file', Config: { 'max-size': '5m', 'max-file': '2' } },
      },
      Labels: { 'managed-by': 'right-system' },
    });
    await newContainer.start();
    const synced = await syncProjectContainer(targetName);
    if (!synced) {
      await newContainer.stop().catch(() => {});
      await newContainer.remove({ force: true }).catch(() => {});
      throw new Error(`Sync failed for pool container ${targetName}`);
    }
    return newContainer;
  } finally {
    await internalRedis.del(POOL_LOCK_KEY).catch(() => {});
  }
}

async function replenishPool() {
  const lock = await internalRedis.set(REPLENISH_LOCK_KEY, 'busy', 'EX', REPLENISH_LOCK_TTL, 'NX');
  if (lock !== 'OK') return;

  try {
    const containers = await docker.listContainers({ all: true, filters: { name: ['proj-pool-'] } });
    const running = containers.filter((c) => c.State === 'running' && c.Names.some((n) => n.startsWith('/proj-pool-')));
    const need = POOL_SIZE - running.length;
    if (need <= 0) return;

    const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;
    for (let i = 0; i < need; i++) {
      const name = `proj-pool-${Date.now()}-${i}`;
      const container = await docker.createContainer({
        Image: IMAGE,
        name,
        Env: [
          `PROJECT_ID=pool-replenish-${i}`,
          `INTERNAL_REDIS_URL=${internalRedisUrl}`,
          `FALLBACK_REDIS_URL=redis://host.docker.internal:6379`,
        ],
        HostConfig: {
          NetworkMode: NETWORK,
          RestartPolicy: { Name: 'no' },
          LogConfig: { Type: 'json-file', Config: { 'max-size': '5m', 'max-file': '2' } },
        },
        Labels: { 'managed-by': 'pool' },
      });
      await container.start();
    }
  } catch (err) {
    console.error('[pool] ❌ Replenish error:', err.message);
  } finally {
    await internalRedis.del(REPLENISH_LOCK_KEY).catch(() => {});
  }
}

// ================================================================
// WORKER 1: PROJECT QUEUE
// ================================================================
const projectWorker = new Worker(
  'projectQueue',
  async (job) => {
    const { action, projectId, isActive } = job.data;
    if (!projectId) throw new Error('projectId required');

    if (action === 'create') {
      await job.updateProgress(10);
      const existingRoute = await getRoute(projectId);
      if (existingRoute && existingRoute.status === 'running') return;

      if (existingRoute && existingRoute.containerName) {
        const ok = await ensureProjectContainerRunning(projectId);
        if (ok) {
          await job.updateProgress(100);
          return;
        }
      }

      const locked = await lockProject(projectId);
      if (!locked) throw new Error(`Project ${projectId} locked`);

      try {
        const name = containerNameFor(projectId);
        let container = null;
        await job.updateProgress(20);

        const poolContainer = await acquirePoolContainer(name, projectId);
        if (poolContainer) {
          container = poolContainer;
        } else {
          const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;
          container = await docker.createContainer({
            Image: IMAGE,
            name,
            Env: [
              `PROJECT_ID=${projectId}`,
              `INTERNAL_REDIS_URL=${internalRedisUrl}`,
              `FALLBACK_REDIS_URL=redis://host.docker.internal:6379`,
            ],
            HostConfig: {
              NetworkMode: NETWORK,
              RestartPolicy: { Name: 'no' },
              LogConfig: { Type: 'json-file', Config: { 'max-size': '5m', 'max-file': '2' } },
            },
            Labels: { 'managed-by': 'right-system' },
          });
          await container.start();
        }

        await job.updateProgress(50);
        if (!poolContainer) {
          const synced = await syncProjectContainer(name);
          if (!synced) {
            await container.stop().catch(() => {});
            await container.remove({ force: true }).catch(() => {});
            throw new Error(`Sync failed for new container ${name}`);
          }
        }
        await setRoute(projectId, { containerName: name, status: 'running' });
        await job.updateProgress(90);
        replenishPool().catch(() => {});
        await job.updateProgress(100);
      } finally {
        await unlockProject(projectId);
      }
      return;
    }

    if (action === 'update') {
      await job.updateProgress(30);
      const currentRoute = await getRoute(projectId);
      const currentStatus = currentRoute?.status || 'unknown';
      const desiredStatus = isActive === true || isActive === 'true' ? 'running' : 'paused';

      if (currentStatus === desiredStatus) {
        await job.updateProgress(100);
        return;
      }

      const locked = await lockProject(projectId);
      if (!locked) throw new Error(`Project ${projectId} locked`);
      try {
        const success = await ensureProjectContainer(projectId, isActive);
        if (!success) throw new Error(`Failed to update container for ${projectId}`);
        await job.updateProgress(100);
      } finally {
        await unlockProject(projectId);
      }
      return;
    }

    if (action === 'delete') {
      await job.updateProgress(30);
      const locked = await lockProject(projectId);
      if (!locked) throw new Error(`Project ${projectId} locked`);
      try {
        const route = await getRoute(projectId);
        if (route && route.containerName) {
          const container = docker.getContainer(route.containerName);
          await container.stop().catch(() => {});
          await container.remove({ force: true }).catch(() => {});
        }
        await removeRoute(projectId);
        await job.updateProgress(100);
      } finally {
        await unlockProject(projectId);
      }
      return;
    }

    throw new Error(`unknown projectQueue action: ${action}`);
  },
  {
    connection: connectionOpts,
    concurrency: WORKER_CONCURRENCY,
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  }
);

// ================================================================
// WORKER 2: MOCK SYNC QUEUE
// ================================================================
const mockSyncWorker = new Worker(
  'mockSyncQueue',
  async (job) => {
    const { action, projectId, versionData } = job.data;
    if (!projectId) throw new Error('projectId required');

    await job.updateProgress(10);
    let route = await getRoute(projectId);

    if (!route || route.status !== 'running') {
      await job.updateProgress(20);
      const started = await ensureProjectContainer(projectId, true);
      if (!started) throw new Error(`Failed to wake up container for ${projectId}`);
      route = await getRoute(projectId);
    }

    if (!route || route.status !== 'running') {
      throw new Error(`Project ${projectId} container not ready. Retrying...`);
    }

    const body = versionData ? {
      version: versionData.version,
      method: (versionData.method || 'GET').toUpperCase(),
      urlpath: versionData.urlPath || versionData.urlpath || '',
      definition: versionData.definition || versionData,
    } : {
      version: job.data.version,
      method: (job.data.method || 'GET').toUpperCase(),
      urlpath: job.data.urlpath || job.data.urlPath || '',
      definition: job.data.apihistorydata || job.data.definition || job.data,
    };

    await job.updateProgress(50);
    let result;
    if (action === 'set') {
      result = await callProjectContainer(projectId, 'POST', '/internal/apis', body);
    } else if (action === 'delete') {
      result = await callProjectContainer(projectId, 'DELETE', '/internal/apis', body);
    } else {
      throw new Error(`unknown mockSyncQueue action: ${action}`);
    }

    await job.updateProgress(100);
    return result;
  },
  {
    connection: connectionOpts,
    attempts: 15,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  }
);

// ================================================================
// WORKER 3: LATENCY STORE
// ================================================================
const latencyWorker = new Worker(
  'bullmq-latency-store',
  async (job) => {
    const { project_id, username, rtt, averageRtt } = job.data || {};

    if (averageRtt !== undefined && averageRtt !== null && project_id) {
      const key = `team:latency:${project_id}`;
      await internalRedis.set(key, String(averageRtt), 'EX', 3600);
      return;
    }

    if (project_id && username) {
      const key = `user:latency:${project_id}:${username}`;
      await internalRedis.set(key, String(rtt || 0), 'EX', 3600);
    }
  },
  {
    connection: connectionOpts,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 1800 },
    removeOnFail: { age: 3600 },
  }
);

// ================================================================
// WORKER 4: OPENAPI IMPORT
// ================================================================
const importWorker = new Worker(
  'openapi-import',
  async (job) => {
    const { projectName, spec, username, projectId: existingProjectId } = job.data;

    await job.updateProgress(10);
    let finalProjectId = existingProjectId;

    if (!finalProjectId && projectName) {
      const sanitized = projectName.replace(/[^a-zA-Z0-9]/g, '_');
      finalProjectId = `${username}_${sanitized}`;
    }

    if (!finalProjectId) throw new Error('Project ID or Project Name is required');

    const existingProject = await Project.findOne({
      id: finalProjectId,
      $or: [{ username: username }, { members: username }],
    }).lean();

    if (!existingProject) {
      throw new Error(`Project "${finalProjectId}" not found or accessible.`);
    }

    await job.updateProgress(20);

    const protocol = process.env.PROTOCOL || 'http';
    const host = process.env.HOST || 'localhost:8080';
    const basePath = spec.basePath || '';
    const endpointsMap = {};

    Object.keys(spec.paths || {}).forEach((rawPath) => {
      const fullPath = basePath + rawPath;
      const pathObj = spec.paths[rawPath];

      Object.keys(pathObj || {}).forEach((method) => {
        if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) return;
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
          version: version,
          protocol: protocol,
          statusCode: 200,
          requestBody: operation?.requestBody?.content?.['application/json']?.schema?.example || null,
          responseBody: operation?.responses?.['200']?.content?.['application/json']?.schema?.example || null,
          summary: operation?.summary || '',
          description: operation?.description || '',
          operationId: operation?.operationId || `${method}_${rawPath.replace(/\//g, '_')}`,
          actualFullUrl: actualFullUrl,
        });
      });
    });

    const endpointsArray = Object.values(endpointsMap);
    await job.updateProgress(40);

    if (endpointsArray.length === 0) throw new Error('No valid endpoints found in OpenAPI spec');

    let projectHistory = await ProjectApiHistory.findOne({ projectID: finalProjectId });
    const projectCode = existingProject.invitationCode || finalProjectId;

    if (projectHistory) {
      projectHistory.endpoints = endpointsArray;
      projectHistory.projectCode = projectCode;
      projectHistory.updatedAt = new Date();
      await projectHistory.save();
    } else {
      projectHistory = new ProjectApiHistory({
        projectID: finalProjectId,
        projectCode: projectCode,
        accessByUsernames: [username],
        endpoints: endpointsArray,
      });
      await projectHistory.save();
    }
    await job.updateProgress(60);

    const systemLogs = [];
    for (const endpoint of endpointsArray) {
      for (const ver of endpoint.versions) {
        systemLogs.push({
          projectId: finalProjectId,
          username: username,
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
    await job.updateProgress(70);

    await externalRedis.publish('api_history_update', JSON.stringify({ projectId: finalProjectId })).catch(() => {});

    // Sync to active container
    const containerName = `proj-${finalProjectId}`;
    const containerInfo = await getContainerInfo(containerName);
    if (containerInfo && containerInfo.isRunning) {
      await syncProjectContainer(containerName);
    } else if (containerInfo && containerInfo.isPaused) {
      await containerInfo.container.unpause();
      const healthy = await waitForHealth(containerName);
      if (healthy) {
        await setRoute(finalProjectId, { containerName, status: 'running' });
      }
    }
    await job.updateProgress(80);

    // Enqueue Mock Sync Jobs
    let apiCount = 0;
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
        apiCount++;
      }
    }
    await job.updateProgress(95);

    // Enqueue ensure-running
    await projectQueueProducer.add('ensure-running', {
      action: 'update',
      projectId: finalProjectId,
      isActive: true,
    });

    await job.updateProgress(100);

    return {
      name: projectName,
      endpoints: endpointsArray.length,
      projectId: finalProjectId,
      projectName: existingProject.projectname,
      apiCount: apiCount,
      status: 'completed',
    };
  },
  {
    connection: connectionOpts,
    concurrency: 2,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  }
);

// ---------- Route Resolver Server ----------
const routeResolver = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const projectId = url.pathname.split('/').pop();
  if (!projectId) {
    res.writeHead(400).end(JSON.stringify({ error: 'projectId required' }));
    return;
  }
  try {
    const route = await getRoute(projectId);
    if (!route || !route.containerName) {
      res.writeHead(404).end(JSON.stringify({ error: 'Project not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ containerName: route.containerName, status: route.status }));
  } catch (err) {
    res.writeHead(500).end(JSON.stringify({ error: 'Internal server error' }));
  }
});
routeResolver.listen(3002, '0.0.0.0');

// ---------- Pause / Resume Server ----------
let manuallyPaused = false;
let redisDown = false;

const pauseServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/pause') {
    manuallyPaused = true;
    res.writeHead(200).end(JSON.stringify({ paused: true }));
    return;
  }
  if (req.method === 'POST' && req.url === '/resume') {
    manuallyPaused = false;
    res.writeHead(200).end(JSON.stringify({ paused: false }));
    return;
  }
  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200).end(JSON.stringify({ paused: manuallyPaused, redisDown }));
    return;
  }
  res.writeHead(404).end();
});
pauseServer.listen(3001, '0.0.0.0');

// ---------- Redis health monitor ----------
setInterval(async () => {
  try {
    await internalRedis.ping();
    if (redisDown) redisDown = false;
  } catch {
    if (!redisDown) redisDown = true;
  }
}, 5000);

// ---------- Pre‑pull image ----------
async function ensureProjectImage() {
  try {
    await docker.getImage(IMAGE).inspect();
  } catch (err) {
    try {
      await new Promise((resolve, reject) => {
        docker.pull(IMAGE, (err, stream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err, output) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
    } catch (pullErr) {
      console.error(`[Startup] ❌ Failed to pull ${IMAGE}:`, pullErr.message);
      throw pullErr;
    }
  }
}

// ---------- Startup ----------
async function startup() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://host.docker.internal:27017/mockapi';
  await mongoose.connect(MONGO_URI, { maxPoolSize: 20 });
  console.log('[Startup] ✅ MongoDB connected');

  await internalRedis.ping();
  await externalRedis.ping();
  console.log('[Startup] ✅ Redis engines ready');

  await ensureNetwork(NETWORK);
  await ensureProjectImage();
  await replenishPool();

  console.log(`[Startup] ✅ Worker server ready. Pool size: ${POOL_SIZE}, concurrency: ${WORKER_CONCURRENCY}`);
}

startup().catch((err) => {
  console.error('[Startup] ❌ Fatal error:', err);
  process.exit(1);
});

// ---------- Graceful Shutdown ----------
async function gracefulShutdown() {
  console.log('[worker-server] 🛑 Shutting down gracefully...');
  await projectWorker.close();
  await mockSyncWorker.close();
  await latencyWorker.close();
  await importWorker.close();

  await mockSyncQueue.close().catch(() => {});
  await projectQueueProducer.close().catch(() => {});

  await internalRedis.quit().catch(() => {});
  await externalRedis.quit().catch(() => {});
  await mongoose.disconnect().catch(() => {});

  routeResolver.close(() => {});
  pauseServer.close(() => {});
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);