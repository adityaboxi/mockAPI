// bullmq-worker/utils/aiUtils.js
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
  return `ai:response:${hash}`;
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

module.exports = { getCacheKey, buildFinalResponse, generateSampleResponse };