// worker-logs/index.js
require('dotenv').config();
const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const ApiCallLog = require('./models/ApiCallLog');
const BlockedIP = require('./models/BlockedIP');
const redisInternal = require('./config/redisInternal'); // ✅ Import Redis Internal

// ---------- Connections ----------
const MONGO_URI = process.env.MONGO_URI;
const INTERNAL_REDIS_URL = process.env.INTERNAL_REDIS_URL;

mongoose.connect(MONGO_URI)
  .then(() => console.log('[worker-logs] MongoDB connected'))
  .catch(err => {
    console.error('[worker-logs] MongoDB connection error:', err);
    process.exit(1);
  });

const connectionOpts = { connection: { url: INTERNAL_REDIS_URL } };

// ---------- Email transporter ----------
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
  .then(() => console.log('[worker-logs] Email transporter ready'))
  .catch(err => console.warn('[worker-logs] Email transporter not available:', err.message));

// ---------- Worker 1: API call logs → MongoDB ----------
const apiLogsWorker = new Worker(
  'bullmq-api-logs',
  async (job) => {
    const log = job.data;

    // ----- DEBUG: full job payload -----
    console.log('[DEBUG] Job payload:', JSON.stringify(log, null, 2));

    // ----- Extract project_id with fallback -----
    let project_id = log.project_id;
    if (!project_id && log.path) {
      const match = log.path.match(/^\/p\/([^\/]+)/);
      if (match) project_id = match[1];
    }
    if (!project_id) {
      console.error('[api-logs] Missing project_id, skipping job');
      return;
    }

    // ----- Extract username from project_id -----
    let username = null;
    if (project_id && project_id.includes('_')) {
      username = project_id.split('_')[0];
    }

    // ----- Handle timestamp -----
    let timestamp;
    if (typeof log.timestamp === 'number' && log.timestamp > 0) {
      timestamp = new Date(log.timestamp * 1000);
      if (isNaN(timestamp.getTime())) timestamp = new Date();
    } else {
      timestamp = new Date();
    }

    // ----- Build document with fallbacks -----
    const doc = {
      project_id: project_id,
      path:       log.path || '',
      method:     log.method || '',
      timestamp:  timestamp,
      cache:      log.cache || '',
      ip:         log.ip || '',
      status:     log.status || 0,
      latency_ms: log.latency_ms || 0,
      private:    log.private || false,
      ttl:        log.ttl || 0,
      username:   username,
      team_latency: log.team_latency || 0,
      user_latency: log.user_latency || 0,
    };

    try {
      await ApiCallLog.create(doc);
      console.log(`[api-logs] Saved: ${project_id} ${doc.method} ${doc.path}`);
    } catch (err) {
      console.error('[api-logs] Save error:', err.message);
      throw err;
    }
  },
  {
    ...connectionOpts,
    prefix: 'bullmq',
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  }
);

// ---------- Worker 2: Email alerts + Blocked IP persistence ----------
const emailWorker = new Worker(
  'bullmq-email-jobs',
  async (job) => {
    const data = job.data;
    console.log('[email] Processing DoS alert job:', data);

    // ----- 1. Send the email -----
    try {
      await transporter.sendMail({
        from: '"mockAPI Security" <security@mockapi.info>',
        to: data.to,
        subject: data.subject,
        text: data.body,
      });
      console.log(`[email] DoS alert sent to ${data.to}`);
    } catch (err) {
      console.error(`[email] Failed to send email to ${data.to}:`, err.message);
      throw err; // let BullMQ retry
    }

    // ----- 2. Save block record to MongoDB (for private API blocks) -----
    if (data.project_id && data.ip && data.is_private === true) {
      try {
        // Check if already blocked and still active
        const existing = await BlockedIP.findOne({
          project_id: data.project_id,
          ip: data.ip,
          expiresAt: { $gt: new Date() }
        });

        if (!existing) {
          const expiresAt = new Date(data.timestamp * 1000 + 24 * 60 * 60 * 1000); // 24 hours
          await BlockedIP.create({
            project_id: data.project_id,
            ip: data.ip,
            reason: 'DoS attack – exceeded 100 private requests/sec',
            blockedAt: new Date(data.timestamp * 1000),
            expiresAt: expiresAt,
            requestPath: data.path || '',
            requestMethod: data.method || 'GET',
            isPrivate: true,
          });
          console.log(`[email] Block record saved for ${data.ip} (project: ${data.project_id})`);
        } else {
          console.log(`[email] Block record already exists for ${data.ip}`);
        }
      } catch (err) {
        console.error('[email] Failed to save block record:', err.message);
        // Don't throw – email was already sent, block record is secondary
      }
    }
  },
  {
    ...connectionOpts,
    prefix: 'bullmq',
    removeOnComplete: true,
    removeOnFail: { count: 100 },
  }
);

