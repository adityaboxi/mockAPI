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

console.log('[worker-logs] 🚀 Starting worker-logs (High-Concurrency Optimized)...');

// --------- MongoDB Connection (Connection Pooled) ----------
if (!process.env.MONGO_URI) {
  console.error('[worker-logs] ❌ MONGO_URI is not set');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 50,
  minPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('[worker-logs] ✅ MongoDB connected with high-concurrency pool'))
  .catch(err => {
    console.error('[worker-logs] ❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ---------- Redis Connection for Raw Queue Consumers ----------
const REDIS_URL = process.env.INTERNAL_REDIS_URL || 'redis://redis-internal:6379';
const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  retryStrategy: times => Math.min(times * 100, 3000),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

async function waitForRedis() {
  console.log('[worker-logs] ⏳ Waiting for Redis to be ready...');
  for (let i = 1; i <= 30; i++) {
    try {
      await redis.ping();
      console.log('[worker-logs] ✅ Redis ready for log consumers');
      return true;
    } catch (err) {
      console.log(`[worker-logs] ⏳ Redis not ready (attempt ${i}/30)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error('[worker-logs] ❌ Redis not ready after 30 attempts');
  process.exit(1);
}

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
  maxMessages: 100,
});

transporter.verify()
  .then(() => console.log('[worker-logs] ✅ Email transporter verified'))
  .catch(err => console.warn('[worker-logs] ⚠️ Email transporter warning:', err.message));

// ============================================================
// HIGH-THROUGHPUT MICRO-BATCH CONSUMER: API Logs
// ============================================================
const API_QUEUE_KEY = 'bullmq:bullmq-api-logs:wait';
const API_DEAD_LETTER_KEY = 'bullmq:bullmq-api-logs:dead';

let logBatch = [];
const BATCH_SIZE = 150;
const FLUSH_INTERVAL_MS = 50;
let flushTimer = null;

function normalizeLogDoc(logData) {
  const project_id = logData.project_id;
  if (!project_id) return null;

  const username = project_id.includes('_') ? project_id.split('_')[0] : null;
  const timestamp = logData.timestamp
    ? new Date(typeof logData.timestamp === 'number' ? logData.timestamp * 1000 : logData.timestamp)
    : new Date();

  const latency_ms = Number(logData.latency_ms) || 0;
  const team_latency = Number(logData.team_latency) || 0;
  const user_latency = Number(logData.user_latency) || 0;
  const total_latency = Number(logData.total_latency) || (latency_ms + team_latency + user_latency);

  return {
    project_id,
    path: logData.path || '',
    method: (logData.method || 'GET').toUpperCase(),
    timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
    cache: logData.cache || 'MISS',
    ip: logData.ip || '',
    status: Number(logData.status) || 200,
    latency_ms,
    team_latency,
    user_latency,
    total_latency,
    private: Boolean(logData.private),
    ttl: Number(logData.ttl) || 0,
    username,
  };
}

async function flushLogBatch() {
  if (logBatch.length === 0) return;

  const batchToInsert = logBatch;
  logBatch = [];

  try {
    await ApiCallLog.insertMany(batchToInsert, { ordered: false });
  } catch (err) {
    console.error(`[api-logs] ⚠️ Batch insert warning (${batchToInsert.length} logs):`, err.message);
  }
}

function queueLogForBatch(doc) {
  logBatch.push(doc);
  if (logBatch.length >= BATCH_SIZE) {
    flushLogBatch();
  }
}

async function startApiLogConsumer() {
  console.log('[api-logs] 📡 Starting high-throughput micro-batched log consumer...');
  flushTimer = setInterval(flushLogBatch, FLUSH_INTERVAL_MS);

  while (true) {
    try {
      const result = await redis.blpop(API_QUEUE_KEY, 1);
      if (result) {
        const [, raw] = result;
        try {
          const logData = JSON.parse(raw);
          const doc = normalizeLogDoc(logData);
          if (doc) {
            queueLogForBatch(doc);
          }
        } catch (parseErr) {
          console.error('[api-logs] ❌ Failed to parse JSON log:', raw);
          await redis.rpush(API_DEAD_LETTER_KEY, raw).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[api-logs] ❌ Consumer read error:', err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ============================================================
// SECURITY & EMAIL WORKER (Handles General Emails + DoS Alerts)
// ============================================================
async function handleDosAlert(data) {
  const { project_id, ip, path, method } = data;
  console.log(`[email] 🚨 DoS alert detected – processing ban for project: ${project_id}, IP: ${ip}`);

  const project = await Project.findOne({ id: project_id }).lean();
  if (!project) {
    console.warn(`[email] ⚠️ Project ${project_id} not found – skipping email notification`);
    return;
  }

  // 1. Record 24-hour IP ban in MongoDB
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  try {
    await BlockedIP.findOneAndUpdate(
      { project_id, ip },
      {
        project_id,
        ip,
        reason: 'DoS protection (rate limit exceeded)',
        blockedAt: new Date(),
        expiresAt,
        requestPath: path || '',
        requestMethod: method || 'GET',
        isPrivate: true,
      },
      { upsert: true, new: true }
    );
    console.log(`[email] ✅ IP ${ip} banned until ${expiresAt.toISOString()}`);
  } catch (err) {
    console.error('[email] ❌ Error saving BlockedIP record:', err.message);
  }

  // 2. Fetch team member emails
  const memberUsernames = [project.username, ...(project.members || [])];
  const uniqueMembers = [...new Set(memberUsernames)];
  const users = await User.find({ username: { $in: uniqueMembers } }).select('email').lean();
  const emails = users.map(u => u.email).filter(e => e && e.trim() !== '');

  if (emails.length > 0) {
    const subject = `🔴 DoS Alert – ${project.projectname} (${project_id})`;
    const body = `Your project "${project.projectname}" (${project_id}) received over rate-limit private requests from IP ${ip}. The IP has been banned for 24 hours.\n\nRequest path: ${path || 'N/A'}\nTime: ${new Date().toISOString()}\n\nThis is an automated security notification.`;

    for (const email of emails) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"mockAPI Security" <no-reply@mockapi.info>',
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
    console.warn(`[email] ⚠️ No valid emails found for project members – IP still banned.`);
  }
}

const emailWorker = new Worker(
  'bullmq-email-jobs',
  async (job) => {
    try {
      const data = job.data || {};
      if (!data || Object.keys(data).length === 0) return;

      const { project_id, ip, is_private } = data;

      // ---- DoS Alert Branch ----
      if (project_id && ip && is_private === true) {
        await handleDosAlert(data);
        return;
      }

      // ---- Regular Email Branch ----
      if (!data.to) return;
      console.log(`[email] 📧 Sending general email to: ${data.to}`);
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"mockAPI" <no-reply@mockapi.info>',
          to: data.to,
          subject: data.subject || 'Notification',
          text: data.body,
          html: data.html,
        });
        console.log(`[email] ✅ General email sent to ${data.to}`);
      } catch (mailErr) {
        console.error(`[email] ❌ Failed to send general email:`, mailErr.message);
      }
    } catch (err) {
      console.error(`[email] ❌ Unhandled error in job ${job.id}:`, err.message);
    }
  },
  {
    connection: { url: REDIS_URL },
    prefix: 'bullmq',
    concurrency: 5,
    attempts: 2,
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
    lockDuration: 60000,
  }
);

// ============================================================
// LATENCY WORKER: Team & User Rolling Averages
// ============================================================
const latencyWorker = new Worker(
  'bullmq-latency-store',
  async (job) => {
    const { project_id, username, rtt } = job.data || {};
    if (!project_id || !username || rtt == null) {
      return;
    }
    try {
      let teamDoc = await TeamLatency.findOne({ project_id, username });
      if (!teamDoc) {
        teamDoc = await TeamLatency.create({ project_id, username, averageRtt: rtt, sampleCount: 1 });
      } else {
        const oldAvg = teamDoc.averageRtt || 0;
        const oldCount = teamDoc.sampleCount || 1;
        teamDoc.averageRtt = Math.round((oldAvg * oldCount + rtt) / (oldCount + 1));
        teamDoc.sampleCount = oldCount + 1;
        await teamDoc.save();
      }

      const allMembers = await TeamLatency.find({ project_id }).select('averageRtt').lean();
      const teamAvg = allMembers.length
        ? Math.round(allMembers.reduce((s, m) => s + m.averageRtt, 0) / allMembers.length)
        : rtt;

      await redis.set(`team:latency:${project_id}`, String(teamAvg), 'EX', 3600);
      await redis.set(`user:latency:${project_id}:${username}`, String(rtt), 'EX', 3600);
    } catch (err) {
      console.error('[latency] ❌ Error updating latency store:', err.message);
      throw err;
    }
  },
  {
    connection: { url: REDIS_URL },
    prefix: 'bullmq',
    concurrency: 10,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 1800 },
    removeOnFail: { age: 3600 },
    lockDuration: 60000,
  }
);

emailWorker.on('completed', job => console.log(`[email] ✅ Completed job ${job.id}`));
emailWorker.on('failed', (job, err) => console.error(`[email] ❌ Failed job ${job.id}:`, err.message));
latencyWorker.on('completed', job => console.log(`[latency] ✅ Completed latency job ${job.id}`));
latencyWorker.on('failed', (job, err) => console.error(`[latency] ❌ Failed latency job ${job.id}:`, err.message));

// ============================================================
// BOOTSTRAP & GRACEFUL SHUTDOWN
// ============================================================
waitForRedis().then(() => {
  startApiLogConsumer().catch(err => console.error('[api-logs] ❌ Fatal error:', err));
});

async function shutdown() {
  console.log('[worker-logs] 🔴 Shutting down gracefully...');
  if (flushTimer) clearInterval(flushTimer);
  await flushLogBatch(); // drain buffered logs

  await emailWorker.close().catch(() => {});
  await latencyWorker.close().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  await redis.quit().catch(() => {});
  await redisInternal.quit().catch(() => {});
  console.log('[worker-logs] 👋 All workers shut down cleanly');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[worker-logs] 🚀 All workers started and listening!');