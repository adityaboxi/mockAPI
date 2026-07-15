// worker-server/index.js
require('dotenv').config();  
const { Worker, Queue } = require('bullmq');
const Docker = require('dockerode');
const IORedis = require('ioredis');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

// ---------- MODELS (self‑contained) ----------
const Project = require('./models/Project');
const ProjectApiHistory = require('./models/ProjectApiHistory');

// ---------- CONFIG ----------
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const NETWORK = process.env.DOCKER_NETWORK || 'orch-net';
const IMAGE = process.env.PROJECT_IMAGE || 'project-container:latest';

// External Redis (BullMQ)
const REDIS_HOST = process.env.REDIS_HOST || 'redis-external';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const connection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const externalRedis = new IORedis({ host: REDIS_HOST, port: REDIS_PORT });

// Internal Redis (routes, locks, latency keys)
const INTERNAL_REDIS_HOST = process.env.INTERNAL_REDIS_HOST || 'redis-internal';
const INTERNAL_REDIS_PORT = parseInt(process.env.INTERNAL_REDIS_PORT || '6379', 10);
const internalRedis = new IORedis({ host: INTERNAL_REDIS_HOST, port: INTERNAL_REDIS_PORT });

// ---------- Pool & Concurrency ----------
const POOL_SIZE = parseInt(process.env.POOL_SIZE, 10) || 10;
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY, 10) || 10;

const containerNameFor = (projectId) => `proj-${projectId}`;

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
async function isProjectLocked(projectId) {
  const val = await internalRedis.get(`lock:project:${projectId}`);
  return val !== null;
}

// ---------- Container Management ----------
async function ensureProjectContainerRunning(projectId) {
  const name = containerNameFor(projectId);
  const info = await getContainerInfo(name);
  if (!info) return false;

  if (info.isPaused) {
    await info.container.unpause();
    await syncProjectContainer(name);
  } else if (!info.isRunning) {
    await info.container.start();
    await syncProjectContainer(name);
  }
  await setRoute(projectId, { containerName: name, status: 'running' });
  return true;
}

async function ensureProjectContainer(projectId, isActive) {
  const name = containerNameFor(projectId);
  const info = await getContainerInfo(name);

  if (isActive === false || isActive === 'false') {
    if (info && info.isRunning) {
      await info.container.stop();
      await setRoute(projectId, { containerName: name, status: 'stopped' });
    }
    return true;
  }

  if (info) {
    if (info.isPaused) {
      await info.container.unpause();
      await syncProjectContainer(name);
    } else if (!info.isRunning) {
      await info.container.start();
      await syncProjectContainer(name);
    }
    await setRoute(projectId, { containerName: name, status: 'running' });
    return true;
  }

  const locked = await lockProject(projectId);
  if (!locked) throw new Error(`Project ${projectId} locked`);

  try {
    const poolContainer = await acquirePoolContainer(name, projectId);
    let container;
    if (poolContainer) {
      container = poolContainer;
      console.log(`[update] Acquired pool container for ${projectId}`);
    } else {
      const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;
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
      await syncProjectContainer(name);
      console.log(`[update] Created new container for ${projectId}`);
    }
    await setRoute(projectId, { containerName: name, status: 'running' });
    replenishPool().catch(() => {});
    return true;
  } finally {
    await unlockProject(projectId);
  }
}

