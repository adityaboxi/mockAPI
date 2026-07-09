const { redisClient } = require('../config/redis');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require('../models/User');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = "gemini-2.0-flash";

const AI_TIMEOUT_MS = 70000; // 70 seconds

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

function generateSampleResponse(userInput) {
  return {
    protocol: 'https', method: 'POST', urlPath: '/api/v2/sample',
    pathParams: [], queryParams: [], requestBody: { message: "AI service busy, using sample response" },
    responseBody: { status: "success", data: "sample" }, isAuthEnabled: false,
    authScheme: 'BearerAuth', latency: 100, rateLimit: 10, headers: [],
    responseHeaders: [], cookies: [], expectedToken: '', expectedApiKey: '',
    includeAIResponse: false, statusCode: 200
  };
}

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
    statusCode: aiResponse.statusCode ?? userInput.statusCode ?? 200
  };
}

function withTimeout(promise, ms) {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('AI_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
}

async function callGemini(userInput) {
  const { geminiInput, ...apiDefinition } = userInput;

  let prompt = `You are an expert API designer. Given the following API definition, suggest improvements and return a complete, enhanced API definition in valid JSON. The JSON must have exactly the same top-level fields as the input. You can modify any field: protocol, method, urlPath, pathParams, queryParams, requestBody, responseBody, isAuthEnabled, authScheme, latency, rateLimit, headers, responseHeaders, cookies, expectedToken, expectedApiKey, includeAIResponse, statusCode. Use your best judgement to improve the API. Return ONLY valid JSON, no explanation.\n\n`;

  if (geminiInput && typeof geminiInput === 'string' && geminiInput.trim()) {
    prompt += `Additional instruction from the user: ${geminiInput}\n\n`;
  }
  prompt += `Input API definition:\n${JSON.stringify(apiDefinition, null, 2)}\n\nOutput (valid JSON only):`;

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: "application/json" }
  });

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  console.log('[AI] Raw Gemini response:', responseText);
  return JSON.parse(responseText);
}

async function ask_ai(req, res) {
  try {
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

    const userInput = req.body;
    console.log(`[ask-ai] geminiInput ------> ${req.body.geminiInput}`);
    if (!userInput || typeof userInput !== 'object') {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const cacheKey = getCacheKey(userInput);
    const ttl = parseInt(process.env.TTL_REVERSE_AI_RESPONSE, 10) || 120;
    await redisClient.setEx(cacheKey, ttl, JSON.stringify(userInput));

    const userType = isSubscribed ? 'subscribed user' : (isGuest ? 'guest' : 'unsubscribed user');
    console.log(`[ask-ai] ${userType} ${username || 'guest'} request`);

    let aiResponse;
    try {
      aiResponse = await withTimeout(callGemini(userInput), AI_TIMEOUT_MS);
    } catch (err) {
      if (err.message === 'AI_TIMEOUT') {
        console.warn('[ask-ai] Gemini call exceeded 70s timeout, returning default response.');
      } else if (err.status === 429) {
        console.warn('[ask-ai] Gemini quota exceeded, returning default response.');
      } else {
        console.error('[ask-ai] Gemini error:', err.status, err.message);
      }
      aiResponse = generateSampleResponse(userInput);
    }

    const finalResponse = buildFinalResponse(aiResponse, userInput);
    res.status(200).json(finalResponse);
  } catch (error) {
    console.error('[ask-ai] Unexpected error:', error);
    res.status(200).json(req.body);
  }
}

module.exports = {
  ask_ai
};