require('dotenv').config();
const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

// Models
const ApiCallLog = require('./models/ApiCallLog');
const BlockedIP = require('./models/BlockedIP');
const TeamLatency = require('./models/TeamLatency');

// Redis client used for caching team/user latency
const redisInternal = require('./config/redisInternal');

// ---------- MongoDB Connection ----------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[worker-logs] ✅ MongoDB connected'))
  .catch(err => {
    console.error('[worker-logs] ❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ---------- Redis Connection Options for BullMQ ----------
const connectionOpts = {
  connection: { url: process.env.INTERNAL_REDIS_URL },
  // BullMQ default retry settings can be overridden per worker
};

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

transporter.verify()
  .then(() => console.log('[worker-logs] ✅ Email transporter verified'))
  .catch(err => console.warn('[worker-logs] ⚠️ Email transporter not ready:', err.message));

// ==================== WORKER 1: API Logs ====================
const apiLogsWorker = new Worker(
  'bullmq-api-logs',
  async (job) => {
    const log = job.data || {};
    console.log('[api-logs] Processing job:', JSON.stringify(log, null, 2));

    let project_id = log.project_id;

    // Fallback: extract from path if not directly provided
    if (!project_id && log.path) {
      const match = log.path.match(/^\/p\/([^/]+)/);
      if (match) project_id = match[1];
    }

    if (!project_id) {
      console.error('[api-logs] ❌ Missing project_id, skipping job');
      return; // No retry – data is malformed
    }

    const username = project_id.includes('_') ? project_id.split('_')[0] : null;

    const timestamp = log.timestamp
      ? new Date(typeof log.timestamp === 'number' ? log.timestamp * 1000 : log.timestamp)
      : new Date();

    const doc = {
      project_id,
      path: log.path || '',
      method: log.method || 'GET',
      timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
      cache: log.cache || 'MISS',
      ip: log.ip || '',
      status: log.status || 200,
      latency_ms: Number(log.latency_ms) || 0,
      team_latency: Number(log.team_latency) || 0,
      user_latency: Number(log.user_latency) || 0,
      total_latency: Number(log.total_latency) || Number(log.latency_ms) || 0,
      private: !!log.private,
      ttl: Number(log.ttl) || 0,
      username,
    };

    try {
      await ApiCallLog.create(doc);
      console.log(`[api-logs] ✅ Saved log for ${project_id} | ${doc.method} ${doc.path} | ${doc.total_latency}ms`);
    } catch (err) {
      console.error('[api-logs] ❌ Save failed:', err.message);
      throw err; // Let BullMQ retry (transient DB errors)
    }
  },
  {
    ...connectionOpts,
    prefix: 'bullmq',
    attempts: 3, // Retry up to 3 times
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 3600 },   // 1 hour
    removeOnFail: { age: 86400 },      // 24 hours
  }
);

// ==================== WORKER 2: Email + Block IP ====================
const emailWorker = new Worker(
  'bullmq-email-jobs',
  async (job) => {
    const data = job.data || {};
    console.log('[email] Processing DoS alert:', data);

    // Send email
    try {
      await transporter.sendMail({
        from: '"mockAPI Security" <no-reply@mockapi.info>',
        to: data.to,
        subject: data.subject || 'Security Alert - DoS Detected',
        text: data.body,
      });
      console.log(`[email] ✅ Alert sent to ${data.to}`);
    } catch (err) {
      console.error(`[email] ❌ Failed to send email:`, err.message);
      throw err; // Retry on email failure
    }

    // Save Blocked IP (only for private DoS events)
    if (data.project_id && data.ip && data.is_private === true) {
      try {
        const existing = await BlockedIP.findOne({
          project_id: data.project_id,
          ip: data.ip,
          expiresAt: { $gt: new Date() }
        });

        if (!existing) {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await BlockedIP.create({
            project_id: data.project_id,
            ip: data.ip,
            reason: 'DoS protection - exceeded rate limit',
            blockedAt: new Date(),
            expiresAt,
            requestPath: data.path || '',
            requestMethod: data.method || 'GET',
            isPrivate: true,
          });
          console.log(`[email] ✅ Block record saved for IP ${data.ip}`);
        } else {
          console.log(`[email] ℹ️ IP ${data.ip} already blocked for this project`);
        }
      } catch (err) {
        // Non‑critical: log but don't block the email success
        console.error('[email] ❌ Failed to save block record:', err.message);
      }
    }
  },
  {
    ...connectionOpts,
    prefix: 'bullmq',
    attempts: 3, // Retry up to 3 times for transient email failures
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,               // remove immediately on success
    removeOnFail: { count: 50 },          // keep last 50 failures
  }
);

// ==================== WORKER 3: Team Latency ====================
const latencyWorker = new Worker(
  'bullmq-latency-store',
  async (job) => {
    const { project_id, username, rtt } = job.data || {};
    if (!project_id || !username || rtt == null) {
      console.warn('[latency] Invalid job data:', job.data);
      return; // Skip without retry – data issue
    }

    console.log(`[latency] Updating for ${username} in ${project_id}: ${rtt}ms`);

    try {
      // Update or create user's latency record
      let teamDoc = await TeamLatency.findOne({ project_id, username });

      if (!teamDoc) {
        teamDoc = await TeamLatency.create({
          project_id,
          username,
          averageRtt: rtt,
          sampleCount: 1
        });
      } else {
        // Simple moving average (smoothes outliers)
        teamDoc.averageRtt = Math.round((teamDoc.averageRtt + rtt) / 2);
        teamDoc.sampleCount += 1;
        await teamDoc.save();
      }

      // Recalculate team average from all members
      const allMembers = await TeamLatency.find({ project_id });
      const teamAvg = allMembers.length
        ? Math.round(allMembers.reduce((sum, m) => sum + m.averageRtt, 0) / allMembers.length)
        : rtt;

      // Cache in Redis (for fast access by OpenResty and dashboard)
      await redisInternal.setEx(`team:latency:${project_id}`, 3600, String(teamAvg));
      await redisInternal.setEx(`user:latency:${project_id}:${username}`, 3600, String(rtt));

      console.log(`[latency] ✅ Team average updated: ${teamAvg}ms for ${project_id}`);
    } catch (err) {
      console.error('[latency] ❌ Error:', err.message);
      throw err; // Retry on DB/Redis errors
    }
  },
  {
    ...connectionOpts,
    prefix: 'bullmq',
    attempts: 3, // Retry up to 3 times
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  }
);

// ==================== Event Listeners ====================
apiLogsWorker.on('completed', (job) => console.log(`[api-logs] ✅ Completed ${job.id}`));
apiLogsWorker.on('failed', (job, err) => console.error(`[api-logs] ❌ Failed ${job?.id}:`, err.message));

emailWorker.on('completed', (job) => console.log(`[email] ✅ Job ${job.id} completed`));
emailWorker.on('failed', (job, err) => console.error(`[email] ❌ Job ${job.id} failed:`, err.message));

latencyWorker.on('completed', (job) => console.log(`[latency] ✅ Job ${job.id} completed`));
latencyWorker.on('failed', (job, err) => console.error(`[latency] ❌ Job ${job.id} failed:`, err.message));

// ==================== Graceful Shutdown ====================
async function shutdown() {
  console.log('[worker-logs] Shutting down workers...');
  await apiLogsWorker.close();
  await emailWorker.close();
  await latencyWorker.close();
  await mongoose.disconnect();
  if (redisInternal) await redisInternal.quit().catch(() => {});
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[worker-logs] 🚀 All workers started successfully!');