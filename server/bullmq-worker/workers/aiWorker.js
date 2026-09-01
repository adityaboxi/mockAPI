// bullmq-worker/workers/aiWorker.js
require('../opentelemetry/universal-logger');  // <-- Add this line FIRST
const { Worker } = require('bullmq');
const { Groq } = require('groq-sdk');
const { redisClient } = require('../config/redis');
const { getCacheKey, buildFinalResponse, generateSampleResponse } = require('../utils/aiUtils');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error('[AI Worker] GROQ_API_KEY is not set');
  process.exit(1);
}

const groq = new Groq({ apiKey: GROQ_API_KEY });
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const connection = { connection: { url: process.env.REDIS_URL } };

const pubClient = redisClient.duplicate();
pubClient.connect().catch(err => console.error('[AI Worker] Pub/Client connect error:', err));

function extractJSON(text) {
  const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return match ? match[1] : null;
}

const aiWorker = new Worker('ai-queue', async (job) => {
  console.log(`[AI Worker] 🔥 Job received: ${job.id}`);

  const { userInput, userId, cacheKey } = job.data;
  console.log('[AI Worker] userId:', userId, 'cacheKey:', cacheKey);

  // 1. Check cache
  console.log('[AI Worker] Checking Redis cache...');
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    console.log('[AI Worker] ✅ Cache hit!');
    const result = JSON.parse(cached);
    await pubClient.publish('ws:ai:response', JSON.stringify({ userId, jobId: job.id, response: result }));
    console.log('[AI Worker] Published cached response to Redis Pub/Sub.');
    return result;
  }
  console.log('[AI Worker] Cache miss.');

  // 2. Build the improved prompt (with realistic mock data instruction)
  const { geminiInput, ...apiDefinition } = userInput;

  // Define the expected top-level fields explicitly
  const expectedFields = [
    'protocol', 'method', 'urlPath', 'pathParams', 'queryParams',
    'requestBody', 'responseBody', 'isAuthEnabled', 'authScheme',
    'latency', 'rateLimit', 'headers', 'responseHeaders', 'cookies',
    'expectedToken', 'expectedApiKey', 'includeAIResponse', 'statusCode'
  ];

  let prompt = `You are an expert API designer and a master of generating realistic mock data.

**Task:** Improve the given API definition and generate **realistic example data** for the request and response bodies.

**Instructions:**
- Return a **complete, enhanced API definition** as a **valid JSON object**.
- The JSON must contain **exactly** the following top-level fields (all are required): ${expectedFields.join(', ')}.
- You may change any field values to improve the API (e.g., change the method, add path parameters, modify request/response bodies, adjust latency/rate limit, etc.).
- **CRITICAL for "requestBody" and "responseBody"**:
  - Do NOT use type definitions like "string", "integer", "boolean".
  - Instead, generate **realistic example values** that look like actual data.
  - For names: use "Alex Smith", "John Doe", "Jane Miller".
  - For emails: use "alex@example.com", "john@company.com", "jane.miller@test.org".
  - For IDs/UUIDs: use "550e8400-e29b-41d4-a716-446655440000" or "USR-12345".
  - For dates: use "2025-01-15T10:30:00Z" or "2025-03-20".
  - For phone numbers: use "+1-555-123-4567", "+44-20-7946-0958".
  - For addresses: use "123 Main St, Anytown, USA".
  - Use realistic city names, company names, product names, etc.
- If the user provides additional instructions in the "geminiInput" field, follow them.
- **IMPORTANT**: Output **ONLY** the JSON object – no explanations, no markdown, no code fences. The response must be valid JSON and nothing else.

**Example of a valid JSON output (notice realistic mock data in requestBody and responseBody):**
{
  "protocol": "https",
  "method": "POST",
  "urlPath": "/api/v2/users",
  "pathParams": [],
  "queryParams": [{ "key": "limit", "value": "20" }],
  "requestBody": {
    "name": "Alice Johnson",
    "email": "alice.johnson@example.com",
    "phone": "+1-202-555-0199",
    "role": "admin"
  },
  "responseBody": {
    "id": "usr_7b2c9d4e-1234-5678-9abc-def012345678",
    "name": "Alice Johnson",
    "email": "alice.johnson@example.com",
    "phone": "+1-202-555-0199",
    "role": "admin",
    "createdAt": "2025-01-15T12:34:56Z"
  },
  "isAuthEnabled": true,
  "authScheme": "BearerAuth",
  "latency": 150,
  "rateLimit": 20,
  "headers": [{ "key": "Content-Type", "value": "application/json" }],
  "responseHeaders": [{ "key": "X-Rate-Limit", "value": "20" }],
  "cookies": [{ "key": "session", "value": "abc123xyz789", "options": { "httpOnly": true, "secure": false, "sameSite": "Lax" } }],
  "expectedToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expectedApiKey": "",
  "includeAIResponse": true,
  "statusCode": 201
}`;

  if (geminiInput && typeof geminiInput === 'string' && geminiInput.trim()) {
    prompt += `\n\n**User's additional instruction:** ${geminiInput}`;
  }

  prompt += `\n\n**Input API definition:**\n${JSON.stringify(apiDefinition, null, 2)}\n\n**Your output (only JSON):**`;

  console.log('[AI Worker] Prompt built. Length:', prompt.length);

  try {
    // 3. Call Groq
    console.log('[AI Worker] Calling Groq API...');
    const stream = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: GROQ_MODEL,
      temperature: 0.7,
      stream: true,
    });
    console.log('[AI Worker] Groq stream started.');

    let fullText = '';
    let chunkCount = 0;
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullText += text;
        chunkCount++;
        if (chunkCount % 10 === 0) {
          console.log(`[AI Worker] Received ${chunkCount} chunks.`);
        }
        await pubClient.publish('ws:ai:chunk', JSON.stringify({ userId, jobId: job.id, chunk: text }));
      }
    }
    console.log(`[AI Worker] Stream complete. Total chunks: ${chunkCount}. Full text length: ${fullText.length}`);

    // 4. Extract & parse JSON
    console.log('[AI Worker] Extracting JSON...');
    const jsonString = extractJSON(fullText);
    if (!jsonString) {
      console.error('[AI Worker] No JSON found in response. Raw (first 300 chars):', fullText.slice(0, 300));
      throw new Error('No JSON found in Groq response');
    }
    console.log('[AI Worker] Extracted JSON length:', jsonString.length);

    let aiResponse;
    try {
      aiResponse = JSON.parse(jsonString);
      console.log('[AI Worker] ✅ Parsed JSON successfully.');
    } catch (parseErr) {
      console.error('[AI Worker] JSON parse error:', parseErr.message);
      console.error('[AI Worker] Raw JSON string (first 300 chars):', jsonString.slice(0, 300));
      throw new Error('Invalid JSON from Groq');
    }

    // 5. Build final response (merges with user input)
    console.log('[AI Worker] Building final response...');
    const finalResponse = buildFinalResponse(aiResponse, userInput);

    // 6. Cache
    const ttl = parseInt(process.env.TTL_REVERSE_AI_RESPONSE, 10) || 120;
    await redisClient.setEx(cacheKey, ttl, JSON.stringify(finalResponse));
    console.log('[AI Worker] Cached response.');

    // 7. Publish final response
    console.log('[AI Worker] Publishing final response to Redis Pub/Sub...');
    await pubClient.publish('ws:ai:response', JSON.stringify({ userId, jobId: job.id, response: finalResponse }));
    console.log('[AI Worker] ✅ Done.');

    return finalResponse;

  } catch (error) {
    console.error('[AI Worker] ❌ Groq error:', error.message);
    if (error.stack) console.error('[AI Worker] Stack:', error.stack);
    const fallback = generateSampleResponse(userInput);
    const finalResponse = buildFinalResponse(fallback, userInput);
    await pubClient.publish('ws:ai:error', JSON.stringify({ userId, jobId: job.id, error: error.message }));
    await pubClient.publish('ws:ai:response', JSON.stringify({ userId, jobId: job.id, response: finalResponse, fallback: true }));
    console.log('[AI Worker] Published fallback response.');
    return finalResponse;
  }
}, {
  ...connection,
  concurrency: 5,
  timeout: 70000,
  limiter: { max: 30, duration: 60000 },
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 86400 },
});

aiWorker.on('completed', (job) => {
  console.log(`[AI Worker] ✅ Job ${job.id} completed.`);
});

aiWorker.on('failed', (job, err) => {
  console.error(`[AI Worker] ❌ Job ${job.id} failed:`, err.message);
  const userId = job.data.userId;
  pubClient.publish('ws:ai:error', JSON.stringify({ userId, jobId: job.id, error: err.message }));
});

module.exports = aiWorker;