// bullmq-worker/config/redis.js
const redis = require('redis');

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) throw new Error('REDIS_URL env is not set');

const redisClient = redis.createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      const delay = Math.min(Math.pow(2, retries) * 100, 10000);
      return delay;
    }
  }
});

redisClient.on('error', (err) => console.error('❌ Redis error (worker):', err));

const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log('[bullmq-worker] Redis connected');
    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection failed (worker):', error);
    process.exit(1);
  }
};

module.exports = {
  redisClient,
  connectRedis,
};