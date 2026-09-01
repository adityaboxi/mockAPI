require('../opentelemetry/universal-logger');  // <-- Add this line FIRST
const redis = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://redis-external:6379';

const redisClient = redis.createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 20) return new Error('Redis max retries reached');
      const delay = Math.min(Math.pow(2, retries) * 50 + Math.random() * 100, 3000);
      return delay;
    },
    connectTimeout: 5000,
  },
});

redisClient.on('error', (err) => console.error('❌ Redis error:', err.message));

let connectingPromise = null;

const connectRedis = async () => {
  if (redisClient.isOpen) return redisClient;
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    try {
      await redisClient.connect();
      return redisClient;
    } catch (error) {
      if (error.message && error.message.includes('Socket already opened')) {
        return redisClient;
      }
      console.error('❌ Redis connection failed:', error.message);
      throw error;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
};

const INVITATION_RESERVE_TTL = parseInt(process.env.INVITATION_RESERVE_TTL, 10) || 30;
const INVITATION_STORE_TTL = parseInt(process.env.INVITATION_STORE_TTL, 10) || 604800;
const PROJECT_CACHE_TTL = parseInt(process.env.PROJECT_CACHE_TTL, 10) || 1800;

const getInvitationRedisKey = (invitationCode) => `invitation:${invitationCode}`;

const isInvitationCodeInRedis = async (invitationCode) => {
  await connectRedis();
  const key = getInvitationRedisKey(invitationCode);
  const exists = await redisClient.exists(key);
  return exists === 1;
};

const reserveInvitationCodeInRedis = async (invitationCode) => {
  await connectRedis();
  const key = getInvitationRedisKey(invitationCode);
  await redisClient.set(key, 'reserved', { EX: INVITATION_RESERVE_TTL });
  return true;
};

const removeInvitationCodeReservation = async (invitationCode) => {
  await connectRedis();
  const key = getInvitationRedisKey(invitationCode);
  await redisClient.del(key);
  return true;
};

const storeInvitationCode = async (invitationCode, projectData) => {
  await connectRedis();
  const key = getInvitationRedisKey(invitationCode);
  await redisClient.set(key, JSON.stringify(projectData), { EX: INVITATION_STORE_TTL });
  return true;
};

const getProjectIdFromInvitation = async (invitationCode) => {
  await connectRedis();
  const key = getInvitationRedisKey(invitationCode);
  const data = await redisClient.get(key);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      return parsed.projectId || parsed;
    } catch {
      return data;
    }
  }
  return null;
};

const getCachedProject = async (username, projectname) => {
  await connectRedis();
  const key = `project:${username}:${projectname}`;
  const data = await redisClient.get(key);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return null;
};

const cacheProject = async (username, projectname, projectData) => {
  await connectRedis();
  const key = `project:${username}:${projectname}`;
  await redisClient.set(key, JSON.stringify(projectData), { EX: PROJECT_CACHE_TTL });
  return true;
};

const clearCachedProject = async (username, projectname) => {
  await connectRedis();
  const key = `project:${username}:${projectname}`;
  await redisClient.del(key);
  return true;
};

module.exports = {
  redisClient,
  connectRedis,
  getInvitationRedisKey,
  isInvitationCodeInRedis,
  reserveInvitationCodeInRedis,
  removeInvitationCodeReservation,
  storeInvitationCode,
  getProjectIdFromInvitation,
  getCachedProject,
  cacheProject,
  clearCachedProject,
};