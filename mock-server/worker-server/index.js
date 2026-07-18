require('dotenv').config();
const { Worker, Queue } = require('bullmq');
const Docker = require('dockerode');
const IORedis = require('ioredis');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

// ---------- MODELS ----------
const Project = require('./models/Project');
const ProjectApiHistory = require('./models/ProjectApiHistory');

// ---------- CONFIG ----------
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const NETWORK = process.env.DOCKER_NETWORK || 'orch-net';
const IMAGE = process.env.PROJECT_IMAGE || 'project-container:latest';

console.log('[worker-server] 🚀 Starting worker-server...');
console.log(`[worker-server] 📌 Network: ${NETWORK}, Image: ${IMAGE}`);

// Redis connections
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

const INTERNAL_REDIS_HOST = process.env.INTERNAL_REDIS_HOST || 'redis-internal';
const INTERNAL_REDIS_PORT = parseInt(process.env.INTERNAL_REDIS_PORT || '6379', 10);
const internalRedis = new IORedis({ host: INTERNAL_REDIS_HOST, port: INTERNAL_REDIS_PORT });

console.log(`[worker-server] 📌 Internal Redis: ${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`);

// ---------- Pool & Concurrency ----------
const POOL_SIZE = parseInt(process.env.POOL_SIZE, 10) || 10;
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY, 10) || 10;
console.log(`[worker-server] 📌 Pool size: ${POOL_SIZE}, Worker concurrency: ${WORKER_CONCURRENCY}`);

const containerNameFor = (projectId) => `proj-${projectId}`;

// ---------- HELPERS ----------
async function getRoute(projectId) {
  console.log(`[route] 🔍 Getting route for project ${projectId}`);
  const raw = await internalRedis.hget('routes', projectId);
  const route = raw ? JSON.parse(raw) : null;
  console.log(`[route] 📋 Route: ${route ? JSON.stringify(route) : 'null'}`);
  return route;
}

async function setRoute(projectId, route) {
  console.log(`[route] 📝 Setting route for project ${projectId}: ${JSON.stringify(route)}`);
  await internalRedis.hset('routes', projectId, JSON.stringify(route));
}

async function removeRoute(projectId) {
  console.log(`[route] 🗑️ Removing route for project ${projectId}`);
  await internalRedis.hdel('routes', projectId);
}

const LOCK_TTL = 120;
async function lockProject(projectId) {
  const key = `lock:project:${projectId}`;
  const result = await internalRedis.set(key, 'busy', 'EX', LOCK_TTL, 'NX');
  console.log(`[lock] 🔒 ${result === 'OK' ? 'Acquired' : 'Failed to acquire'} lock for project ${projectId}`);
  return result === 'OK';
}

async function unlockProject(projectId) {
  console.log(`[lock] 🔓 Unlocking project ${projectId}`);
  await internalRedis.del(`lock:project:${projectId}`);
}

// ---------- Container Management ----------

/** Get container info; returns null if not found */
async function getContainerInfo(containerName) {
  console.log(`[container] 🔍 Getting info for container ${containerName}`);
  try {
    const containers = await docker.listContainers({ all: true, filters: { name: [containerName] } });
    if (containers.length === 0) {
      console.log(`[container] ❌ Container ${containerName} not found`);
      return null;
    }
    const container = docker.getContainer(containers[0].Id);
    const inspect = await container.inspect();
    const info = {
      container,
      isRunning: inspect.State.Running,
      isPaused: inspect.State.Paused,
    };
    console.log(`[container] 📋 ${containerName}: running=${info.isRunning}, paused=${info.isPaused}`);
    return info;
  } catch (err) {
    console.error(`[container] ❌ Error getting info for ${containerName}:`, err.message);
    return null;
  }
}

