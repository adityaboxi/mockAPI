require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const redis = require('redis');

const INTERNAL_REDIS_URL = process.env.INTERNAL_REDIS_URL || 'redis://redis-internal:6379';

const redisInternal = redis.createClient({
  url: INTERNAL_REDIS_URL,
  socket: {
    connectTimeout: 10000,
    keepAlive: 5000,
    reconnectStrategy: (retries) => {
      if (retries > 20) {
        console.error('[redis-internal] ❌ Max reconnection attempts reached.');
        return new Error('Max Internal Redis reconnection attempts reached');
      }
      const jitter = Math.floor(Math.random() * 200);
      const delay = Math.min(Math.pow(2, retries) * 100 + jitter, 5000);
      return delay;
    },
  },
});

// Lifecycle Event Listeners
redisInternal.on('error', (err) => console.error('[redis-internal] ❌ Error:', err.message));
redisInternal.on('connect', () => console.log('[redis-internal] 🔄 Connecting...'));
redisInternal.on('ready', () => console.log('[redis-internal] ✅ Internal Redis Ready for Route & Lock Cache'));
redisInternal.on('reconnecting', () => console.warn('[redis-internal] ⚠️ Reconnecting...'));
redisInternal.on('end', () => console.log('[redis-internal] 🛑 Internal Redis Connection Ended'));

// Connection Mutex
let connectingPromise = null;

const connectRedisInternal = async () => {
  if (redisInternal.isOpen) {
    return redisInternal;
  }
  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = redisInternal.connect()
    .then(() => redisInternal)
    .finally(() => {
      connectingPromise = null;
    });

  return connectingPromise;
};

// Health Check Helper
const pingRedisInternal = async () => {
  try {
    if (!redisInternal.isOpen) await connectRedisInternal();
    const pong = await redisInternal.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
};

// Graceful Disconnect Helper
const disconnectRedisInternal = async () => {
  if (redisInternal.isOpen) {
    await redisInternal.quit().catch(() => {});
  }
};

module.exports = { 
  redisInternal, 
  connectRedisInternal, 
  pingRedisInternal, 
  disconnectRedisInternal 
};