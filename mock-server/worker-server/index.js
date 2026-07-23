require('dotenv').config();
const { Worker, Queue } = require('bullmq');
const Docker = require('dockerode');
const IORedis = require('ioredis');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

// ---------- MODELS --------
const Project = require('./models/Project');
const ProjectApiHistory = require('./models/ProjectApiHistory');
const SystemEventLog = require('./models/SystemEventLog');

// ---------- CONFIG ----------
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const NETWORK = process.env.DOCKER_NETWORK || 'orch-net';
const IMAGE = process.env.PROJECT_IMAGE || 'project-container:latest';

console.log('[worker-server] 🚀 Starting worker-server...');
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
externalRedis.on('error', (err) => console.error('[Redis-external] Error:', err));

const INTERNAL_REDIS_HOST = process.env.INTERNAL_REDIS_HOST || 'redis-internal';
const INTERNAL_REDIS_PORT = parseInt(process.env.INTERNAL_REDIS_PORT || '6379', 10);
const internalRedis = new IORedis({ host: INTERNAL_REDIS_HOST, port: INTERNAL_REDIS_PORT });
internalRedis.on('error', (err) => console.error('[Redis-internal] Error:', err));

console.log(`[worker-server] 📌 Internal Redis: ${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`);

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

/**
 * HELPER: Wait for container health check (simple, no sync)
 */
async function waitForHealth(containerName, timeout = 30000) {
  console.log(`[health] 🏥 Checking health of ${containerName}...`);
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
    await new Promise(r => setTimeout(r, 500));
  }
  console.error(`[health] ❌ ${containerName} health check failed after ${timeout}ms`);
  return false;
}

/**
 * Ensure the project container is running (NO RE-SYNC)
 * Used by mockSyncQueue when it needs to wake a sleeping project
 */
async function ensureProjectContainerRunning(projectId) {
  console.log(`[ensureRunning] 🏃 Ensuring project ${projectId} is running (no re-sync)...`);
  const name = containerNameFor(projectId);
  const info = await getContainerInfo(name);
  if (!info) {
    console.log(`[ensureRunning] ❌ Container ${name} does not exist`);
    return false;
  }

  if (info.isPaused) {
    console.log(`[ensureRunning] ⏸️ Container ${name} is paused – unpausing (no re-sync)`);
    await info.container.unpause();
    const healthy = await waitForHealth(name);
    if (!healthy) {
      console.error(`[ensureRunning] ❌ Container ${name} failed health check`);
      return false;
    }
  } else if (!info.isRunning) {
    console.log(`[ensureRunning] ⏹️ Container ${name} is stopped – starting (no re-sync)`);
    await info.container.start();
    const healthy = await waitForHealth(name);
    if (!healthy) {
      console.error(`[ensureRunning] ❌ Container ${name} failed health check`);
      return false;
    }
  } else {
    console.log(`[ensureRunning] ✅ Container ${name} already running – health check only`);
    const healthy = await waitForHealth(name);
    if (!healthy) {
      console.error(`[ensureRunning] ❌ Container ${name} failed health check`);
      return false;
    }
  }

  await setRoute(projectId, { containerName: name, status: 'running' });
  console.log(`[ensureRunning] ✅ Project ${projectId} is running (data preserved)`);
  return true;
}

/**
 * Ensure container exists and is in desired state (active or inactive)
 * Idempotent – no re‑sync when resuming.
 * Uses PAUSE/UNPAUSE for existing containers to preserve in‑memory routes.
 */