/** Sync routes to container – returns true only if sync succeeds */
async function syncProjectContainer(containerName, timeout = 30000) {
  console.log(`[sync] 🔄 Syncing container ${containerName}...`);
  const baseUrl = `http://${containerName}:3000`;
  const start = Date.now();
  let healthOk = false;

  // Wait for health endpoint
  while (Date.now() - start < timeout) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        healthOk = true;
        console.log(`[sync] ✅ Health check passed for ${containerName}`);
        break;
      }
    } catch (_) { /* ignore */ }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!healthOk) {
    console.error(`[sync] ❌ Health check failed for ${containerName} after ${timeout}ms`);
    return false;
  }

  // Now trigger sync
  try {
    console.log(`[sync] 📡 Calling /internal/sync on ${containerName}`);
    const syncRes = await fetch(`${baseUrl}/internal/sync`, { method: 'POST' });
    if (!syncRes.ok) {
      console.error(`[sync] ❌ /internal/sync returned ${syncRes.status} for ${containerName}`);
      return false;
    }
    await syncRes.json();
    console.log(`[sync] ✅ Sync successful for ${containerName}`);
    return true;
  } catch (err) {
    console.error(`[sync] ❌ Error syncing ${containerName}:`, err.message);
    return false;
  }
}

/** Ensure the project container is running AND synced */
async function ensureProjectContainerRunning(projectId) {
  console.log(`[ensureRunning] 🏃 Ensuring project ${projectId} is running...`);
  const name = containerNameFor(projectId);
  const info = await getContainerInfo(name);
  if (!info) {
    console.log(`[ensureRunning] ❌ Container ${name} does not exist`);
    return false;
  }

  if (info.isPaused) {
    console.log(`[ensureRunning] ⏸️ Container ${name} is paused – unpausing`);
    await info.container.unpause();
    const synced = await syncProjectContainer(name);
    if (!synced) return false;
  } else if (!info.isRunning) {
    console.log(`[ensureRunning] ⏹️ Container ${name} is stopped – starting`);
    await info.container.start();
    const synced = await syncProjectContainer(name);
    if (!synced) return false;
  } else {
    console.log(`[ensureRunning] ✅ Container ${name} already running – syncing (best effort)`);
    await syncProjectContainer(name).catch(() => {});
  }
  await setRoute(projectId, { containerName: name, status: 'running' });
  console.log(`[ensureRunning] ✅ Project ${projectId} is now running and synced`);
  return true;
}

/** Ensure container exists and is in desired state (active or inactive) */
async function ensureProjectContainer(projectId, isActive) {
  console.log(`[ensureContainer] 📦 Ensuring container for project ${projectId}, active=${isActive}`);
  const name = containerNameFor(projectId);
  const info = await getContainerInfo(name);

  if (isActive === false || isActive === 'false') {
    if (info && info.isRunning) {
      console.log(`[ensureContainer] ⏹️ Stopping container ${name} (inactive)`);
      await info.container.stop();
      await setRoute(projectId, { containerName: name, status: 'stopped' });
    }
    console.log(`[ensureContainer] ✅ Container ${name} is inactive`);
    return true;
  }

  // Need to run
  if (info) {
    if (info.isPaused) {
      console.log(`[ensureContainer] ⏸️ Unpausing container ${name}`);
      await info.container.unpause();
      const synced = await syncProjectContainer(name);
      if (!synced) return false;
    } else if (!info.isRunning) {
      console.log(`[ensureContainer] ▶️ Starting container ${name}`);
      await info.container.start();
      const synced = await syncProjectContainer(name);
      if (!synced) return false;
    } else {
      console.log(`[ensureContainer] ✅ Container ${name} already running – syncing (best effort)`);
      await syncProjectContainer(name).catch(() => {});
    }
    await setRoute(projectId, { containerName: name, status: 'running' });
    return true;
  }

  // Container doesn't exist – create new
  console.log(`[ensureContainer] 🆕 Container ${name} does not exist – creating`);
  const locked = await lockProject(projectId);
  if (!locked) throw new Error(`Project ${projectId} locked`);

  try {
    const poolContainer = await acquirePoolContainer(name, projectId);
    let container;
    if (poolContainer) {
      container = poolContainer;
      console.log(`[ensureContainer] 📦 Acquired pool container for ${projectId}`);
    } else {
      const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;
      console.log(`[ensureContainer] 🔨 Creating new container ${name}`);
      container = await docker.createContainer({
        Image: IMAGE,
        name,
        Env: [`PROJECT_ID=${projectId}`, `INTERNAL_REDIS_URL=${internalRedisUrl}`],
        HostConfig: {
          NetworkMode: NETWORK,
          RestartPolicy: { Name: "no" },
          LogConfig: { Type: "json-file", Config: { "max-size": "5m", "max-file": "2" } }
        },
        Labels: { 'managed-by': 'right-system' },
      });
      await container.start();
      console.log(`[ensureContainer] ✅ Container ${name} started`);
    }
    const synced = await syncProjectContainer(name);
    if (!synced) {
      console.error(`[ensureContainer] ❌ Sync failed for ${name} – rolling back`);
      await container.stop().catch(() => {});
      await container.remove().catch(() => {});
      throw new Error(`Sync failed for container ${name}`);
    }
    await setRoute(projectId, { containerName: name, status: 'running' });
    replenishPool().catch(() => {});
    console.log(`[ensureContainer] ✅ Project ${projectId} is running and synced`);
    return true;
  } finally {
    await unlockProject(projectId);
  }
}

