const { redisClient } = require('../config/redis');
const crypto = require('crypto');

function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  return Object.keys(obj).sort().reduce((sorted, key) => {
    sorted[key] = sortObjectKeys(obj[key]);
    return sorted;
  }, {});
}

function getCacheKey(payload) {
  const sortedPayload = sortObjectKeys(payload);
  const jsonStr = JSON.stringify(sortedPayload);
  const hash = crypto.createHash('md5').update(jsonStr).digest('hex');
  return `ai:original:${hash}`;
}

async function reverse_ai(req, res) {
  try {
    const userInput = req.body;
    if (!userInput || typeof userInput !== 'object') {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const cacheKey = getCacheKey(userInput);
    const originalData = await redisClient.get(cacheKey);

    if (!originalData) {
      return res.status(404).json({ error: 'No previous data found (expired or never stored)' });
    }

    await redisClient.del(cacheKey);
    console.log('[reverse-ai] Retrieved and deleted key:', cacheKey);

    res.status(200).json({
      success: true,
      previousData: JSON.parse(originalData),
      message: 'Previous data retrieved and cache cleared'
    });
  } catch (error) {
    console.error('[reverse-ai] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = reverse_ai;