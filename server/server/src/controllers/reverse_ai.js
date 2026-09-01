require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const { connectRedis } = require('../config/redis');
const crypto = require('crypto');

function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  return Object.keys(obj)
    .sort()
    .reduce((sorted, key) => {
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

    const client = await connectRedis();
    const cacheKey = getCacheKey(userInput);

    const originalData = await client.get(cacheKey);
    if (!originalData) {
      return res.status(404).json({
        error: 'No previous data found (expired or never stored)',
        code: 'NOT_FOUND',
      });
    }

    await client.del(cacheKey);

    return res.status(200).json({
      success: true,
      previousData: JSON.parse(originalData),
      message: 'Reverted to previous data – cache cleared.',
    });
  } catch (error) {
    console.error('[reverse-ai] Unexpected error:', error.message);
    return res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
}

module.exports = reverse_ai;