async function ensureProjectContainer(projectId, isActive) {
  console.log(`[ensureContainer] 📦 Ensuring container for project ${projectId}, active=${isActive}`);
  const name = containerNameFor(projectId);
  const info = await getContainerInfo(name);
  const desiredActiveState = (isActive === true || isActive === 'true');

  console.log(`[ensureContainer] 🔍 Actual state: running=${info?.isRunning}, paused=${info?.isPaused}`);
  console.log(`[ensureContainer] 📋 Desired state: active=${desiredActiveState}`);

  // ============== INACTIVE REQUEST ==============
  if (!desiredActiveState) {
    console.log(`[ensureContainer] ⏸️ User requested: INACTIVE`);

    if (!info) {
      console.log(`[ensureContainer] ✅ Container doesn't exist – already inactive`);
      return true;
    }

    // If running, PAUSE (not stop)
    if (info.isRunning && !info.isPaused) {
      console.log(`[ensureContainer] ⏸️ Container ${name} is running – pausing (data preserved)`);
      await info.container.pause();
      await setRoute(projectId, { containerName: name, status: 'paused' });
      console.log(`[ensureContainer] ✅ Container ${name} paused – radix tree data preserved`);
      return true;
    }

    // If already paused or stopped, nothing to do
    if (info.isPaused || !info.isRunning) {
      console.log(`[ensureContainer] ✅ Container ${name} already inactive (${info.isPaused ? 'paused' : 'stopped'})`);
      await setRoute(projectId, { containerName: name, status: info.isPaused ? 'paused' : 'stopped' });
      return true;
    }

    return true;
  }

  // ============== ACTIVE REQUEST ==============
  console.log(`[ensureContainer] ▶️ User requested: ACTIVE`);

  // ---- Container does not exist – create new (first time only) ----
  if (!info) {
    console.log(`[ensureContainer] 🆕 Container ${name} does not exist – creating NEW`);
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
          Env: [
            `PROJECT_ID=${projectId}`,
            `INTERNAL_REDIS_URL=${internalRedisUrl}`,
            `FALLBACK_REDIS_URL=redis://host.docker.internal:6379`,
          ],
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

      // SYNC ONLY ON FIRST CREATION
      const synced = await syncProjectContainer(name);
      if (!synced) {
        console.error(`[ensureContainer] ❌ Sync failed for ${name} – rolling back`);
        await container.stop().catch(() => {});
        await container.remove().catch(() => {});
        throw new Error(`Sync failed for container ${name}`);
      }

      await setRoute(projectId, { containerName: name, status: 'running' });
      replenishPool().catch(() => {});
      console.log(`[ensureContainer] ✅ Project ${projectId} created, synced, and running`);
      return true;
    } finally {
      await unlockProject(projectId);
    }
  }

  // ---- Container exists – handle pause/unpause ----
  if (info.isRunning && !info.isPaused) {
    console.log(`[ensureContainer] ✅ Container ${name} already running – no action needed`);
    await setRoute(projectId, { containerName: name, status: 'running' });
    return true;
  }

  if (info.isPaused) {
    console.log(`[ensureContainer] ▶️ Container ${name} is paused – unpausing (data preserved)`);
    await info.container.unpause();
    const healthy = await waitForHealth(name);
    if (!healthy) {
      console.error(`[ensureContainer] ❌ Container ${name} failed health check after unpause`);
      return false;
    }
    console.log(`[ensureContainer] ✅ Container ${name} unpaused and healthy – routes are intact`);
    await setRoute(projectId, { containerName: name, status: 'running' });
    return true;
  }

  // If stopped (rare because we use pause, but handle it)
  if (!info.isRunning) {
    console.log(`[ensureContainer] ⏹️ Container ${name} is stopped – starting (routes lost, re‑sync needed)`);
    await info.container.start();
    const healthy = await waitForHealth(name);
    if (!healthy) {
      console.error(`[ensureContainer] ❌ Container ${name} failed health check after start`);
      return false;
    }
    console.log(`[ensureContainer] 🔄 Re‑syncing routes after start`);
    const synced = await syncProjectContainer(name);
    if (!synced) {
      console.error(`[ensureContainer] ❌ Sync failed for ${name}`);
      return false;
    }
    console.log(`[ensureContainer] ✅ Container ${name} started and synced`);
    await setRoute(projectId, { containerName: name, status: 'running' });
    return true;
  }

  return true;
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
      Env: [
        `PROJECT_ID=${projectId}`,
        `INTERNAL_REDIS_URL=${internalRedisUrl}`,
        `FALLBACK_REDIS_URL=redis://host.docker.internal:6379`,
      ],
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
        Env: [
          `PROJECT_ID=pool-replenish-${i}`,
          `INTERNAL_REDIS_URL=${internalRedisUrl}`,
          `FALLBACK_REDIS_URL=redis://host.docker.internal:6379`,
        ],
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
      await job.updateProgress(10);

      const existingRoute = await getRoute(projectId);
      if (existingRoute && existingRoute.status === 'running') {
        console.log(`[projectQueue] ⏭️ Project ${projectId} already running`);
        return;
      }

      if (existingRoute && existingRoute.containerName) {
        console.log(`[projectQueue] 🔄 Existing container found for ${projectId} – resuming (no re-sync)`);
        const ok = await ensureProjectContainerRunning(projectId);
        if (ok) {
          console.log(`[projectQueue] ✅ Existing container for ${projectId} resumed (data preserved)`);
          await job.updateProgress(100);
          return;
        }
      }

      console.log(`[projectQueue] 🆕 Creating new container for ${projectId}`);
      const locked = await lockProject(projectId);
      if (!locked) throw new Error(`Project ${projectId} locked`);

      try {
        const name = containerNameFor(projectId);
        let container = null;

        await job.updateProgress(20);

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
            Env: [
              `PROJECT_ID=${projectId}`,
              `INTERNAL_REDIS_URL=${internalRedisUrl}`,
              `FALLBACK_REDIS_URL=redis://host.docker.internal:6379`,
            ],
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

        await job.updateProgress(50);

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
        await job.updateProgress(90);

        replenishPool().catch(() => {});
        console.log(`[projectQueue] ✅ Project ${projectId} created and running`);
        await job.updateProgress(100);
      } finally {
        await unlockProject(projectId);
      }
      return;
    }

    if (action === 'update') {
      console.log(`[projectQueue] 🔄 Update action for project ${projectId}, active=${isActive}`);
      await job.updateProgress(30);

      const currentRoute = await getRoute(projectId);
      const currentStatus = currentRoute?.status || 'unknown';
      const desiredStatus = (isActive === true || isActive === 'true') ? 'running' : 'paused';

      console.log(`[projectQueue] 📊 Current status: ${currentStatus}, Desired status: ${desiredStatus}`);

      if (currentStatus === desiredStatus) {
        console.log(`[projectQueue] ✅ Project ${projectId} already in desired state (${desiredStatus}) – no action needed`);
        await job.updateProgress(100);
        return;
      }

      const locked = await lockProject(projectId);
      if (!locked) throw new Error(`Project ${projectId} locked`);
      try {
        console.log(`[projectQueue] 🔄 Transitioning project ${projectId} from ${currentStatus} to ${desiredStatus}...`);
        const success = await ensureProjectContainer(projectId, isActive);
        if (!success) throw new Error(`Failed to update container for ${projectId}`);
        console.log(`[projectQueue] ✅ Project ${projectId} updated successfully (${currentStatus} → ${desiredStatus})`);
        await job.updateProgress(100);
      } finally {
        await unlockProject(projectId);
      }
      return;
    }

    if (action === 'delete') {
      console.log(`[projectQueue] 🗑️ Delete action for project ${projectId}`);
      await job.updateProgress(30);

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
    lockDuration: 900000,
    stalledInterval: 300000,
    maxStalledCount: 2,
    lockRenewTime: 30000,
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

    await job.updateProgress(10);

    let route = await getRoute(projectId);

    // 1. If project exists but is sleeping, WAKE IT UP (no re-sync)
    if (route && route.status !== 'running') {
      console.log(`[mockSyncQueue] ⏰ Waking up sleeping container for project ${projectId}...`);
      await job.updateProgress(20);

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

    await job.updateProgress(50);

    console.log(`[mockSyncQueue] 🚀 Sending ${action} to project container for ${projectId}`);
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
    lockDuration: 300000,
    stalledInterval: 120000,
    maxStalledCount: 2,
    lockRenewTime: 30000,
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
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 1800 },
    removeOnFail: { age: 3600 },
    lockDuration: 60000,
    stalledInterval: 30000,
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

    await job.updateProgress(10);

    // Generate human‑readable project ID: username_sanitizedProjectName
    const sanitized = projectName.replace(/[^a-zA-Z0-9]/g, '_');
    let projectId = `${username}_${sanitized}`;
    console.log(`[openapi-import] 📌 Generated project ID: ${projectId}`);

    const existingProject = await Project.findOne({ username, projectname: projectName });
    let isNewProject = false;

    // Determine if we need to use existing project ID
    if (existingProject) {
      const projectDoc = await Project.findOne({ id: projectId });
      if (!projectDoc) {
        projectId = existingProject.id;
        console.log(`[openapi-import] 📂 Project exists with ID: ${projectId} – updating`);
      } else {
        console.log(`[openapi-import] 📂 Project exists with ID: ${projectId} – updating`);
      }
    }

    let finalProjectId = projectId;
    let isNew = false;

    let projectDoc = await Project.findOne({ id: finalProjectId });
    if (!projectDoc) {
      const invitationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      console.log(`[openapi-import] 🆕 Creating new project "${projectName}" with ID ${finalProjectId}`);
      const newProject = new Project({
        id: finalProjectId,
        projectname: projectName,
        username: username,
        invitationCode,
        members: [username],
        isActive: true,
        createdAt: new Date().toISOString()
      });
      await newProject.save();
      isNew = true;
      console.log(`[openapi-import] ✅ Project ${finalProjectId} created`);
    } else {
      console.log(`[openapi-import] 📂 Project "${projectName}" exists (ID: ${finalProjectId}) – updating`);
    }

    await job.updateProgress(30);

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

        const version = 'v1';
        const versionedPath = `/${version}${fullPath}`;

        endpointsMap[fullPath].versions.push({
          method: method.toUpperCase(),
          urlPath: versionedPath,
          version: version,
          protocol: 'https',
          statusCode: 200,
          requestBody: operation.requestBody?.content?.['application/json']?.schema?.example || null,
          responseBody: operation.responses?.['200']?.content?.['application/json']?.schema?.example || null,
        });
      });
    });

    const endpointsArray = Object.values(endpointsMap);
    console.log(`[openapi-import] 📊 Extracted ${endpointsArray.length} endpoints from spec`);
    await job.updateProgress(50);

    // ---------- Save ProjectApiHistory ----------
    if (isNew) {
      const projectApiHistory = new ProjectApiHistory({
        projectID: finalProjectId,
        projectCode: finalProjectId,
        accessByUsernames: [username],
        endpoints: endpointsArray,
      });
      await projectApiHistory.save();
      console.log(`[openapi-import] ✅ ProjectApiHistory saved for new project`);
    } else {
      const history = await ProjectApiHistory.findOne({ projectID: finalProjectId });
      if (history) {
        history.endpoints = endpointsArray;
        history.updatedAt = new Date();
        await history.save();
        console.log(`[openapi-import] ✅ ProjectApiHistory updated for existing project`);
      } else {
        const projectApiHistory = new ProjectApiHistory({
          projectID: finalProjectId,
          projectCode: finalProjectId,
          accessByUsernames: [username],
          endpoints: endpointsArray,
        });
        await projectApiHistory.save();
        console.log(`[openapi-import] ✅ ProjectApiHistory created for existing project`);
      }
    }

    // ---------- PUBLISH TO REDIS FOR REAL-TIME UPDATES ----------
    try {
      await externalRedis.publish('api_history_update', JSON.stringify({ projectId: finalProjectId }));
      console.log(`[openapi-import] 📤 Published API history update for ${finalProjectId}`);
    } catch (err) {
      console.error('[openapi-import] Failed to publish history update:', err);
    }

    // ---------- Create SystemEventLog entries ----------
    console.log(`[openapi-import] 📝 Creating SystemEventLog entries for ${endpointsArray.length} endpoints...`);
    const systemLogs = [];
    for (const endpoint of endpointsArray) {
      for (const ver of endpoint.versions) {
        systemLogs.push({
          projectId: finalProjectId,
          username: username,
          action: 'created',
          method: ver.method,
          url: ver.urlPath,
          version: ver.version,
          accessByUsername: [username],
          statusCode: 201,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
    if (systemLogs.length > 0) {
      await SystemEventLog.insertMany(systemLogs);
      console.log(`[openapi-import] ✅ Created ${systemLogs.length} system event logs`);
    }

    await job.updateProgress(70);

    // ---------- Queue container and sync jobs ----------
    const projectQueue = new Queue('projectQueue', { connection: connectionOpts });
    console.log(`[openapi-import] 🏗️ Adding ${isNew ? 'create' : 'update'} project job to queue for ${finalProjectId}`);
    await projectQueue.add('create-project', {
      action: isNew ? 'create' : 'update',
      projectId: finalProjectId,
      isActive: true
    });

    await job.updateProgress(85);

    const mockSyncQueue = new Queue('mockSyncQueue', { connection: connectionOpts });
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
            protocol: ver.protocol,
            requestBody: ver.requestBody,
            responseBody: ver.responseBody,
            statusCode: ver.statusCode,
          }
        });
        apiCount++;
      }
    }
    console.log(`[openapi-import] 📤 Queued ${apiCount} API sync jobs for project ${finalProjectId}`);

    await job.updateProgress(100);

    const result = {
      name: projectName,
      endpoints: endpointsArray.length,
      projectId: finalProjectId,
      isNewProject: isNew
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
    lockDuration: 600000,
    stalledInterval: 120000,
    maxStalledCount: 2,
    lockRenewTime: 30000,
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

  // ---------- ENSURE NETWORK EXISTS ----------
  await ensureNetwork(NETWORK);

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