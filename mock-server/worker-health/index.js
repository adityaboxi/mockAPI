require('dotenv').config();
const mongoose = require('mongoose');
const Redis = require('ioredis');
const Docker = require('dockerode');
const nodemailer = require('nodemailer');
const cron = require('cron').CronJob;

// ---------- Models ----------
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
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '30 21 * * *'; // 3 AM IST

// ---------- Clients ----------
const redis = new Redis(REDIS_URL);
const docker = new Docker({ socketPath: DOCKER_SOCKET });
const containerNameFor = (projectId) => `proj-${projectId}`;

// ---------- Email Transporter ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ---------- Helper: get   container info ----------
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
      isExited: !inspect.State.Running && !inspect.State.Paused,
    };
  } catch (err) {
    console.error(`[Health] Errror inspecting container ${containerName}:`, err.message);
    return null;
  }
}

// ---------- Helper: sync all APIs to container ----------
async function syncAllApisToContainer(projectId, containerName) {
  const history = await ProjectApiHistory.findOne({ projectID: projectId });
  if (!history) {
    console.warn(`[Health] No ProjectApiHistory found for ${projectId}`);
    return { success: false, count: 0 };
  }

  const baseUrl = `http://${containerName}:3000`;
  let syncedCount = 0;

  for (const endpoint of history.endpoints) {
    for (const ver of endpoint.versions) {
      try {
        const payload = {
          version: ver.version,
          method: ver.method,
          urlpath: ver.urlPath,
          definition: {
            ...ver.toObject ? ver.toObject() : ver,
            method: ver.method,
            urlPath: ver.urlPath,
          }
        };
        const res = await fetch(`${baseUrl}/internal/apis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) syncedCount++;
        else console.warn(`[Health] Failed to sync ${ver.method} ${ver.urlPath} to ${containerName}`);
      } catch (err) {
        console.error(`[Health] Error syncing ${ver.method} ${ver.urlPath}:`, err.message);
      }
    }
  }
  return { success: true, count: syncedCount };
}

// ---------- Helper: wait for container health ----------
async function waitForHealth(containerName, timeout = 30000) {
  const baseUrl = `http://${containerName}:3000`;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

// ---------- Core health check ----------
async function runHealthCheck() {
  console.log('[Health] 🏥 Starting daily health check...');

  try {
    // 1. Get all project IDs from Redis routes
    const routes = await redis.hgetall('routes');
    const projectIds = Object.keys(routes);
    console.log(`[Health] Found ${projectIds.length} projects in Redis`);

    const recoveredProjects = [];

    for (const projectId of projectIds) {
      const routeStr = routes[projectId];
      let route;
      try { route = JSON.parse(routeStr); } catch { continue; }
      const redisStatus = route.status || 'unknown';
      const containerName = route.containerName || containerNameFor(projectId);

      const info = await getContainerInfo(containerName);
      const dockerStatus = info ? (info.isPaused ? 'paused' : info.isRunning ? 'running' : 'stopped') : 'not_found';

      console.log(`[Health] ${projectId}: Redis=${redisStatus}, Docker=${dockerStatus}`);

      // --- Case A: Redis says "running" but Docker is stopped or not found ---
      if (redisStatus === 'running' && (dockerStatus === 'stopped' || dockerStatus === 'not_found')) {
        console.log(`[Health] 🔄 Recovering container for ${projectId}`);
        if (dockerStatus === 'not_found') {
          // Container missing – we could create from pool, but for now skip (or implement if needed)
          console.warn(`[Health] Container ${containerName} missing for ${projectId}, skipping recovery`);
          continue;
        }

        // Start the container
        try {
          await info.container.start();
          console.log(`[Health] ✅ Container ${containerName} started`);

          // Wait for health
          const healthy = await waitForHealth(containerName);
          if (!healthy) {
            console.error(`[Health] ❌ ${containerName} health check failed after start`);
            continue;
          }

          // Sync all APIs
          const { success, count } = await syncAllApisToContainer(projectId, containerName);
          if (!success) {
            console.error(`[Health] ❌ Sync failed for ${projectId}`);
            continue;
          }

          // Update Redis route status (already running)
          // Optionally set to running again
          await redis.hset('routes', projectId, JSON.stringify({ containerName, status: 'running' }));

          // Log recovery
          const project = await Project.findOne({ id: projectId });
          recoveredProjects.push({
            projectId,
            projectName: project?.projectname || projectId,
            recoveredAt: new Date(),
            apiCount: count,
          });

          // Create system event log
          await SystemEventLog.create({
            projectId,
            username: 'system-health-worker',
            action: 'recovered',
            method: 'SYSTEM',
            url: '/health',
            version: 'v1',
            statusCode: 200,
          });

          console.log(`[Health] ✅ ${projectId} recovered with ${count} APIs`);

        } catch (err) {
          console.error(`[Health] ❌.  Error recovering ${projectId}:`, err.message);
        }
      }

      // --- Case B: Redis says "paused" but Docker is running ---
      if (redisStatus === 'paused' && dockerStatus === 'running') {
        console.log(`[Health] ⏸️ Pausing container ${containerName} (Redis says paused but Docker is running)`);
        try {
          await info.container.pause();
          // Update Redis status (already paused, but ensure)
          await redis.hset('routes', projectId, JSON.stringify({ containerName, status: 'paused' }));
          console.log(`[Health] ✅ ${containerName} paused`);
        } catch (err) {
          console.error(`[Health] ❌ Error pausing ${containerName}:`, err.message);
        }
      }

      // --- Case C: Redis says "running" but Docker is paused (unlikely, but handle) ---
      if (redisStatus === 'running' && dockerStatus === 'paused') {
        console.log(`[Health] ▶️ Unpausing container ${containerName} (Redis says running but Docker is paused)`);
        try {
          await info.container.unpause();
          await redis.hset('routes', projectId, JSON.stringify({ containerName, status: 'running' }));
          console.log(`[Health] ✅ ${containerName} unpaused`);
        } catch (err) {
          console.error(`[Health] ❌ Error unpausing ${containerName}:`, err.message);
        }
      }
    }

    // ---------- Send emails for recovered projects ----------
    if (recoveredProjects.length > 0) {
      for (const rec of recoveredProjects) {
        await sendRecoveryEmail(rec);
      }
    } else {
      console.log('[Health] ✅ No recoveries needed today.');
    }

  } catch (err) {
    console.error('[Health] ❌ Health check error:', err);
  }
}

// ---------- Send recovery email ----------
async function sendRecoveryEmail(recoveryInfo) {
  const { projectId, projectName, recoveredAt, apiCount } = recoveryInfo;

  // Get project members
  const project = await Project.findOne({ id: projectId });
  if (!project) {
    console.warn(`[Health] Project ${projectId} not found for email`);
    return;
  }

  const memberUsernames = [project.username, ...(project.members || [])];
  const uniqueMembers = [...new Set(memberUsernames)];
  const users = await User.find({ username: { $in: uniqueMembers } });
  const emails = users.map(u => u.email).filter(e => e);

  if (emails.length === 0) {
    console.warn(`[Health] No emails found for project ${projectId}`);
    return;
  }

  const subject = `🔄 Project Container Recovered – ${projectName}`;
  const body = `
    Your project "${projectName}" (${projectId}) container was automatically recovered at ${recoveredAt.toISOString()}.

    ✅ ${apiCount} API routes were re‑synced to the container.
    All endpoints are now operational.

    If you have any questions, please contact support.

    — MockAPI Health Worker
  `;

  for (const email of emails) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"MockAPI Health" <no-reply@mockapi.info>',
        to: email,
        subject,
        text: body,
      });
      console.log(`[Health] 📧 Recovery email sent to ${email}`);
    } catch (err) {
      console.error(`[Health] ❌ Failed to send email to ${email}:`, err.message);
    }
  }
}

// ---------- Startup ----------
async function start() {
  console.log('[Health] ⏳ Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('[Health] ✅ MongoDB connected');

  console.log('[Health] ⏳ Connecting to Redis...');
  await redis.ping();
  console.log('[Health] ✅ Redis connected');

  console.log(`[Health] ⏳ Scheduling health check at ${CRON_SCHEDULE} (UTC) = 3 AM IST`);

  // Run once at startup (optional)
  await runHealthCheck();

  // Schedule daily
  const job = new cron(CRON_SCHEDULE, runHealthCheck, null, true, 'UTC');
  job.start();

  console.log('[Health] ✅ Health worker started, waiting for next scheduled run...');
}

// ---------- Graceful Shutdown ----------
async function shutdown() {
  console.log('[Health] 🔴 Shutting down...');
  await mongoose.disconnect();
  await redis.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch(err => {
  console.error('[Health] ❌ Fatal error:', err);
  process.exit(1);
});