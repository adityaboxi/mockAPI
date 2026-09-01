require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const redis = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://redis-external:6379';

const redisClient = redis.createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      const delay = Math.min(Math.pow(2, retries) * 100, 10000);
      return delay;
    }
  }
});

redisClient.on('error', (err) => console.error('[redis-external] Error:', err));
redisClient.on('connect', () => console.log('[redis-external] Connected'));

const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
};

module.exports = { redisClient, connectRedis };