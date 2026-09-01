require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const { Worker } = require('bullmq');
const { Groq } = require('groq-sdk');
const redis = require('redis');
const { redisClient, connectRedis } = require('../config/redis');
const { getCacheKey, buildFinalResponse, generateSampleResponse } = require('../utils/aiUtils');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis-external:6379';

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

const pubClient = redis.createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(Math.pow(2, retries) * 50 + Math.random() * 100, 3000),
  },
});
pubClient.on('error', (err) => console.error('[AI Worker] Pub/Client error:', err.message));

async function ensurePubClient() {
  if (!pubClient.isOpen) {
    await pubClient.connect().catch((err) => console.error('[AI Worker] Pub/Client connect error:', err.message));
  }
}
ensurePubClient();

function extractJSON(text) {
  if (!text) return null;
  // Match markdown json fence or raw bracketed json
  const jsonBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlock) return jsonBlock[1].trim();

  const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return match ? match[1].trim() : null;
}

/**
 * Executes Google Gemini API call with structured JSON output.
 */
async function callGeminiApi(prompt, apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return rawText;
}

const connectionOpts = {
  url: REDIS_URL,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const aiWorker = new Worker(
  'ai-queue',
  async (job) => {
    console.log(`[AI Worker] Job received: ${job.id}`);
    const { userInput, userId, cacheKey } = job.data;

    await ensurePubClient();

    // 1. Check cache
    try {
      await connectRedis();
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const result = JSON.parse(cached);
        if (pubClient.isOpen) {
          await pubClient.publish('ws:ai:response', JSON.stringify({ userId, jobId: job.id, response: result }));
        }
        return result;
      }
    } catch (_) {}

    // 2. Build precision prompt
    const { geminiInput, ...apiDefinition } = userInput || {};
    const expectedFields = [
      'protocol', 'method', 'urlPath', 'pathParams', 'queryParams',
      'requestBody', 'responseBody', 'isAuthEnabled', 'authScheme',
      'latency', 'rateLimit', 'headers', 'responseHeaders', 'cookies',
      'expectedToken', 'expectedApiKey', 'includeAIResponse', 'statusCode',
    ];

    let prompt = `You are a world-class API architect and mock data specialist.

**Task:** Design and construct a complete, production-grade mock API blueprint based on the user's requirements.

**Requirements:**
1. Output MUST be a **single valid JSON object** matching exactly these top-level fields:
   ${expectedFields.join(', ')}
2. Ensure realistic, industry-standard values:
   - "urlPath": clean RESTful path (e.g. /api/v1/users, /api/v1/orders/checkout).
   - "method": standard HTTP verb (GET, POST, PUT, DELETE, PATCH).
   - "statusCode": realistic HTTP code (200, 201, 204, etc.).
   - "requestBody" and "responseBody": realistic mock objects with sample data (realistic names, ISO timestamps, UUIDs, numbers, booleans) - NOT abstract type strings.
   - "headers": array of { "key": "Header-Name", "value": "Header-Value" }.
3. Do NOT include markdown code blocks, comments, or explanations. Only pure JSON.`;

    if (geminiInput && typeof geminiInput === 'string' && geminiInput.trim()) {
      prompt += `\n\n**User Prompt & Instructions:** ${geminiInput.trim()}`;
    }

    if (apiDefinition && Object.keys(apiDefinition).length > 0) {
      prompt += `\n\n**Base API Context:**\n${JSON.stringify(apiDefinition, null, 2)}`;
    }

    let parsedResponse = null;

    // 3. Provider Strategy: Gemini -> Groq -> Semantic Generator
    if (GEMINI_API_KEY) {
      try {
        console.log(`[AI Worker] Calling Gemini model: ${GEMINI_MODEL}`);
        const geminiText = await callGeminiApi(prompt, GEMINI_API_KEY, GEMINI_MODEL);
        const jsonStr = extractJSON(geminiText);
        if (jsonStr) {
          parsedResponse = JSON.parse(jsonStr);
          if (pubClient.isOpen) {
            await pubClient.publish('ws:ai:chunk', JSON.stringify({ userId, jobId: job.id, chunk: 'Generated blueprint via Gemini AI' }));
          }
        }
      } catch (geminiErr) {
        console.warn('[AI Worker] Gemini call failed, trying Groq fallback:', geminiErr.message);
      }
    }

    if (!parsedResponse && groq) {
      try {
        console.log(`[AI Worker] Calling Groq model: ${GROQ_MODEL}`);
        const stream = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: GROQ_MODEL,
          temperature: 0.7,
          stream: true,
        });

        let fullText = '';
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            fullText += text;
            if (pubClient.isOpen) {
              await pubClient.publish('ws:ai:chunk', JSON.stringify({ userId, jobId: job.id, chunk: text }));
            }
          }
        }

        const jsonString = extractJSON(fullText);
        if (jsonString) {
          parsedResponse = JSON.parse(jsonString);
        }
      } catch (groqErr) {
        console.warn('[AI Worker] Groq call failed:', groqErr.message);
      }
    }

    // 4. Semantic Fallback Engine if AI providers are offline/throttled
    if (!parsedResponse) {
      console.warn('[AI Worker] Using intelligent semantic fallback engine');
      parsedResponse = generateSampleResponse(userInput);
    }

    const finalResponse = buildFinalResponse(parsedResponse, userInput);

    // 5. Store in Redis Cache
    const ttl = parseInt(process.env.TTL_REVERSE_AI_RESPONSE, 10) || 180;
    try {
      await redisClient.setEx(cacheKey, ttl, JSON.stringify(finalResponse));
    } catch (_) {}

    // 6. Real-Time WebSocket Publish
    if (pubClient.isOpen) {
      await pubClient.publish('ws:ai:response', JSON.stringify({ userId, jobId: job.id, response: finalResponse }));
    }

    return finalResponse;
  },
  {
    connection: connectionOpts,
    concurrency: 10,
    timeout: 70000,
    limiter: { max: 60, duration: 60000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  }
);

aiWorker.on('completed', (job) => {
  console.log(`[AI Worker] Job ${job.id} completed.`);
});

aiWorker.on('failed', (job, err) => {
  console.error(`[AI Worker] Job ${job?.id} failed:`, err.message);
  if (job?.data?.userId && pubClient.isOpen) {
    pubClient.publish('ws:ai:error', JSON.stringify({ userId: job.data.userId, jobId: job.id, error: err.message }));
  }
});

module.exports = { aiWorker, pubClient };