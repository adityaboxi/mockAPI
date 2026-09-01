require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const crypto = require('crypto');
const { connectRedis } = require('../config/redis');

const DEFAULT_TTL = 300; // 5 minutes
const LIST_TTL = 60;     // 1 minute

async function getClient() {
  return await connectRedis();
}

// Key generators
const getKey = (collection, id) => `${collection}:${id}`;
const getListKey = (collection, query = {}) => {
  const sorted = JSON.stringify(query, Object.keys(query).sort());
  const hash = crypto.createHash('md5').update(sorted).digest('hex');
  return `${collection}:list:${hash}`;
};

// Get a single document
const get = async (collection, id) => {
  if (!collection || !id) return null;
  try {
    const client = await getClient();
    const key = getKey(collection, id);
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (_) {
    return null;
  }
};

// Set a single document with TTL
const set = async (collection, id, document, ttl = DEFAULT_TTL) => {
  if (!collection || !id || !document) return;
  try {
    const client = await getClient();
    const key = getKey(collection, id);
    await client.setEx(key, ttl, JSON.stringify(document));
  } catch (_) {}
};

// Get a list (by query)
const getList = async (collection, query = {}) => {
  if (!collection) return null;
  try {
    const client = await getClient();
    const key = getListKey(collection, query);
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (_) {
    return null;
  }
};

// Set a list with TTL
const setList = async (collection, data, query = {}, ttl = LIST_TTL) => {
  if (!collection || !data) return;
  try {
    const client = await getClient();
    const key = getListKey(collection, query);
    await client.setEx(key, ttl, JSON.stringify(data));
  } catch (_) {}
};

// Invalidate a single document
const invalidate = async (collection, id) => {
  if (!collection || !id) return;
  try {
    const client = await getClient();
    const key = getKey(collection, id);
    await client.del(key);
  } catch (_) {}
};

// Invalidate all list caches for a collection non-blockingly
const invalidateLists = async (collection) => {
  if (!collection) return;
  try {
    const client = await getClient();
    const pattern = `${collection}:list:*`;
    const keys = [];

    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }

    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (_) {}
};

module.exports = {
  get,
  set,
  getList,
  setList,
  invalidate,
  invalidateLists,
  DEFAULT_TTL,
  LIST_TTL,
};