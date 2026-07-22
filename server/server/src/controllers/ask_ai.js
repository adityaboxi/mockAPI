// controllers/ask_ai.js
require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const { redisClient } = require('../config/redis');
const crypto = require('crypto');
const aiQueue = require('../queues/aiQueue');
const User = require('../models/User');

// ---------- Helper Functions ----------

/**
 * Recursively sort object keys to ensure consistent cache key generation.
 */
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


function generateSampleResponse(userInput) {
  return {
    protocol: 'https',
    method: 'POST',
    urlPath: '/api/v2/sample',
    pathParams: [],
    queryParams: [],
    requestBody: { message: 'AI service busy, using sample response' },
    responseBody: { status: 'success', data: 'sample' },
    isAuthEnabled: false,
    authScheme: 'BearerAuth',
    latency: 100,
    rateLimit: 10,
    headers: [],
    responseHeaders: [],
    cookies: [],
    expectedToken: '',
    expectedApiKey: '',
    includeAIResponse: false,
    statusCode: 200,
  };
}

/**
 * Merge the AI suggestion with the original user input (fallback).
 */
function buildFinalResponse(aiResponse, userInput) {
  return {
    protocol: aiResponse.protocol ?? userInput.protocol ?? 'https',
    method: aiResponse.method ?? userInput.method ?? 'GET',
    urlPath: aiResponse.urlPath ?? userInput.urlPath ?? '/api/v2/suggested',
    pathParams: aiResponse.pathParams ?? userInput.pathParams ?? [],
    queryParams: aiResponse.queryParams ?? userInput.queryParams ?? [],
    requestBody: aiResponse.requestBody ?? userInput.requestBody ?? null,
    responseBody: aiResponse.responseBody ?? userInput.responseBody ?? null,
    isAuthEnabled: aiResponse.isAuthEnabled ?? userInput.isAuthEnabled ?? false,
    authScheme: aiResponse.authScheme ?? userInput.authScheme ?? 'BearerAuth',
    latency: aiResponse.latency ?? userInput.latency ?? 0,
    rateLimit: aiResponse.rateLimit ?? userInput.rateLimit ?? 0,
    headers: aiResponse.headers ?? userInput.headers ?? [],
    responseHeaders: aiResponse.responseHeaders ?? userInput.responseHeaders ?? [],
    cookies: aiResponse.cookies ?? userInput.cookies ?? [],
    expectedToken: aiResponse.expectedToken ?? userInput.expectedToken ?? '',
    expectedApiKey: aiResponse.expectedApiKey ?? userInput.expectedApiKey ?? '',
    includeAIResponse: aiResponse.includeAIResponse ?? userInput.includeAIResponse ?? false,
    statusCode: aiResponse.statusCode ?? userInput.statusCode ?? 200,
  };
}

// ---------- Controllers ----------
async function ask_ai(req, res) {
  try {
    // 1. Authentication and user validation
    if (!req.user) {
      console.warn('[ask-ai] No user object – missing authentication middleware');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const isGuest = req.user.isGuest === true || req.user.role === 'guest';
    let username = null;
    let isSubscribed = false;

    if (!isGuest) {
      username = req.user.username;
      if (!username) {
        console.warn('[ask-ai] No username in token for non-guest');
        return res.status(401).json({ error: 'Invalid user token' });
      }
      const userDoc = await User.findOne({ username });
      if (!userDoc) {
        console.warn(`[ask-ai] User not found: ${username}`);
        return res.status(404).json({ error: 'User not found' });
      }
      isSubscribed = userDoc.subscribe === true;
    }

    // 2. Validate input
    const userInput = req.body;
    if (!userInput || typeof userInput !== 'object') {
      return res.status(400).json({ error: 'Invalid input' });
    }

    // 3. Check Redis cache for the AI response
    const cacheKey = getCacheKey(userInput);
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const result = JSON.parse(cached);
      console.log(`[ask-ai] ✅ Cache hit for user ${username || 'guest'}`);
      return res.status(200).json(result);
    }

    // 4. Store the original payload for reverse_ai (with same TTL)
    const ttl = parseInt(process.env.TTL_REVERSE_AI_RESPONSE, 10) || 120;
    const originalKey = getOriginalKey(userInput);
    await redisClient.setEx(originalKey, ttl, JSON.stringify(userInput));
    console.log(`[ask-ai] Stored original payload under: ${originalKey}`);

    // 5. Enqueue the AI job
    const job = await aiQueue.add('generate-ai', {
      userInput,
      userId: username,
      isGuest,
      isSubscribed,
      cacheKey, // passes the key where the worker should store the AI response
    });

    console.log(`[ask-ai] 🔥 Job enqueued: ${job.id} for user ${username || 'guest'}`);
    console.log(`[ask-ai] CacheKey: ${cacheKey}`);
    console.log(`[ask-ai] Payload snippet:`, {
      protocol: userInput.protocol,
      method: userInput.method,
      urlPath: userInput.urlPath,
      geminiInput: userInput.geminiInput?.substring(0, 50) + '...',
    });

    // 6. Return 202 Accepted with jobId
    return res.status(202).json({
      jobId: job.id,
      status: 'queued',
    });
  } catch (error) {
    console.error('[ask-ai] ❌ Error:', error);
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

    console.log(`[getAiResult] Job ${jobId} state: ${state}`);
    if (state === 'completed') {
      console.log(`[getAiResult] Result:`, result);
      return res.json({ status: 'completed', result });
    } else if (state === 'failed') {
      console.log(`[getAiResult] Failed reason:`, job.failedReason);
      return res.json({ status: 'failed', error: job.failedReason });
    } else {
      // 'waiting', 'active', 'delayed', etc.
      return res.json({ status: 'pending' });
    }
  } catch (error) {
    console.error('[getAiResult] ❌ Error:', error);
    return res.status(500).json({ error: 'Failed to fetch job status' });
  }
}

module.exports = { ask_ai, getAiResult };