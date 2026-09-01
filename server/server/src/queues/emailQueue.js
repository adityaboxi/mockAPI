require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const { Queue, Worker } = require('bullmq');
const { sendOTPEmail } = require('../services/emailService');

const connectionOpts = {
  url: process.env.REDIS_URL || 'redis://redis-external:6379',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

// Queue for sending emails
const emailQueue = new Queue('emailQueue', {
  connection: connectionOpts,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

// Worker to process email jobs
const emailWorker = new Worker(
  'emailQueue',
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
    connection: connectionOpts,
    concurrency: 5,
    lockDuration: 60000,
  }
);

emailWorker.on('completed', (job) => {
  console.log(`[emailWorker] ✅ Job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[emailWorker] ❌ Job ${job.id} failed:`, err.message);
});

emailWorker.on('error', (err) => {
  console.error('[emailWorker] ❌ Worker error:', err.message);
});

console.log('[emailQueue] 🚀 Email worker started');

module.exports = { emailQueue, emailWorker };