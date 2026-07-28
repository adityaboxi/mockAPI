
require('./opentelemetry/universal-logger');  // <-- Add this line FIRST

require('dotenv').config();
const mongoose = require('mongoose');
const Redis = require('ioredis');
const nodemailer = require('nodemailer');
const { Worker } = require('bullmq');

// ---------- MODELS ---------------
const ApiCallLog = require('./models/ApiCallLog');
const BlockedIP = require('./models/BlockedIP');
const TeamLatency = require('./models/TeamLatency');
const Project = require('./models/Project');
const User = require('./models/User');

// Redis client for caching (used by latency worker)
const redisInternal = require('./config/redisInternal');

console.log('[worker-logs] 🚀 Starting.....');

// --------- MongoDB ----------
if (!process.env.MONGO_URI) {
  console.error('[worker-logs] ❌ MONGO_URI is not set');
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[worker-logs] ✅ MongoDB connected'))
  .catch(err => {
    console.error('[worker-logs] ❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ---------- Redis connection for raw consumers ----------
const REDIS_URL = process.env.INTERNAL_REDIS_URL || 'redis://redis-internal:6379';
const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  retryStrategy: times => Math.min(times * 100, 3000)
});

async function waitForRedis() {
  console.log('[worker-logs] ⏳ Waiting for Redis to be ready...');
  for (let i = 1; i <= 30; i++) {
    try {
      await redis.ping();
      console.log('[worker-logs] ✅ Redis ready for raw consumers');
      return true;
    } catch (err) {
      console.log(`[worker-logs] ⏳ Redis not ready (attempt ${i}/30)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error('[worker-logs] ❌ Redis not ready after 30 attempts');
  process.exit(1);
}

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

// ============================================================
// CUSTOM CONSUMER: API logs (from bullmq:bullmq-api-logs:wait)
// ============================================================
const API_QUEUE_KEY = 'bullmq:bullmq-api-logs:wait';
const API_DEAD_LETTER_KEY = 'bullmq:bullmq-api-logs:dead';

async function processLogEntry(logData) {
  console.log('[api-logs] 📨 Processing log data:', JSON.stringify(logData, null, 2));

  const project_id = logData.project_id;
  if (!project_id) {
    console.error('[api-logs] ❌ Missing project_id, skipping:', logData);
    return;
  }

  const username = project_id.includes('_') ? project_id.split('_')[0] : null;

  const timestamp = logData.timestamp
    ? new Date(typeof logData.timestamp === 'number' ? logData.timestamp * 1000 : logData.timestamp)
    : new Date();

  // ✅ **CRITICAL FIX:** Ensure we use `total_latency` from OpenResty.
  // If `total_latency` is missing, fallback to `latency_ms` (but that's not ideal).
  // OpenResty sends `total_latency = measured_latency + team_latency + user_latency`.
  const latency_ms = Number(logData.latency_ms) || 0;
  const team_latency = Number(logData.team_latency) || 0;
  const user_latency = Number(logData.user_latency) || 0;
  const total_latency = Number(logData.total_latency) || (latency_ms + team_latency + user_latency);

  const doc = {
    project_id,
    path: logData.path || '',
    method: logData.method || 'GET',
    timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
    cache: logData.cache || 'MISS',
    ip: logData.ip || '',
    status: logData.status || 200,
    latency_ms,
    team_latency,
    user_latency,
    total_latency,
    private: !!logData.private,
    ttl: Number(logData.ttl) || 0,
    username,
  };

  console.log(`[api-logs] 📄 Saving: ${doc.method} ${doc.path} | total=${doc.total_latency}ms (latency_ms=${doc.latency_ms}, team=${doc.team_latency}, user=${doc.user_latency})`);

  try {
    const saved = await ApiCallLog.create(doc);
    console.log(`[api-logs] ✅ Saved log ID: ${saved._id}`);
  } catch (err) {
    console.error('[api-logs] ❌ MongoDB save error:', err.message);
    throw err;
  }
}

async function startApiLogConsumer() {
  console.log('[api-logs] 📡 Starting API log consumer...');
  while (true) {
    try {
      const result = await redis.blpop(API_QUEUE_KEY, 0);
      if (result) {
        const [, raw] = result;
        try {
          const logData = JSON.parse(raw);
          await processLogEntry(logData);
        } catch (parseErr) {
          console.error('[api-logs] ❌ Failed to parse JSON:', raw);
          await redis.rpush(API_DEAD_LETTER_KEY, raw);
        }
      }
    } catch (err) {
      console.error('[api-logs] ❌ Consumer error:', err);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ============================================================
// BullMQ workers for email and latency
// ============================================================
console.log('[worker-logs] Creating BullMQ workers for other tasks...');
const connectionOpts = {
  connection: { url: REDIS_URL },
};

// ---------- Email worker (handles general emails + DoS alerts) ----------
const emailWorker = new Worker(
  'bullmq-email-jobs',
  async (job) => {
    try {
      const data = job.data || {};
      console.log('[email] 📨 Received job (ID: ' + job.id + '):', JSON.stringify(data, null, 2));

      if (!data || Object.keys(data).length === 0) {
        console.warn('[email] ⚠️ Empty job data – skipping');
        return;
      }

      const { project_id, ip, is_private, path, method } = data;

      // ---- DoS alert ----
      if (project_id && ip && is_private === true) {
        console.log('[email] 🚨 DoS alert detected – processing ban and notification');

        const project = await Project.findOne({ id: project_id });
        if (!project) {
          console.error(`[email] ❌ Project ${project_id} not found – skipping`);
          return;
        }
        console.log(`[email] 📁 Found project: "${project.projectname}" (${project.id})`);

        const memberUsernames = [project.username, ...(project.members || [])];
        const uniqueMembers = [...new Set(memberUsernames)];
        const users = await User.find({ username: { $in: uniqueMembers } });
        const emails = users.map(u => u.email).filter(e => e && e.trim() !== '');

        if (emails.length > 0) {
          const subject = `🔴 DoS Alert – ${project.projectname} (${project_id})`;
          const body = `Your project "${project.projectname}" (${project_id}) received over 100 private requests/sec from IP ${ip}. The IP has been banned for 24 hours.\n\nRequest path: ${path || 'N/A'}\nTime: ${new Date().toISOString()}\n\nThis is an automated security notification.`;

          for (const email of emails) {
            try {
              await transporter.sendMail({
                from: '"mockAPI Security" <no-reply@mockapi.info>',
                to: email,
                subject,
                text: body,
              });
              console.log(`[email] ✅ DoS alert sent to ${email}`);
            } catch (mailErr) {
              console.error(`[email] ❌ Failed to send to ${email}:`, mailErr.message);
            }
          }
        } else {
          console.warn(`[email] ⚠️ No valid emails found – skipping email (IP will still be banned)`);
        }

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const existing = await BlockedIP.findOne({
          project_id,
          ip,
          expiresAt: { $gt: new Date() }
        });
        if (!existing) {
          await BlockedIP.create({
            project_id,
            ip,
            reason: 'DoS protection',
            blockedAt: new Date(),
            expiresAt,
            requestPath: path || '',
            requestMethod: method || 'GET',
            isPrivate: true,
          });
          console.log(`[email] ✅ IP ${ip} banned until ${expiresAt.toISOString()}`);
        } else {
          console.log(`[email] ℹ️ IP ${ip} already has an active ban`);
        }
      } else {
        // ---- Regular email ----
        if (!data.to) {
          console.warn('[email] ⚠️ Missing "to" field – skipping general email');
          return;
        }
        console.log(`[email] 📧 Sending general email to: ${data.to}`);
        try {
          await transporter.sendMail({
            from: '"mockAPI" <no-reply@mockapi.info>',
            to: data.to,
            subject: data.subject || 'Notification',
            text: data.body,
            html: data.html,
          });
          console.log(`[email] ✅ General email sent to ${data.to}`);
        } catch (mailErr) {
          console.error(`[email] ❌ Failed to send general email:`, mailErr.message);
        }
      }
      console.log(`[email] ✅ Job ${job.id} processed successfully`);
    } catch (err) {
      console.error(`[email] ❌ UNHANDLED error in job ${job.id}:`, err.stack || err.message);
      console.error('[email] Job data that caused error:', JSON.stringify(job.data, null, 2));
    }
  },
  {
    ...connectionOpts,
    prefix: 'bullmq',
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: true,
    lockDuration: 86400000,
  }
);

// ---------- Latency worker ----------
const latencyWorker = new Worker(
  'bullmq-latency-store',
  async (job) => {
    const { project_id, username, rtt } = job.data || {};
    if (!project_id || !username || rtt == null) {
      console.warn('[latency] ⚠️ Invalid job data:', job.data);
      return;
    }
    console.log(`[latency] 📊 Updating ${username} in ${project_id}: ${rtt}ms`);
    try {
      let teamDoc = await TeamLatency.findOne({ project_id, username });
      if (!teamDoc) {
        teamDoc = await TeamLatency.create({ project_id, username, averageRtt: rtt, sampleCount: 1 });
      } else {
        const oldAvg = teamDoc.averageRtt;
        const oldCount = teamDoc.sampleCount;
        teamDoc.averageRtt = Math.round((oldAvg * oldCount + rtt) / (oldCount + 1));
        teamDoc.sampleCount += 1;
        await teamDoc.save();
      }
      const allMembers = await TeamLatency.find({ project_id });
      const teamAvg = allMembers.length
        ? Math.round(allMembers.reduce((s, m) => s + m.averageRtt, 0) / allMembers.length)
        : rtt;
      await redisInternal.setex(`team:latency:${project_id}`, 3600, String(teamAvg));
      await redisInternal.setex(`user:latency:${project_id}:${username}`, 3600, String(rtt));
      console.log(`[latency] ✅ Team avg updated: ${teamAvg}ms, user RTT: ${rtt}ms`);
    } catch (err) {
      console.error('[latency] ❌ Error:', err.message);
      throw err;
    }
  },
  {
    ...connectionOpts,
    prefix: 'bullmq',
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
    lockDuration: 86400000,
  }
);

emailWorker.on('completed', job => console.log(`[email] ✅ Completed ${job.id}`));
emailWorker.on('failed', (job, err) => console.error(`[email] ❌ Failed ${job.id}:`, err.message));
latencyWorker.on('completed', job => console.log(`[latency] ✅ Completed ${job.id}`));
latencyWorker.on('failed', (job, err) => console.error(`[latency] ❌ Failed ${job.id}:`, err.message));

// ============================================================
// Start all consumers
// ============================================================
waitForRedis().then(() => {
  startApiLogConsumer().catch(err => console.error('[api-logs] ❌ Fatal error:', err));
});

// Graceful shutdown
async function shutdown() {
  console.log('[worker-logs] 🔴 Shutting down...');
  await emailWorker.close();
  await latencyWorker.close();
  await mongoose.disconnect();
  await redis.quit();
  await redisInternal.quit().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[worker-logs] 🚀 All workers started!');