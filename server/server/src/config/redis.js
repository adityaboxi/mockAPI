const redis = require('redis');

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) throw new Error('REDIS_URL env is not set');

const redisClient = redis.createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      const delay = Math.min(Math.pow(2, retries) * 100, 10000);
      console.log(`🔄 Redis reconnecting in ${delay}ms...`);
      return delay;
    }
  }
});

redisClient.on('connect', () => console.log('✅ Redis connected successfully'));
redisClient.on('error', (err) => console.error('❌ Redis error:', err));
redisClient.on('ready', () => console.log('✅ Redis client ready'));
redisClient.on('end', () => console.log('⚠️ Redis connection closed'));

const connectRedis = async () => {
  try {
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    process.exit(1);
  }
};

const INVITATION_RESERVE_TTL = parseInt(process.env.INVITATION_RESERVE_TTL, 10) || 30;
const INVITATION_STORE_TTL = parseInt(process.env.INVITATION_STORE_TTL, 10) || 604800;
const PROJECT_CACHE_TTL = parseInt(process.env.PROJECT_CACHE_TTL, 10) || 1800;

const getInvitationRedisKey = (invitationCode) => `invitation:${invitationCode}`;

const isInvitationCodeInRedis = async (invitationCode) => {
  const key = getInvitationRedisKey(invitationCode);
  const exists = await redisClient.exists(key);
  return exists === 1;
};

const reserveInvitationCodeInRedis = async (invitationCode) => {
  const key = getInvitationRedisKey(invitationCode);
  await redisClient.set(key, 'reserved', { EX: INVITATION_RESERVE_TTL });
  return true;
};

const removeInvitationCodeReservation = async (invitationCode) => {
  const key = getInvitationRedisKey(invitationCode);
  await redisClient.del(key);
  return true;
};

const storeInvitationCode = async (invitationCode, projectData) => {
  const key = getInvitationRedisKey(invitationCode);
  await redisClient.set(key, JSON.stringify(projectData), { EX: INVITATION_STORE_TTL });
  return true;
};

const getProjectIdFromInvitation = async (invitationCode) => {
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
  const key = `project:${username}:${projectname}`;
  const data = await redisClient.get(key);
  if (data) {
    try { return JSON.parse(data); } catch { return data; }
  }
  return null;
};

const cacheProject = async (username, projectname, projectData) => {
  const key = `project:${username}:${projectname}`;
  await redisClient.set(key, JSON.stringify(projectData), { EX: PROJECT_CACHE_TTL });
  return true;
};

const clearCachedProject = async (username, projectname) => {
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
  clearCachedProject
};