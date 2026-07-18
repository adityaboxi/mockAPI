require('dotenv').config();
const mongoose = require('mongoose');
const Redis = require('ioredis');
const nodemailer = require('nodemailer');
const { Worker } = require('bullmq');

// Models (only those that exist in this container)
const ApiCallLog = require('./models/ApiCallLog');
const BlockedIP = require('./models/BlockedIP');
const TeamLatency = require('./models/TeamLatency');

// Redis client for caching (used by latency worker)
const redisInternal = require('./config/redisInternal');

console.log('[worker-logs] 🚀 Starting...');

// ---------- MongoDB ----------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[worker-logs] ✅ MongoDB connected'))
  .catch(err => {
    console.error('[worker-logs] ❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ---------- Redis connection for raw list consumer ----------
const redis = new Redis(process.env.INTERNAL_REDIS_URL, {
  lazyConnect: true,
  retryStrategy: times => Math.min(times * 100, 3000)
});

// Wait for Redis to be ready before starting the consumer
async function waitForRedis() {
  console.log('[worker-logs] ⏳ Waiting for Redis to be ready...');
  let attempts = 0;
  while (attempts < 30) {
    try {
      await redis.ping();
      console.log('[worker-logs] ✅ Redis ready for raw consumer');
      return true;
    } catch (err) {
      attempts++;
      console.log(`[worker-logs] ⏳ Redis not ready (attempt ${attempts}/30)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error('[worker-logs] ❌ Redis not ready after 30 attempts, exiting');
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
// CUSTOM CONSUMER: reads raw JSON from Redis list
// ============================================================
const QUEUE_KEY = 'bullmq:bullmq-api-logs:wait';
const DEAD_LETTER_KEY = 'bullmq:bullmq-api-logs:dead';

async function processLogEntry(logData) {
  console.log('[api-logs] 📨 Processing log data:', JSON.stringify(logData, null, 2));

  // project_id is already present in the log data
  const project_id = logData.project_id;

  if (!project_id) {
    console.error('[api-logs] ❌ Missing project_id, skipping job:', logData);
    return; // skip – no fallback needed
  }

  const username = project_id.includes('_') ? project_id.split('_')[0] : null;

  const timestamp = logData.timestamp
    ? new Date(typeof logData.timestamp === 'number' ? logData.timestamp * 1000 : logData.timestamp)
    : new Date();

  const doc = {
    project_id,
    path: logData.path || '',
    method: logData.method || 'GET',
    timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
    cache: logData.cache || 'MISS',
    ip: logData.ip || '',
    status: logData.status || 200,
    latency_ms: Number(logData.latency_ms) || 0,
    team_latency: Number(logData.team_latency) || 0,
    user_latency: Number(logData.user_latency) || 0,
    total_latency: Number(logData.total_latency) || Number(logData.latency_ms) || 0,
    private: !!logData.private,
    ttl: Number(logData.ttl) || 0,
    username,
  };

  console.log('[api-logs] 📄 Document to save:', JSON.stringify(doc, null, 2));

  try {
    const saved = await ApiCallLog.create(doc);
    console.log(`[api-logs] ✅ Saved log for ${project_id} | ${doc.method} ${doc.path} | ${doc.total_latency}ms (ID: ${saved._id})`);
  } catch (err) {
    console.error('[api-logs] ❌ MongoDB save error:', err.message);
    throw err; // re-throw to move to dead-letter
  }
}

// Start the consumer loop (called after Redis is ready)
async function startConsumer() {
  console.log('[api-logs] 📡 Starting raw list consumer...');
  while (true) {
    try {
      const result = await redis.blpop(QUEUE_KEY, 0); // block forever
      if (result) {
        const [, raw] = result;
        try {
          const logData = JSON.parse(raw);
          await processLogEntry(logData);
        } catch (parseErr) {
          console.error('[api-logs] ❌ Failed to parse JSON:', raw, parseErr);
          await redis.rpush(DEAD_LETTER_KEY, raw);
        }
      }
    } catch (err) {
      console.error('[api-logs] ❌ Consumer error:', err);
      await new Promise(r => setTimeout(r, 1000)); // backoff
    }
  }
}

// Wait for Redis readiness, then start consumer
waitForRedis().then(() => {
  startConsumer().catch(err => console.error('[api-logs] ❌ Consumer fatal error:', err));
});

// ============================================================
// BullMQ workers for email and latency
// ============================================================
console.log('[worker-logs] Creating BullMQ workers for other tasks...');
const connectionOpts = {
  connection: { url: process.env.INTERNAL_REDIS_URL },
};

// Email worker
const emailWorker = new Worker(
  'bullmq-email-jobs',
  async (job) => {
    const data = job.data || {};
    console.log('[email] 📨 Received:', data);
    try {
      await transporter.sendMail({
        from: '"mockAPI Security" <no-reply@mockapi.info>',
        to: data.to,
        subject: data.subject || 'Security Alert',
        text: data.body,
      });
      console.log(`[email] ✅ Sent to ${data.to}`);
    } catch (err) {
      console.error('[email] ❌ Send failed:', err.message);
      throw err;
    }
    if (data.project_id && data.ip && data.is_private) {
      try {
        const existing = await BlockedIP.findOne({
          project_id: data.project_id,
          ip: data.ip,
          expiresAt: { $gt: new Date() }
        });
        if (!existing) {
          await BlockedIP.create({
            project_id: data.project_id,
            ip: data.ip,
            reason: 'DoS protection',
            blockedAt: new Date(),
            expiresAt: new Date(Date.now() + 24*60*60*1000),
            requestPath: data.path || '',
            requestMethod: data.method || 'GET',
            isPrivate: true,
          });
          console.log(`[email] ✅ Blocked IP ${data.ip}`);
        }
      } catch (err) {
        console.error('[email] ❌ Block save error:', err.message);
      }
    }
  },
  {
    ...connectionOpts,
    prefix: 'bullmq',
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: { count: 50 },
  }
);

// Latency worker
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
      console.log(`[latency] ✅ Team avg updated: ${teamAvg}ms`);
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
  }
);

// Event listeners
emailWorker.on('completed', job => console.log(`[email] ✅ Completed ${job.id}`));
emailWorker.on('failed', (job, err) => console.error(`[email] ❌ Failed ${job.id}:`, err.message));
latencyWorker.on('completed', job => console.log(`[latency] ✅ Completed ${job.id}`));
latencyWorker.on('failed', (job, err) => console.error(`[latency] ❌ Failed ${job.id}:`, err.message));

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