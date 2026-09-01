require('./opentelemetry/universal-logger');  // <-- Add this line FIRST
require('dotenv').config();

const { connectRedis, redisClient } = require('./config/redis');
const { aiWorker, pubClient } = require('./workers/aiWorker');

async function start() {
  await connectRedis();
  console.log('[bullmq-worker] AI Worker started (Groq)');
}


const gracefulShutdown = async () => {
  console.log('[bullmq-worker] Shutting down gracefully...');
  try {
    if (aiWorker) await aiWorker.close();
    if (pubClient && pubClient.isOpen) await pubClient.quit();
    if (redisClient && redisClient.isOpen) await redisClient.quit();
  } catch (err) {
    console.error('[bullmq-worker] Error during shutdown:', err.message);
  } finally {
    process.exit(0);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

start().catch((err) => {
  console.error('[bullmq-worker] Fatal startup error:', err.message);
  process.exit(1);
});

