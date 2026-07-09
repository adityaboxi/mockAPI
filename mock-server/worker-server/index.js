const { Worker } = require('bullmq');
const Docker = require('dockerode');
const IORedis = require('ioredis');
const http = require('http');

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

// Internal Redis (routes, locks)
const INTERNAL_REDIS_HOST = process.env.INTERNAL_REDIS_HOST || 'redis-internal';
const INTERNAL_REDIS_PORT = parseInt(process.env.INTERNAL_REDIS_PORT || '6379', 10);
const internalRedis = new IORedis({ host: INTERNAL_REDIS_HOST, port: INTERNAL_REDIS_PORT });

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

  if (!healthOk) {
    return false;
  }

  try {
    const syncRes = await fetch(`${baseUrl}/internal/sync`, { method: 'POST' });
    if (!syncRes.ok) {
      return false;
    }
    await syncRes.json();
    return true;
  } catch (_) {
    return true;
  }
}

// ---------- Strict pause/unpause (never start a stopped container) ----------
async function ensureProjectContainer(projectId, desiredActive) {
  if (!projectId) {
    return false;
  }
  const name = containerNameFor(projectId);
  const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;

  let container;
  try {
    const containers = await docker.listContainers({ all: true, filters: { name: [name] } });
    if (containers.length > 0) {
      container = docker.getContainer(containers[0].Id);
    }
  } catch (_) {
    return false;
  }

  if (!container) {
    return false;
  }

  const inspect = await container.inspect();
  const isRunning = inspect.State.Running;
  const isPaused = inspect.State.Paused;

  if (desiredActive) {
    if (isPaused) {
      await container.unpause();
      await syncProjectContainer(name);
    } else if (!isRunning) {
      return false;
    }
  } else {
    if (isRunning && !isPaused) {
      await container.pause();
    }
  }

  const status = desiredActive ? 'running' : 'paused';
  await setRoute(projectId, { containerName: name, status });
  return true;
}

// ---------- Route Resolver for OpenResty ----------
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

// ---------- Pause / Resume (for worker healthcheck) ----------
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
    if (redisDown) {
      redisDown = false;
    }
  } catch {
    if (!redisDown) {
      redisDown = true;
    }
  }
}, 5000);

// ---------- Worker wrapper ----------
function workerWrapper(handler) {
  return async (job) => {
    if (redisDown) throw new Error('Redis is down');
    if (manuallyPaused) throw new Error('Manually paused');
    return handler(job);
  };
}

// ---------- Project Queue Worker ----------
new Worker(
  'projectQueue',
  workerWrapper(async (job) => {
    const { action, projectId, isActive } = job.data;
    if (!projectId) {
      throw new Error('projectId required');
    }

    if (action === 'create') {
      const locked = await lockProject(projectId);
      if (!locked) throw new Error(`Project ${projectId} locked`);

      try {
        const name = containerNameFor(projectId);
        const existing = await docker.listContainers({ all: true, filters: { name: [name] } });
        if (existing.length > 0) {
          // container exists – skip creation (idempotent)
        } else {
          const internalRedisUrl = `redis://${INTERNAL_REDIS_HOST}:${INTERNAL_REDIS_PORT}`;
          const container = await docker.createContainer({
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
          await setRoute(projectId, { containerName: name, status: 'running' });
        }
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
        if (!success) {
          throw new Error(`Failed to update container for ${projectId}`);
        }
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
  }),
  {
    connection,
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: true,
  }
);

// ---------- Mock Sync Queue Worker ----------
new Worker(
  'mockSyncQueue',
  workerWrapper(async (job) => {
    const { action, projectId, version, method, urlpath, apihistorydata } = job.data;
    if (!projectId) {
      throw new Error('projectId required');
    }

    if (await isProjectLocked(projectId)) {
      throw new Error(`Project ${projectId} is busy`);
    }

    if (action === 'set') {
      return callProjectContainer(projectId, 'POST', '/internal/apis', {
        version, method, urlpath, definition: apihistorydata,
      });
    }
    if (action === 'delete') {
      return callProjectContainer(projectId, 'DELETE', '/internal/apis', {
        version, method, urlpath,
      });
    }
    throw new Error(`unknown mockSyncQueue action: ${action}`);
  }),
  {
    connection,
    attempts: 10,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: true,
  }
);

// ---------- Startup ----------
async function startup() {
  // 1. Wait for internal Redis
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
  if (!internalReady) {
    process.exit(1);
  }

  // 2. Wait for external Redis (BullMQ)
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
  if (!externalReady) {
    process.exit(1);
  }

  // 3. Clean BullMQ keys from external Redis
  try {
    const keys = await externalRedis.keys('bull:*');
    if (keys.length) {
      await externalRedis.del(keys);
    }
  } catch (_) { /* ignore */ }

  // 4. Also clean internal Redis (just in case)
  try {
    const keys = await internalRedis.keys('bull:*');
    if (keys.length) {
      await internalRedis.del(keys);
    }
  } catch (_) { /* ignore */ }
}
startup();

process.on('SIGTERM', async () => {
  await internalRedis.quit();
  await externalRedis.quit();
  process.exit(0);
});