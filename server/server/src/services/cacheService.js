const redis = require('../config/redis');
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
  const key = getKey(collection, id);
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

// Set a single document with TTL
const set = async (collection, id, document, ttl = DEFAULT_TTL) => {
  const key = getKey(collection, id);
  await redis.setex(key, ttl, JSON.stringify(document));
};

// Get a list (by query)
const getList = async (collection, query = {}) => {
  const key = getListKey(collection, query);
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

// Set a list with TTL
const setList = async (collection, data, query = {}, ttl = LIST_TTL) => {
  const key = getListKey(collection, query);
  await redis.setex(key, ttl, JSON.stringify(data));
};

// Invalidate a single document
const invalidate = async (collection, id) => {
  const key = getKey(collection, id);
  await redis.del(key);
};

// Invalidate all list caches for a collection (⚠️ use with caution)
const invalidateLists = async (collection) => {
  const keys = await redis.keys(`${collection}:list:*`);
  if (keys.length) await redis.del(keys);
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