// ---------- Call Project Container ----------
async function callProjectContainer(projectId, method, path, body, retries = 5, delay = 2000) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const route = await getRoute(projectId);
      if (!route) throw new Error(`route not found for project ${projectId}`);
      const res = await fetch(`http://${route.containerName}:3000${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`project-container responded ${res.status}`);
      return res.json().catch(() => ({}));
    } catch (err) {
      lastError = err;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error(`Failed after ${retries} attempts: ${lastError.message}`);
}

// ---------- Sync Helper ----------
async function syncProjectContainer(containerName, timeout = 30000) {
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
    } catch (_) { /* ignore */ }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!healthOk) return false;

  try {
    const syncRes = await fetch(`${baseUrl}/internal/sync`, { method: 'POST' });
    if (!syncRes.ok) return false;
    await syncRes.json();
    return true;
  } catch (_) {
    return true;
  }
}

// ---------- Container info helper ----------
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
  } catch (_) {
    return null;
  }
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
    const available = containers.find(c => c.State === 'running' && c.Names.some(n => n.startsWith('/proj-pool-')));
    if (!available) return null;

    const poolName = available.Names[0].replace('/', '');
    const oldContainer = docker.getContainer(available.Id);
    await oldContainer.stop().catch(() => {});
    await oldContainer.remove().catch(() => {});

    const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;
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
    await syncProjectContainer(targetName);
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
    const running = containers.filter(c => c.State === 'running' && c.Names.some(n => n.startsWith('/proj-pool-')));
    const need = POOL_SIZE - running.length;
    if (need <= 0) return;

    const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;
    for (let i = 0; i < need; i++) {
      const name = `proj-pool-${Date.now()}-${i}`;
      await docker.createContainer({
        Image: IMAGE,
        name,
        Env: [`PROJECT_ID=pool-replenish-${i}`, `INTERNAL_REDIS_URL=${internalRedisUrl}`],
        HostConfig: {
          NetworkMode: NETWORK,
          RestartPolicy: { Name: "no" },
          LogConfig: { Type: "json-file", Config: { "max-size": "5m", "max-file": "2" } }
        },
        Labels: { 'managed-by': 'pool' },
      }).then(c => c.start());
    }
  } catch (err) {
    console.error('[pool] Replenish error:', err.message);
  } finally {
    await internalRedis.del(REPLENISH_LOCK_KEY).catch(() => {});
  }
}

// ================================================================
// WORKER 1: PROJECT QUEUE
// ================================================================
new Worker(
  'projectQueue',
  async (job) => {
    const { action, projectId, isActive } = job.data;
    if (!projectId) throw new Error('projectId required');

    if (action === 'create') {
      const existingRoute = await getRoute(projectId);
      if (existingRoute && existingRoute.status === 'running') {
        console.log(`[create] Project ${projectId} already running`);
        return;
      }

      if (existingRoute && existingRoute.containerName) {
        const ok = await ensureProjectContainerRunning(projectId);
        if (ok) {
          console.log(`[create] Existing container for ${projectId} is now running`);
          return;
        }
      }

      const locked = await lockProject(projectId);
      if (!locked) throw new Error(`Project ${projectId} locked`);

      try {
        const name = containerNameFor(projectId);
        let container = null;

        const poolContainer = await acquirePoolContainer(name, projectId);
        if (poolContainer) {
          container = poolContainer;
          console.log(`[create] Acquired pool container for ${projectId}`);
        } else {
          const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;
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
          await syncProjectContainer(name);
          console.log(`[create] Created new container for ${projectId}`);
        }

        await setRoute(projectId, { containerName: name, status: 'running' });
        replenishPool().catch(() => {});
      } finally {
        await unlockProject(projectId);
      }
      return;
    }

    if (action === 'update') {
      const locked = await lockProject(projectId);
      if (!locked) throw new Error(`Project ${projectId} locked`);
      try {
        const success = await ensureProjectContainer(projectId, isActive);
        if (!success) throw new Error(`Failed to update container for ${projectId}`);
      } finally {
        await unlockProject(projectId);
      }
      return;
    }

    if (action === 'delete') {
      const locked = await lockProject(projectId);
      if (!locked) throw new Error(`Project ${projectId} locked`);
      try {
        const route = await getRoute(projectId);
        if (route) {
          const container = docker.getContainer(route.containerName);
          await container.stop().catch(() => {});
          await container.remove().catch(() => {});
        }
        await removeRoute(projectId);
      } finally {
        await unlockProject(projectId);
      }
      return;
    }

    throw new Error(`unknown projectQueue action: ${action}`);
  },
  {
    connection,
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
new Worker(
  'mockSyncQueue',
  async (job) => {
    const { action, projectId, versionData } = job.data;
    if (!projectId) throw new Error('projectId required');

    const route = await getRoute(projectId);
    if (!route || route.status !== 'running') {
      throw new Error(`Project ${projectId} container not ready`);
    }

    if (action === 'set') {
      const body = versionData || {
        version: job.data.version,
        method: job.data.method,
        urlpath: job.data.urlpath,
        definition: job.data.apihistorydata,
      };
      return callProjectContainer(projectId, 'POST', '/internal/apis', body);
    }
    if (action === 'delete') {
      const body = versionData || {
        version: job.data.version,
        method: job.data.method,
        urlpath: job.data.urlpath,
      };
      return callProjectContainer(projectId, 'DELETE', '/internal/apis', body);
    }
    throw new Error(`unknown mockSyncQueue action: ${action}`);
  },
  {
    connection,
    attempts: 10,
    backoff: { type: 'exponential', delay: 1000 },
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
new Worker(
  'latency-store',
  async (job) => {
    const { project_id, username, rtt } = job.data;
    const key = `latency:${project_id}:${username}`;
    await internalRedis.set(key, rtt);
    console.log(`[latency-store] Saved ${username} RTT: ${rtt}ms for project ${project_id}`);
  },
  {
    connection,
    removeOnComplete: true,
    removeOnFail: true,
  }
);

// ================================================================
// WORKER 4: OPENAPI IMPORT
// ================================================================
new Worker(
  'openapi-import',
  async (job) => {
    const { projectName, spec, username } = job.data;
    console.log(`[openapi-import] Processing job ${job.id} for project: ${projectName}`);

    job.updateProgress(10);

    const existingProject = await Project.findOne({ 
      username, 
      projectname: projectName 
    });

    let projectId;
    let isNewProject = false;

    if (existingProject) {
      projectId = existingProject.id;
      console.log(`[openapi-import] Project "${projectName}" already exists. Updating...`);
    } else {
      projectId = uuidv4();
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
      isNewProject = true;
      console.log(`[openapi-import] Created new project: ${projectId}`);
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
    job.updateProgress(50);

    if (isNewProject) {
      const projectApiHistory = new ProjectApiHistory({
        projectID: projectId,
        projectCode: projectId,
        accessByUsernames: [username],
        endpoints: endpointsArray,
      });
      await projectApiHistory.save();
    } else {
      const history = await ProjectApiHistory.findOne({ projectID: projectId });
      if (history) {
        history.endpoints = endpointsArray;
        history.updatedAt = new Date();
        await history.save();
      } else {
        const projectApiHistory = new ProjectApiHistory({
          projectID: projectId,
          projectCode: projectId,
          accessByUsernames: [username],
          endpoints: endpointsArray,
        });
        await projectApiHistory.save();
      }
    }

    job.updateProgress(70);

    const projectQueue = new Queue('projectQueue', { connection });
    await projectQueue.add('create-project', { 
      action: isNewProject ? 'create' : 'update',
      projectId,
      isActive: true 
    });

    job.updateProgress(85);

    const mockSyncQueue = new Queue('mockSyncQueue', { connection });
    const syncDelay = 5000;
    
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
        }, { delay: syncDelay });
      }
    }

    job.updateProgress(100);

    const result = {
      name: projectName,
      endpoints: endpointsArray.length,
      projectId,
      isNewProject
    };

    console.log(`[openapi-import] Job ${job.id} completed.`);
    return result;
  },
  {
    connection,
    concurrency: 1,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  }
).on('completed', (job) => {
  console.log(`[openapi-import] ✅ Job ${job.id} completed successfully`);
}).on('failed', (job, err) => {
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
  try {
    const route = await getRoute(projectId);
    if (!route || !route.containerName) {
      res.writeHead(404).end(JSON.stringify({ error: 'Project not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ containerName: route.containerName, status: route.status }));
  } catch (_) {
    res.writeHead(500).end(JSON.stringify({ error: 'Internal server error' }));
  }
});
routeResolver.listen(3002, '0.0.0.0');

// ---------- Pause / Resume ----------
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
    console.log(`[Startup] Image ${IMAGE} already present locally.`);
  } catch (err) {
    console.log(`[Startup] Image ${IMAGE} not found. Pulling now...`);
    try {
      await new Promise((resolve, reject) => {
        docker.pull(IMAGE, (err, stream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err, output) => {
            if (err) return reject(err);
            console.log(`[Startup] Successfully pulled ${IMAGE}`);
            resolve();
          });
        });
      });
    } catch (pullErr) {
      console.error(`[Startup] Failed to pull ${IMAGE}:`, pullErr.message);
      throw pullErr;
    }
  }
}

// ---------- Startup ----------
async function startup() {
  // Connect to MongoDB for worker models
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://host.docker.internal:27017/mockapi';
  await mongoose.connect(MONGO_URI);
  console.log('[worker-server] MongoDB connected');

  let internalReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      await internalRedis.ping();
      internalReady = true;
      break;
    } catch {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!internalReady) process.exit(1);

  let externalReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      await externalRedis.ping();
      externalReady = true;
      break;
    } catch {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!externalReady) process.exit(1);

  await ensureProjectImage();

  // Clean up stale BullMQ keys
  try {
    const keys = await externalRedis.keys('bull:*');
    if (keys.length) await externalRedis.del(keys);
  } catch (_) {}
  try {
    const keys = await internalRedis.keys('bull:*');
    if (keys.length) await internalRedis.del(keys);
  } catch (_) {}

  await replenishPool();

  console.log(`[Startup] Worker server ready. Pool size: ${POOL_SIZE}, concurrency: ${WORKER_CONCURRENCY}`);
}
startup();

// ---------- Graceful Shutdown ----------
process.on('SIGTERM', async () => {
  console.log('[worker-server] Received SIGTERM, shutting down...');
  await internalRedis.quit();
  await externalRedis.quit();
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[worker-server] Received SIGINT, shutting down...');
  await internalRedis.quit();
  await externalRedis.quit();
  await mongoose.disconnect();
  process.exit(0);
});