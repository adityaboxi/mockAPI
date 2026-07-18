const { Queue, Worker } = require('bullmq');
const { sendOTPEmail } = require('../services/emailService');
const { redisClient } = require('../config/redis');

// Queue for sending emails
const emailQueue = new Queue('emailQueue', {
  connection: { url: process.env.REDIS_URL },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 }, // keep for 1 hour
    removeOnFail: { age: 86400 },    // keep for 24 hours
  },
});

// Worker to process email jobs
const emailWorker = new Worker(
  'emailQueue', // must match the queue name
  async (job) => {
    const { email, otp, username } = job.data;
    console.log(`[emailWorker] 📨 Processing job for ${email}`);
    const result = await sendOTPEmail(email, otp, username);
    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }
    console.log(`[emailWorker] ✅ Email sent to ${email}`);
    return result;
  },
  {
    connection: { url: process.env.REDIS_URL },
    concurrency: 5,
    lockDuration: 60000, // 1 minute
  }
);

emailWorker.on('completed', (job) => {
  console.log(`[emailWorker] ✅ Job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[emailWorker] ❌ Job ${job.id} failed:`, err.message);
});

emailWorker.on('error', (err) => {
  console.error('[emailWorker] ❌ Worker error:', err);
});

console.log('[emailQueue] 🚀 Email worker started');

module.exports = { emailQueue, emailWorker };