const { redisClient } = require('../config/redis');
const crypto = require('crypto');

const DEFAULT_TTL = 300; // 5 minutes
const LIST_TTL = 60;     // 1 minute

// Key generators
const getKey = (collection, id) => `${collection}:${id}`;
const getListKey = (collection, query = {}) => {
  const sorted = JSON.stringify(query, Object.keys(query).sort());
  const hash = crypto.createHash('md5').update(sorted).digest('hex');
  return `${collection}:list:${hash}`;
};

// Get a single document
const get = async (collection, id) => {
  try {
    if (!redisClient || !redisClient.isOpen) return null;
    const key = getKey(collection, id);
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (_) {
    return null;
  }
};

// Set a single document with TTL
const set = async (collection, id, document, ttl = DEFAULT_TTL) => {
  try {
    if (!redisClient || !redisClient.isOpen) return;
    const key = getKey(collection, id);
    await redisClient.setEx(key, ttl, JSON.stringify(document));
  } catch (_) {}
};

// Get a list (by query)
const getList = async (collection, query = {}) => {
  try {
    if (!redisClient || !redisClient.isOpen) return null;
    const key = getListKey(collection, query);
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (_) {
    return null;
  }
};

// Set a list with TTL
const setList = async (collection, data, query = {}, ttl = LIST_TTL) => {
  try {
    if (!redisClient || !redisClient.isOpen) return;
    const key = getListKey(collection, query);
    await redisClient.setEx(key, ttl, JSON.stringify(data));
  } catch (_) {}
};

// Invalidate a single document
const invalidate = async (collection, id) => {
  try {
    if (!redisClient || !redisClient.isOpen) return;
    const key = getKey(collection, id);
    await redisClient.del(key);
  } catch (_) {}
};

// Invalidate all list caches for a collection
const invalidateLists = async (collection) => {
  try {
    if (!redisClient || !redisClient.isOpen) return;
    const keys = [];
    for await (const key of redisClient.scanIterator({ MATCH: `${collection}:list:*`, COUNT: 100 })) {
      if (key) keys.push(key);
    }
    if (keys.length) await redisClient.del(keys);
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