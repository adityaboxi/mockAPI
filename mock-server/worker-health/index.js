require('./opentelemetry/universal-logger');  // <-- Add this line FIRST

require('dotenv').config();
const mongoose = require('mongoose');
const Redis = require('ioredis');
const Docker = require('dockerode');
const nodemailer = require('nodemailer');
const { CronJob } = require('cron');

// ------------ Models ------------
const Project = require('./models/Project');
const ProjectApiHistory = require('./models/ProjectApiHistory');
const User = require('./models/User');
const SystemEventLog = require('./models/SystemEventLog');
const BlockedIP = require('./models/BlockedIP');

// ---------- Config ------------
const REDIS_URL = process.env.INTERNAL_REDIS_URL || 'redis://redis-internal:6379';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/mockapi';
const DOCKER_SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
const DOCKER_NETWORK = process.env.DOCKER_NETWORK || 'orch-net';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '30 21 * * *'; // 3:00 AM IST (21:30 UTC)

// ---------- Clients ----------
const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});
const docker = new Docker({ socketPath: DOCKER_SOCKET });
const containerNameFor = (projectId) => `proj-${projectId}`;

// ---------- Email Transporter (Connection Pooled) ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
});

// ---------- Fast Bulk Container Inspection ----------
async function getDockerContainerMap() {
  try {
    const containers = await docker.listContainers({ all: true });
    const map = new Map();

    for (const c of containers) {
      for (const name of c.Names || []) {
        const cleanName = name.replace(/^\//, '');
        map.set(cleanName, {
          id: c.Id,
          name: cleanName,
          isRunning: c.State === 'running',
          isPaused: c.State === 'paused',
          isExited: c.State === 'exited' || c.State === 'dead',
          status: c.Status,
        });
      }
    }
    return map;
  } catch (err) {
    console.error('[Health] ❌ Failed to fetch Docker container list:', err.message);
    return new Map();
  }
}

// ---------- Helper: sync all APIs to container ----------
async function syncAllApisToContainer(projectId, containerName) {
  const history = await ProjectApiHistory.findOne({ projectID: projectId }).lean();
  if (!history || !Array.isArray(history.endpoints)) {
    console.warn(`[Health] ⚠️ No ProjectApiHistory found for ${projectId}`);
    return { success: false, count: 0 };
  }

  const baseUrl = `http://${containerName}:3000`;
  let syncedCount = 0;

  for (const endpoint of history.endpoints) {
    for (const ver of endpoint.versions || []) {
      try {
        const payload = {
          version: ver.version,
          method: ver.method,
          urlpath: ver.urlPath,
          definition: {
            ...ver,
            method: ver.method,
            urlPath: ver.urlPath,
          },
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(`${baseUrl}/internal/apis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        if (res.ok) {
          syncedCount++;
        }
      } catch (err) {
        console.error(`[Health] ⚠️ Error syncing ${ver.method} ${ver.urlPath}:`, err.message);
      }
    }
  }
  return { success: true, count: syncedCount };
}

// ---------- Helper: wait for container health ----------
async function waitForHealth(containerName, timeout = 25000) {
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

// ---------- Core Health Reconciliation Engine ----------
async function runHealthCheck() {
  console.log('[Health] 🏥 Starting daily automated cluster health reconciliation...');

  try {
    const routes = await redis.hgetall('routes');
    const projectIds = Object.keys(routes);
    console.log(`[Health] 📊 Scanning ${projectIds.length} projects registered in Redis`);

    // Fetch all docker containers in ONE high-speed bulk call
    const containerMap = await getDockerContainerMap();
    const recoveredProjects = [];

    for (const projectId of projectIds) {
      const routeStr = routes[projectId];
      let route;
      try { 
        route = JSON.parse(routeStr); 
      } catch { 
        continue; 
      }

      const redisStatus = route.status || 'unknown';
      const containerName = route.containerName || containerNameFor(projectId);
      const containerInfo = containerMap.get(containerName);

      const dockerStatus = containerInfo
        ? (containerInfo.isPaused ? 'paused' : containerInfo.isRunning ? 'running' : 'stopped')
        : 'not_found';

      // --- Case A: Redis says "running" but Docker container is stopped or crashed ---
      if (redisStatus === 'running' && (dockerStatus === 'stopped' || dockerStatus === 'not_found')) {
        console.log(`[Health] 🔄 Recovering fallen container for ${projectId} (${containerName})`);
        
        if (dockerStatus === 'not_found') {
          console.warn(`[Health] ⚠️ Container ${containerName} missing from Docker engine. Skipping automatic start.`);
          continue;
        }

        try {
          const dockerContainer = docker.getContainer(containerInfo.id);
          await dockerContainer.start();
          console.log(`[Health] ✅ Container ${containerName} started`);

          const healthy = await waitForHealth(containerName);
          if (!healthy) {
            console.error(`[Health] ❌ Container ${containerName} failed health check after restart`);
            continue;
          }

          const { success, count } = await syncAllApisToContainer(projectId, containerName);
          if (!success) {
            console.error(`[Health] ❌ Failed to re-sync routes for ${projectId}`);
            continue;
          }

          await redis.hset('routes', projectId, JSON.stringify({ containerName, status: 'running' }));

          const project = await Project.findOne({ id: projectId }).select('projectname').lean();
          recoveredProjects.push({
            projectId,
            projectName: project?.projectname || projectId,
            recoveredAt: new Date(),
            apiCount: count,
          });

          await SystemEventLog.create({
            projectId,
            username: 'system-health-worker',
            action: 'recovered',
            method: 'SYSTEM',
            url: '/health',
            version: 'v1',
            statusCode: 200,
          });

          console.log(`[Health] ✅ ${projectId} successfully recovered with ${count} APIs`);
        } catch (err) {
          console.error(`[Health] ❌ Error recovering ${projectId}:`, err.message);
        }
      }

      // --- Case B: Redis says "paused" but Docker is actively running ---
      if (redisStatus === 'paused' && dockerStatus === 'running') {
        console.log(`[Health] ⏸️ Pausing container ${containerName} (aligning with Redis status)`);
        try {
          const dockerContainer = docker.getContainer(containerInfo.id);
          await dockerContainer.pause();
          await redis.hset('routes', projectId, JSON.stringify({ containerName, status: 'paused' }));
        } catch (err) {
          console.error(`[Health] ❌ Error pausing ${containerName}:`, err.message);
        }
      }

      // --- Case C: Redis says "running" but Docker is paused ---
      if (redisStatus === 'running' && dockerStatus === 'paused') {
        console.log(`[Health] ▶️ Unpausing container ${containerName} (aligning with Redis status)`);
        try {
          const dockerContainer = docker.getContainer(containerInfo.id);
          await dockerContainer.unpause();
          await redis.hset('routes', projectId, JSON.stringify({ containerName, status: 'running' }));
        } catch (err) {
          console.error(`[Health] ❌ Error unpausing ${containerName}:`, err.message);
        }
      }
    }

    // ---------- Dispatch Recovery Notifications ----------
    if (recoveredProjects.length > 0) {
      for (const rec of recoveredProjects) {
        await sendRecoveryEmail(rec);
      }
    } else {
      console.log('[Health] ✅ Cluster health verified. All containers are in sync.');
    }
  } catch (err) {
    console.error('[Health] ❌ Health check execution error:', err.message);
  }
}

// ---------- Send Recovery Email ----------
async function sendRecoveryEmail(recoveryInfo) {
  const { projectId, projectName, recoveredAt, apiCount } = recoveryInfo;

  const project = await Project.findOne({ id: projectId }).select('username members projectname').lean();
  if (!project) return;

  const memberUsernames = [project.username, ...(project.members || [])];
  const uniqueMembers = [...new Set(memberUsernames)];
  const users = await User.find({ username: { $in: uniqueMembers } }).select('email').lean();
  const emails = users.map((u) => u.email).filter((e) => e && e.trim());

  if (emails.length === 0) return;

  const subject = `🔄 Container Auto-Recovered – ${projectName}`;
  const body = `Your project "${projectName}" (${projectId}) mock container was automatically recovered by the health watchdog at ${recoveredAt.toISOString()}.\n\n✅ ${apiCount} API endpoints have been re-synchronized and are online.\n\n— MockAPI Health Watchdog`;

  for (const email of emails) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MockAPI Health" <no-reply@mockapi.info>',
        to: email,
        subject,
        text: body,
      });
      console.log(`[Health] 📧 Recovery notification delivered to ${email}`);
    } catch (err) {
      console.error(`[Health] ❌ Failed to send recovery email to ${email}:`, err.message);
    }
  }
}

// ---------- Bootstrap Worker ----------
async function start() {
  console.log('[Health] ⏳ Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI, {
    maxPoolSize: 20,
    minPoolSize: 5,
  });
  console.log('[Health] ✅ MongoDB connected');

  console.log('[Health] ⏳ Connecting to Redis...');
  await redis.ping();
  console.log('[Health] ✅ Redis connected');

  console.log(`[Health] ⏰ Scheduling automated reconciliation: ${CRON_SCHEDULE} (UTC)`);

  // Run initial health verification on startup
  await runHealthCheck();

  // Schedule daily cron
  const job = new CronJob(CRON_SCHEDULE, runHealthCheck, null, true, 'UTC');
  job.start();

  console.log('[Health] ✅ Health watchdog is active and scheduled.');
}

async function shutdown() {
  console.log('[Health] 🛑 Shutting down health watchdog gracefully...');
  await mongoose.disconnect().catch(() => {});
  await redis.quit().catch(() => {});
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch((err) => {
  console.error('[Health] ❌ Fatal boot error:', err);
  process.exit(1);
});