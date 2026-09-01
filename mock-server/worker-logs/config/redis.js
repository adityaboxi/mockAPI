require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const redis = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://redis-external:6379';

const redisClient = redis.createClient({
  url: REDIS_URL,
  socket: {
    connectTimeout: 10000,
    keepAlive: 5000,
    reconnectStrategy: (retries) => {
      if (retries > 20) {
        console.error('[redis-external] ❌ Max reconnection attempts reached.');
        return new Error('Max Redis reconnection attempts reached');
      }
      // Exponential backoff with jitter to prevent thundering herd
      const jitter = Math.floor(Math.random() * 200);
      const delay = Math.min(Math.pow(2, retries) * 100 + jitter, 5000);
      return delay;
    },
  },
});

// Lifecycle Event Listeners
redisClient.on('error', (err) => console.error('[redis-external] ❌ Redis Client Error:', err.message));
redisClient.on('connect', () => console.log('[redis-external] 🔄 Redis Connecting...'));
redisClient.on('ready', () => console.log('[redis-external] ✅ Redis Ready for High-Throughput Traffic'));
redisClient.on('reconnecting', () => console.warn('[redis-external] ⚠️ Redis Reconnecting...'));
redisClient.on('end', () => console.log('[redis-external] 🛑 Redis Connection Ended'));

// Connection Mutex to prevent "SocketAlreadyConnectedError" on concurrent calls
let connectingPromise = null;

const connectRedis = async () => {
  if (redisClient.isOpen) {
    return redisClient;
  }
  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = redisClient.connect()
    .then(() => redisClient)
    .finally(() => {
      connectingPromise = null;
    });

  return connectingPromise;
};

// Health Check Helper
const pingRedis = async () => {
  try {
    if (!redisClient.isOpen) await connectRedis();
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
};

// Graceful Disconnect Helper
const disconnectRedis = async () => {
  if (redisClient.isOpen) {
    await redisClient.quit().catch(() => {});
  }
};

module.exports = { 
  redisClient, 
  connectRedis, 
  pingRedis, 
  disconnectRedis 
};