// ---------- Worker 3: Team latency updater (from latency reports) ----------
// This worker processes latency reports from the server
const latencyWorker = new Worker(
  'bullmq-latency-store',
  async (job) => {
    const { project_id, username, rtt } = job.data;
    console.log(`[latency] Updating latency for ${username} in project ${project_id}: ${rtt}ms`);

    try {
      // Update TeamLatency in MongoDB
      const TeamLatency = require('./models/TeamLatency');
      let teamDoc = await TeamLatency.findOne({ project_id, username });
      if (!teamDoc) {
        teamDoc = await TeamLatency.create({ project_id, username, averageRtt: rtt, sampleCount: 1 });
      } else {
        teamDoc.averageRtt = Math.round((teamDoc.averageRtt + rtt) / 2);
        teamDoc.sampleCount += 1;
        await teamDoc.save();
      }

      // Calculate team average
      const allTeamMembers = await TeamLatency.find({ project_id });
      const teamAvg = allTeamMembers.reduce((sum, m) => sum + m.averageRtt, 0) / allTeamMembers.length;

      // Store team average in Redis Internal (for OpenResty)
      await redisInternal.setEx(`team:latency:${project_id}`, 3600, String(Math.round(teamAvg)));

      // Store individual user latency in Redis Internal
      await redisInternal.setEx(`user:latency:${project_id}:${username}`, 3600, String(rtt));

      console.log(`[latency] Updated team avg for ${project_id}: ${Math.round(teamAvg)}ms`);
    } catch (err) {
      console.error('[latency] Failed to update latency:', err.message);
    }
  },
  {
    ...connectionOpts,
    prefix: 'bullmq',
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  }
);

// ---------- Event listeners ----------
apiLogsWorker.on('completed', (job) => {
  console.log(`[api-logs] Completed: ${job.data.project_id}`);
});
apiLogsWorker.on('failed', (job, err) => {
  console.error(`[api-logs] Failed: ${job?.data?.project_id || 'unknown'} — ${err.message}`);
});

emailWorker.on('completed', (job) => {
  console.log(`[email] Job ${job.id} completed`);
});
emailWorker.on('failed', (job, err) => {
  console.error(`[email] Failed to send to ${job?.data?.to}: ${err.message}`);
});

latencyWorker.on('completed', (job) => {
  console.log(`[latency] Job ${job.id} completed`);
});
latencyWorker.on('failed', (job, err) => {
  console.error(`[latency] Job ${job.id} failed:`, err.message);
});

// ---------- Graceful shutdown ----------
async function shutdown() {
  console.log('[worker-logs] Shutting down...');
  await apiLogsWorker.close();
  await emailWorker.close();
  await latencyWorker.close();
  await mongoose.disconnect();
  if (redisInternal) await redisInternal.quit().catch(() => {});
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[worker-logs] Workers started:');
console.log('  - bullmq-api-logs (API logs → MongoDB)');
console.log('  - bullmq-email-jobs (DoS alerts + Blocked IP)');
console.log('  - bullmq-latency-store (Team latency → Redis)');