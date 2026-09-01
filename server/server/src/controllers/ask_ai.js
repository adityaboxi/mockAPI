require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const { connectRedis } = require('../config/redis');
const crypto = require('crypto');
const aiQueue = require('../queues/aiQueue');
const User = require('../models/User');

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
  return `ai:response:${hash}`;
}

function getOriginalKey(payload) {
  const sortedPayload = sortObjectKeys(payload);
  const jsonStr = JSON.stringify(sortedPayload);
  const hash = crypto.createHash('md5').update(jsonStr).digest('hex');
  return `ai:original:${hash}`;
}

async function ask_ai(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const isGuest = req.user.isGuest === true || req.user.role === 'guest';
    if (isGuest) {
      return res.status(403).json({ error: 'Guests cannot use AI features. Please sign up.' });
    }

    const username = req.user.username;
    if (!username) {
      return res.status(401).json({ error: 'Invalid user token' });
    }

    const userDoc = await User.findOne({ username }).select('subscribe').lean();
    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isSubscribed = userDoc.subscribe === true;
    if (!isSubscribed) {
      return res.status(403).json({ error: 'Subscription required to use AI features' });
    }

    const userInput = req.body;
    if (!userInput || typeof userInput !== 'object') {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const client = await connectRedis();
    const cacheKey = getCacheKey(userInput);
    const cached = await client.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    const ttl = parseInt(process.env.TTL_REVERSE_AI_RESPONSE, 10) || 120;
    const originalKey = getOriginalKey(userInput);
    await client.setEx(originalKey, ttl, JSON.stringify(userInput));

    const job = await aiQueue.add('generate-ai', {
      userInput,
      userId: username,
      isGuest,
      isSubscribed,
      cacheKey,
    });

    return res.status(202).json({
      jobId: job.id,
      status: 'queued',
    });
  } catch (error) {
    console.error('[ask-ai] Error:', error.message);
    return res.status(500).json({ error: 'Failed to enqueue AI request' });
  }
}

async function getAiResult(req, res) {
  try {
    const { jobId } = req.params;
    const job = await aiQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const result = job.returnvalue;

    if (state === 'completed') {
      return res.json({ status: 'completed', result });
    } else if (state === 'failed') {
      return res.json({ status: 'failed', error: job.failedReason });
    } else {
      return res.json({ status: 'pending' });
    }
  } catch (error) {
    console.error('[getAiResult] Error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch job status' });
  }
}

module.exports = { ask_ai, getAiResult };