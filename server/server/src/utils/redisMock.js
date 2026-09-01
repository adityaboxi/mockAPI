require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const { redisClient, connectRedis } = require('../config/redis');

// Default TTL: 3600 seconds (1 hour) with fallback against NaN
const TTL = parseInt(process.env.TTL, 10) || 3600;

function normalizePath(urlpath) {
  if (!urlpath) return '/';
  const trimmed = urlpath.trim();
  const leading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return leading.length > 1 && leading.endsWith('/') ? leading.slice(0, -1) : leading;
}

function getDefinitionKey(projectId, version, method, urlpath) {
  const cleanMethod = (method || 'GET').toUpperCase().trim();
  const cleanVersion = (version || 'v1').trim();
  const cleanPath = normalizePath(urlpath);
  return `mockapi:def:${projectId}:${cleanVersion}:${cleanMethod}:${cleanPath}`;
}

async function storeMockDefinition(projectId, version, method, urlpath, definition, customTTL) {
  if (!projectId || !version || !method || !urlpath) return;
  const client = await connectRedis();
  const key = getDefinitionKey(projectId, version, method, urlpath);
  const effectiveTTL = Number.isInteger(customTTL) && customTTL > 0 ? customTTL : TTL;

  await client.setEx(key, effectiveTTL, JSON.stringify(definition));
}

async function getMockDefinition(projectId, version, method, urlpath) {
  if (!projectId || !version || !method || !urlpath) return null;
  const client = await connectRedis();
  const key = getDefinitionKey(projectId, version, method, urlpath);
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
}

async function deleteMockDefinition(projectId, version, method, urlpath) {
  if (!projectId || !version || !method || !urlpath) return;
  const client = await connectRedis();
  const key = getDefinitionKey(projectId, version, method, urlpath);
  await client.del(key);
}

async function clearProjectMockDefinitions(projectId) {
  if (!projectId) return;
  const client = await connectRedis();
  const pattern = `mockapi:def:${projectId}:*`;
  const keysToDelete = [];

  for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    keysToDelete.push(key);
  }

  if (keysToDelete.length > 0) {
    await client.del(keysToDelete);
  }
}

module.exports = {
  storeMockDefinition,
  getMockDefinition,
  deleteMockDefinition,
  clearProjectMockDefinitions,
  getDefinitionKey,
  normalizePath,
};