/** Call the project container's internal API (with retries) */
async function callProjectContainer(projectId, method, path, body, retries = 5, delay = 2000) {
  console.log(`[callContainer] 📡 Calling ${method} ${path} on project ${projectId}`);
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const route = await getRoute(projectId);
      if (!route) throw new Error(`route not found for project ${projectId}`);
      const url = `http://${route.containerName}:3000${path}`;
      console.log(`[callContainer] 🔄 Attempt ${i+1}/${retries} – ${url}`);
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`project-container responded ${res.status}`);
      const result = await res.json().catch(() => ({}));
      console.log(`[callContainer] ✅ Call succeeded (${res.status})`);
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`[callContainer] ⚠️ Attempt ${i+1} failed: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  console.error(`[callContainer] ❌ All ${retries} attempts failed`);
  throw new Error(`Failed after ${retries} attempts: ${lastError.message}`);
}

// ---------- Pool Management ----------
const POOL_LOCK_KEY = 'lock:pool:acquire';
const POOL_LOCK_TTL = 30;
const REPLENISH_LOCK_KEY = 'lock:pool:replenish';
const REPLENISH_LOCK_TTL = 30;

async function acquirePoolContainer(targetName, projectId) {
  console.log(`[pool] 🔒 Acquiring pool container for target ${targetName}, project ${projectId}`);
  const lock = await internalRedis.set(POOL_LOCK_KEY, 'busy', 'EX', POOL_LOCK_TTL, 'NX');
  if (lock !== 'OK') {
    console.log('[pool] ⏭️ Pool lock not acquired – no pool container available');
    return null;
  }

  try {
    const containers = await docker.listContainers({ all: true, filters: { name: ['proj-pool-'] } });
    const available = containers.find(c => c.State === 'running' && c.Names.some(n => n.startsWith('/proj-pool-')));
    if (!available) {
      console.log('[pool] ❌ No available pool containers found');
      return null;
    }

    const poolName = available.Names[0].replace('/', '');
    console.log(`[pool] 📦 Found pool container ${poolName} – reusing`);
    const oldContainer = docker.getContainer(available.Id);
    await oldContainer.stop().catch(() => {});
    await oldContainer.remove().catch(() => {});

    const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;
    console.log(`[pool] 🔨 Creating new container ${targetName} from pool`);
    const newContainer = await docker.createContainer({
      Image: IMAGE,
      name: targetName,
      Env: [`PROJECT_ID=${projectId}`, `INTERNAL_REDIS_URL=${internalRedisUrl}`],
      HostConfig: {
        NetworkMode: NETWORK,
        RestartPolicy: { Name: "no" },
        LogConfig: { Type: "json-file", Config: { "max-size": "5m", "max-file": "2" } }
      },
      Labels: { 'managed-by': 'right-system' },
    });
    await newContainer.start();
    console.log(`[pool] ✅ Container ${targetName} started from pool`);
    const synced = await syncProjectContainer(targetName);
    if (!synced) {
      console.error(`[pool] ❌ Sync failed for ${targetName} – rolling back`);
      await newContainer.stop().catch(() => {});
      await newContainer.remove().catch(() => {});
      throw new Error(`Sync failed for pool-acquired container ${targetName}`);
    }
    console.log(`[pool] ✅ Pool acquisition successful for ${targetName}`);
    return newContainer;
  } finally {
    await internalRedis.del(POOL_LOCK_KEY).catch(() => {});
  }
}

async function replenishPool() {
  console.log('[pool] 🔄 Replenishing pool...');
  const lock = await internalRedis.set(REPLENISH_LOCK_KEY, 'busy', 'EX', REPLENISH_LOCK_TTL, 'NX');
  if (lock !== 'OK') {
    console.log('[pool] ⏭️ Replenish lock not acquired – another process is doing it');
    return;
  }

  try {
    const containers = await docker.listContainers({ all: true, filters: { name: ['proj-pool-'] } });
    const running = containers.filter(c => c.State === 'running' && c.Names.some(n => n.startsWith('/proj-pool-')));
    const need = POOL_SIZE - running.length;
    console.log(`[pool] 📊 Current running pool containers: ${running.length}, need: ${need}`);
    if (need <= 0) {
      console.log('[pool] ✅ Pool is full, no action needed');
      return;
    }

    const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;
    for (let i = 0; i < need; i++) {
      const name = `proj-pool-${Date.now()}-${i}`;
      console.log(`[pool] 🔨 Creating pool container ${name}`);
      const container = await docker.createContainer({
        Image: IMAGE,
        name,
        Env: [`PROJECT_ID=pool-replenish-${i}`, `INTERNAL_REDIS_URL=${internalRedisUrl}`],
        HostConfig: {
          NetworkMode: NETWORK,
          RestartPolicy: { Name: "no" },
          LogConfig: { Type: "json-file", Config: { "max-size": "5m", "max-file": "2" } }
        },
        Labels: { 'managed-by': 'pool' },
      });
      await container.start();
      console.log(`[pool] ✅ Pool container ${name} started`);
    }
    console.log(`[pool] ✅ Replenished ${need} containers`);
  } catch (err) {
    console.error('[pool] ❌ Replenish error:', err.message);
  } finally {
    await internalRedis.del(REPLENISH_LOCK_KEY).catch(() => {});
  }
}

// ================================================================
// WORKER 1: PROJECT QUEUE
// ================================================================
console.log('[worker-server] 📡 Creating projectQueue worker...');
const projectWorker = new Worker(
  'projectQueue',
  async (job) => {
    console.log(`[projectQueue] 📨 Received job ${job.id}:`, JSON.stringify(job.data, null, 2));
    const { action, projectId, isActive } = job.data;
    if (!projectId) throw new Error('projectId required');

    if (action === 'create') {
      console.log(`[projectQueue] 🆕 Create action for project ${projectId}`);
      const existingRoute = await getRoute(projectId);
      if (existingRoute && existingRoute.status === 'running') {
        console.log(`[projectQueue] ⏭️ Project ${projectId} already running`);
        return;
      }

      if (existingRoute && existingRoute.containerName) {
        console.log(`[projectQueue] 🔄 Attempting to wake existing container for ${projectId}`);
        const ok = await ensureProjectContainerRunning(projectId);
        if (ok) {
          console.log(`[projectQueue] ✅ Existing container for ${projectId} is now running`);
          return;
        }
      }

      console.log(`[projectQueue] 🆕 Creating new container for ${projectId}`);
      const locked = await lockProject(projectId);
      if (!locked) throw new Error(`Project ${projectId} locked`);

      try {
        const name = containerNameFor(projectId);
        let container = null;

        const poolContainer = await acquirePoolContainer(name, projectId);
        if (poolContainer) {
          container = poolContainer;
          console.log(`[projectQueue] 📦 Acquired pool container for ${projectId}`);
        } else {
          const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;
          console.log(`[projectQueue] 🔨 Creating container ${name}`);
          container = await docker.createContainer({
            Image: IMAGE,
            name,
            Env: [`PROJECT_ID=${projectId}`, `INTERNAL_REDIS_URL=${internalRedisUrl}`],
            HostConfig: {
              NetworkMode: NETWORK,
              RestartPolicy: { Name: "no" },
              LogConfig: { Type: "json-file", Config: { "max-size": "5m", "max-file": "2" } }
            },
            Labels: { 'managed-by': 'right-system' },
          });
          await container.start();
          console.log(`[projectQueue] ✅ Container ${name} started`);
        }

        if (!poolContainer) {
          const synced = await syncProjectContainer(name);
          if (!synced) {
            console.error(`[projectQueue] ❌ Sync failed for ${name} – rolling back`);
            await container.stop().catch(() => {});
            await container.remove().catch(() => {});
            throw new Error(`Sync failed for new container ${name}`);
          }
        }
        await setRoute(projectId, { containerName: name, status: 'running' });
        replenishPool().catch(() => {});
        console.log(`[projectQueue] ✅ Project ${projectId} created and running`);
      } finally {
        await unlockProject(projectId);
      }
      return;
    }

    if (action === 'update') {
      console.log(`[projectQueue] 🔄 Update action for project ${projectId}, active=${isActive}`);
      const locked = await lockProject(projectId);
      if (!locked) throw new Error(`Project ${projectId} locked`);
      try {
        const success = await ensureProjectContainer(projectId, isActive);
        if (!success) throw new Error(`Failed to update container for ${projectId}`);
        console.log(`[projectQueue] ✅ Project ${projectId} updated successfully`);
      } finally {
        await unlockProject(projectId);
      }
      return;
    }

    if (action === 'delete') {
      console.log(`[projectQueue] 🗑️ Delete action for project ${projectId}`);
      const locked = await lockProject(projectId);
      if (!locked) throw new Error(`Project ${projectId} locked`);
      try {
        const route = await getRoute(projectId);
        if (route && route.containerName) {
          const container = docker.getContainer(route.containerName);
          console.log(`[projectQueue] ⏹️ Stopping and removing container ${route.containerName}`);
          await container.stop().catch(() => {});
          await container.remove().catch(() => {});
        }
        await removeRoute(projectId);
        console.log(`[projectQueue] ✅ Project ${projectId} deleted`);
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
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: true,
    lockDuration: 120000,
    stalledInterval: 60000,
    maxStalledCount: 3,
  }
);

// ================================================================
// WORKER 2: MOCK SYNC QUEUE
// ================================================================
console.log('[worker-server] 📡 Creating mockSyncQueue worker...');
const mockSyncWorker = new Worker(
  'mockSyncQueue',
  async (job) => {
    console.log(`[mockSyncQueue] 📨 Received job ${job.id}:`, JSON.stringify(job.data, null, 2));
    const { action, projectId, versionData } = job.data;
    if (!projectId) throw new Error('projectId required');

    let route = await getRoute(projectId);

    // 1. If project exists but is sleeping, WAKE IT UP (and sync)
    if (route && route.status !== 'running') {
      console.log(`[mockSyncQueue] ⏰ Waking up sleeping container for project ${projectId}...`);
      const started = await ensureProjectContainerRunning(projectId);
      if (!started) throw new Error(`Failed to wake up container for ${projectId}`);
      route = await getRoute(projectId);
    }

    // 2. If route is still null/not running, it means container is being built. Retry.
    if (!route || route.status !== 'running') {
      console.log(`[mockSyncQueue] ⏳ Container for ${projectId} not ready yet. Retrying...`);
      throw new Error(`Project ${projectId} container not ready. BullMQ will retry.`);
    }

    // 3. Normalize payload (ensure urlpath exists)
    const body = versionData ? {
      ...versionData,
      urlpath: versionData.urlPath || versionData.urlpath || ''
    } : {
      version: job.data.version,
      method: job.data.method,
      urlpath: job.data.urlpath || job.data.urlPath || '',
      definition: job.data.apihistorydata,
    };

    console.log(`[mockSyncQueue] 🚀 Sending ${action} to project container for ${projectId}`);
    if (action === 'set') {
      return callProjectContainer(projectId, 'POST', '/internal/apis', body);
    }
    if (action === 'delete') {
      return callProjectContainer(projectId, 'DELETE', '/internal/apis', body);
    }
    throw new Error(`unknown mockSyncQueue action: ${action}`);
  },
  {
    connection: connectionOpts,
    attempts: 15,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
    lockDuration: 60000,
    stalledInterval: 30000,
    maxStalledCount: 3,
  }
);

// ================================================================
// WORKER 3: LATENCY STORE (Internal Redis)
// ================================================================
console.log('[worker-server] 📡 Creating latency-store worker...');
const latencyWorker = new Worker(
  'latency-store',
  async (job) => {
    console.log(`[latency-store] 📨 Received job ${job.id}:`, JSON.stringify(job.data, null, 2));
    const { project_id, username, rtt } = job.data;
    const key = `latency:${project_id}:${username}`;
    await internalRedis.set(key, rtt);
    console.log(`[latency-store] ✅ Saved ${username} RTT: ${rtt}ms for project ${project_id}`);
  },
  {
    connection: connectionOpts,
    removeOnComplete: true,
    removeOnFail: true,
  }
);

// ================================================================
// WORKER 4: OPENAPI IMPORT
// ================================================================
console.log('[worker-server] 📡 Creating openapi-import worker...');
const importWorker = new Worker(
  'openapi-import',
  async (job) => {
    console.log(`[openapi-import] 📨 Received job ${job.id}:`, JSON.stringify(job.data, null, 2));
    const { projectName, spec, username } = job.data;
    console.log(`[openapi-import] 🏗️ Processing import for project "${projectName}"`);

    job.updateProgress(10);

    const existingProject = await Project.findOne({ username, projectname: projectName });
    let projectId;
    let isNewProject = false;

    if (existingProject) {
      projectId = existingProject.id;
      console.log(`[openapi-import] 📂 Project "${projectName}" exists (ID: ${projectId}) – updating`);
    } else {
      projectId = uuidv4();
      const invitationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      console.log(`[openapi-import] 🆕 Creating new project "${projectName}" with ID ${projectId}`);
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
      isNewProject = true;
      console.log(`[openapi-import] ✅ Project ${projectId} created`);
    }

    job.updateProgress(30);

    const basePath = spec.basePath || '';
    const endpointsMap = {};

    Object.keys(spec.paths).forEach(rawPath => {
      const fullPath = basePath + rawPath;
      const pathObj = spec.paths[rawPath];
      
      Object.keys(pathObj).forEach(method => {
        if (!['get', 'post', 'put', 'delete', 'patch', 'options'].includes(method)) return;
        const operation = pathObj[method];

        if (!endpointsMap[fullPath]) {
          endpointsMap[fullPath] = { baseUrlPath: fullPath, versions: [] };
        }
        
        endpointsMap[fullPath].versions.push({
          method: method.toUpperCase(),
          urlPath: fullPath,
          version: 'v1',
          protocol: 'https',
          statusCode: 200,
          requestBody: operation.requestBody?.content?.['application/json']?.schema?.example || null,
          responseBody: operation.responses?.['200']?.content?.['application/json']?.schema?.example || null,
        });
      });
    });

    const endpointsArray = Object.values(endpointsMap);
    console.log(`[openapi-import] 📊 Extracted ${endpointsArray.length} endpoints from spec`);
    job.updateProgress(50);

    if (isNewProject) {
      const projectApiHistory = new ProjectApiHistory({
        projectID: projectId,
        projectCode: projectId,
        accessByUsernames: [username],
        endpoints: endpointsArray,
      });
      await projectApiHistory.save();
      console.log(`[openapi-import] ✅ ProjectApiHistory saved for new project`);
    } else {
      const history = await ProjectApiHistory.findOne({ projectID: projectId });
      if (history) {
        history.endpoints = endpointsArray;
        history.updatedAt = new Date();
        await history.save();
        console.log(`[openapi-import] ✅ ProjectApiHistory updated for existing project`);
      } else {
        const projectApiHistory = new ProjectApiHistory({
          projectID: projectId,
          projectCode: projectId,
          accessByUsernames: [username],
          endpoints: endpointsArray,
        });
        await projectApiHistory.save();
        console.log(`[openapi-import] ✅ ProjectApiHistory created for existing project`);
      }
    }

    job.updateProgress(70);

    const projectQueue = new Queue('projectQueue', { connection: connectionOpts });
    console.log(`[openapi-import] 🏗️ Adding ${isNewProject ? 'create' : 'update'} project job to queue for ${projectId}`);
    await projectQueue.add('create-project', { 
      action: isNewProject ? 'create' : 'update',
      projectId,
      isActive: true 
    });

    job.updateProgress(85);

    const mockSyncQueue = new Queue('mockSyncQueue', { connection: connectionOpts });
    let apiCount = 0;
    for (const endpoint of endpointsArray) {
      for (const ver of endpoint.versions) {
        await mockSyncQueue.add('sync-api', {
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
        });
        apiCount++;
      }
    }
    console.log(`[openapi-import] 📤 Queued ${apiCount} API sync jobs for project ${projectId}`);

    job.updateProgress(100);

    const result = {
      name: projectName,
      endpoints: endpointsArray.length,
      projectId,
      isNewProject
    };

    console.log(`[openapi-import] ✅ Job ${job.id} completed:`, result);
    return result;
  },
  {
    connection: connectionOpts,
    concurrency: 1,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  }
);

// Event listeners for import worker
importWorker.on('completed', (job) => {
  console.log(`[openapi-import] ✅ Job ${job.id} completed successfully`);
});
importWorker.on('failed', (job, err) => {
  console.error(`[openapi-import] ❌ Job ${job.id} failed:`, err.message);
});

console.log('[worker-server] Workers started:');
console.log('  - projectQueue (container management)');
console.log('  - mockSyncQueue (API sync)');
console.log('  - latency-store (RTT storage)');
console.log('  - openapi-import (OpenAPI spec import)');

// ---------- Route Resolver ----------
const routeResolver = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const projectId = url.pathname.split('/').pop();
  if (!projectId) {
    res.writeHead(400).end(JSON.stringify({ error: 'projectId required' }));
    return;
  }
  console.log(`[routeResolver] 🔍 Querying route for project ${projectId}`);
  try {
    const route = await getRoute(projectId);
    if (!route || !route.containerName) {
      res.writeHead(404).end(JSON.stringify({ error: 'Project not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ containerName: route.containerName, status: route.status }));
  } catch (err) {
    console.error(`[routeResolver] ❌ Error: ${err.message}`);
    res.writeHead(500).end(JSON.stringify({ error: 'Internal server error' }));
  }
});
routeResolver.listen(3002, '0.0.0.0');
console.log('[worker-server] 🌐 Route resolver listening on port 3002');

// ---------- Pause / Resume ----------
let manuallyPaused = false;
let redisDown = false;

const pauseServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/pause') {
    manuallyPaused = true;
    console.log('[pauseServer] ⏸️ Pause requested');
    res.writeHead(200).end(JSON.stringify({ paused: true }));
    return;
  }
  if (req.method === 'POST' && req.url === '/resume') {
    manuallyPaused = false;
    console.log('[pauseServer] ▶️ Resume requested');
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
console.log('[worker-server] 🛑 Pause/resume server listening on port 3001');

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
  console.log(`[Startup] 🔍 Checking for image ${IMAGE}...`);
  try {
    await docker.getImage(IMAGE).inspect();
    console.log(`[Startup] ✅ Image ${IMAGE} already present locally.`);
  } catch (err) {
    console.log(`[Startup] 📥 Image ${IMAGE} not found. Pulling now...`);
    try {
      await new Promise((resolve, reject) => {
        docker.pull(IMAGE, (err, stream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err, output) => {
            if (err) return reject(err);
            console.log(`[Startup] ✅ Successfully pulled ${IMAGE}`);
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
  console.log(`[Startup] 📌 Connecting to MongoDB: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  console.log('[Startup] ✅ MongoDB connected');

  // Wait for internal Redis
  console.log('[Startup] 🔄 Waiting for internal Redis...');
  let internalReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      await internalRedis.ping();
      internalReady = true;
      console.log('[Startup] ✅ Internal Redis ready');
      break;
    } catch {
      console.log(`[Startup] ⏳ Internal Redis not ready (attempt ${i+1}/30)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!internalReady) {
    console.error('[Startup] ❌ Internal Redis not ready – exiting');
    process.exit(1);
  }

  // Wait for external Redis
  console.log('[Startup] 🔄 Waiting for external Redis...');
  let externalReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      await externalRedis.ping();
      externalReady = true;
      console.log('[Startup] ✅ External Redis ready');
      break;
    } catch {
      console.log(`[Startup] ⏳ External Redis not ready (attempt ${i+1}/30)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!externalReady) {
    console.error('[Startup] ❌ External Redis not ready – exiting');
    process.exit(1);
  }

  await ensureProjectImage();

  // Clean up old BullMQ keys (only for our queues)
  console.log('[Startup] 🧹 Cleaning up old BullMQ keys...');
  const ourQueuePrefixes = ['bull:projectQueue:', 'bull:mockSyncQueue:', 'bull:latency-store:', 'bull:openapi-import:'];
  for (const prefix of ourQueuePrefixes) {
    try {
      const keys = await externalRedis.keys(prefix + '*');
      if (keys.length) {
        console.log(`[Startup] 🗑️ Deleting ${keys.length} keys for prefix ${prefix}`);
        await externalRedis.del(keys);
      }
    } catch (_) {}
  }
  // Also clean internal Redis (just in case)
  try {
    const keys = await internalRedis.keys('bull:*');
    if (keys.length) {
      console.log(`[Startup] 🗑️ Deleting ${keys.length} keys from internal Redis`);
      await internalRedis.del(keys);
    }
  } catch (_) {}

  await replenishPool();

  console.log(`[Startup] ✅ Worker server ready. Pool size: ${POOL_SIZE}, concurrency: ${WORKER_CONCURRENCY}`);
}

startup().catch(err => {
  console.error('[Startup] ❌ Fatal error:', err);
  process.exit(1);
});

// ---------- Graceful Shutdown ----------
async function gracefulShutdown() {
  console.log('[worker-server] 🔴 Received shutdown signal, cleaning up...');

  await projectWorker.close();
  await mockSyncWorker.close();
  await latencyWorker.close();
  await importWorker.close();

  await internalRedis.quit().catch(() => {});
  await externalRedis.quit().catch(() => {});
  await mongoose.disconnect().catch(() => {});

  routeResolver.close(() => {});
  pauseServer.close(() => {});

  console.log('[worker-server] 👋 Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);