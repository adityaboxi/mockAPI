require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const redis = require('redis');

const INTERNAL_REDIS_URL = process.env.INTERNAL_REDIS_URL || 'redis://redis-internal:6379';

const redisInternal = redis.createClient({
  url: INTERNAL_REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      const delay = Math.min(Math.pow(2, retries) * 100, 10000);
      return delay;
    }
  }
});

redisInternal.on('error', (err) => console.error('[redis-internal] Error:', err));
redisInternal.on('connect', () => console.log('[redis-internal] Connected'));

const connectRedisInternal = async () => {
  if (!redisInternal.isOpen) {
    await redisInternal.connect();
  }
  return redisInternal;
};

module.exports = { redisInternal, connectRedisInternal };