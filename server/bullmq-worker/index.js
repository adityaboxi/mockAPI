// bullmq-worker/index.js
require('dotenv').config();
const { connectRedis } = require('./config/redis');
const aiWorker = require('./workers/aiWorker');

async function start() {
  await connectRedis();
  console.log('[bullmq-worker] Workker started (Groq)');
}

start().catch(err => {
  console.error('[bullmq-worker] Fataal error:', err);
  process.exit(1);
});



