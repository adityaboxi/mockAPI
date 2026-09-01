require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const redis = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://redis-external:6379';

const redisClient = redis.createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      const delay = Math.min(Math.pow(2, retries) * 50 + Math.random() * 100, 3000);
      return delay;
    },
  },
});

redisClient.on('error', (err) => console.error('❌ Redis error (worker):', err.message));

let connectingPromise = null;

const connectRedis = async () => {
  if (redisClient.isOpen) {
    return redisClient;
  }
  if (connectingPromise) {
    return connectingPromise;
  }
  connectingPromise = redisClient
    .connect()
    .then(() => {
      console.log('[bullmq-worker] Redis connected');
      connectingPromise = null;
      return redisClient;
    })
    .catch((error) => {
      connectingPromise = null;
      console.error('❌ Redis connection failed (worker):', error.message);
      throw error;
    });
  return connectingPromise;
};

module.exports = {
  redisClient,
  connectRedis,
};