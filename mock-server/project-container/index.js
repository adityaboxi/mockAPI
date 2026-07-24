const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const { faker } = require('@faker-js/faker');
const IORedis = require('ioredis');
const Router = require('find-my-way');

const app = express();

// Trust the first proxy.   (OpenResty) to get real client IP
app.set('trust proxy', true);

// Compressionnn
app.use(express.json());
app.use(cookieParser());
app.use(compression({
  level: 6,
  threshold: 1024,
}));

// ---------- Configuration ----------
const PROJECT_ID = process.env.PROJECT_ID;
if (!PROJECT_ID) {
  process.exit(1);
}
const PORT = process.env.PORT || 3000;

// ---------- Redis – lazy connect, graceful fallback ----------
const REDIS_URL = process.env.INTERNAL_REDIS_URL || process.env.REDIS_URL || 'redis://redis-internal:6379';

// Local fallback for rate limiting (if Redis is down)
const localRateLimitStore = new Map();
let redisWasDown = false; // tracks if Redis was previously unavailable

const redis = new IORedis(REDIS_URL, {
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 10) {
      return null; // stop retrying after 10 attempts
    }
    return Math.min(times * 100, 5000);
  },
  enableReadyCheck: false,
  maxRetriesPerRequest: 0,
});
redis.on('error', (err) => {
  if (err.code === 'ENOTFOUND') {
    if (!redis._notfoundLogged) {
      console.warn('[Redis] Hostname not found – rate limiting disabled until Redis becomes available.');
      redis._notfoundLogged = true;
    }
    redisWasDown = true;
  } else {
    console.error('[Redis] Error:', err);
  }
});

// Helper to check if Redis is ready
function isRedisReady() {
  return redis.status === 'ready';
}

// ---------- Radix Tree Router ----------
const router = Router({
  ignoreTrailingSlash: true,
  maxParamLength: 500,
});

const routeDefinitions = new Map();
const registeredKeys = new Set();

function getRouteKey(method, fullPath) {
  return `${method}:${fullPath}`;
}

function registerRoute(definition) {
  const fullPath = `/${definition.version}${definition.urlPath}`;
  const key = getRouteKey(definition.method, fullPath);

  if (registeredKeys.has(key)) {
    const existing = routeDefinitions.get(key);
    if (existing && JSON.stringify(existing) === JSON.stringify(definition)) {
      return true;
    }
  }

  try {
    router.on(definition.method, fullPath, () => {}, definition);
  } catch (_) {
    return false;
  }

  routeDefinitions.set(key, definition);
  registeredKeys.add(key);
  return true;
}

function unregisterRoute(method, fullPath) {
  const key = getRouteKey(method, fullPath);
  try {
    router.off(method, fullPath);
  } catch (_) {
    return false;
  }
  registeredKeys.delete(key);
  routeDefinitions.delete(key);
  return true;
}

// ---------- Rate Limiting (Redis or local fallback) ----------
const rateLimitScript = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  if limit == nil or window == nil then
    return redis.error_reply("Invalid arguments")
  end
  local current = redis.call('INCR', key)
  if current == 1 then
    redis.call('EXPIRE', key, window)
  end
  local ttl = redis.call('TTL', key)
  return {current, ttl}
`;

async function checkRateLimit(routeKey, clientId, limit, windowMs = 60000) {
  if (!limit || limit <= 0) return { allowed: true };

  const redisKey = `rate:${PROJECT_ID}:${routeKey}:${clientId}`;
  const windowSec = Math.ceil(windowMs / 1000);

  // If Redis is ready, use it
  if (isRedisReady()) {
    // If Redis was previously down, clear the local store and reset the flag
    if (redisWasDown) {
      localRateLimitStore.clear();
      redisWasDown = false;
      console.log('[Redis] Connection restored – cleared local fallback store.');
    }
    try {
      const [count, ttl] = await redis.eval(rateLimitScript, 1, redisKey, limit, windowSec);
      if (count > limit) {
        return {
          allowed: false,
          resetSeconds: Math.max(1, ttl),
          remaining: 0
        };
      }
      return {
        allowed: true,
        remaining: limit - count,
        resetSeconds: Math.max(1, ttl)
      };
    } catch (_) {
      // fallback to local if Redis fails (rare)
      redisWasDown = true;
    }
  }

  // Fallback: local in‑memory rate limiter (per‑instance, not distributed)
  const localKey = `${PROJECT_ID}:${routeKey}:${clientId}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  const entry = localRateLimitStore.get(localKey) || { count: 0, resetTime: now + windowMs };
  // Reset if window expired
  if (now > entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + windowMs;
  }
  entry.count++;
  localRateLimitStore.set(localKey, entry);
  if (entry.count > limit) {
    return {
      allowed: false,
      resetSeconds: Math.max(1, Math.ceil((entry.resetTime - now) / 1000)),
      remaining: 0
    };
  }
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetSeconds: Math.max(1, Math.ceil((entry.resetTime - now) / 1000))
  };
}

// ---------- Faker Helpers ----------
const fakerCache = new Map();
const MAX_FAKER_CACHE = 200;

function trimFakerCache() {
  if (fakerCache.size >= MAX_FAKER_CACHE) {
    fakerCache.clear();
  }
}

function getFakerValue(path) {
  if (fakerCache.has(path)) return fakerCache.get(path)();

  try {
    const parts = path.split('.');
    let current = faker;
    let lastPart = parts[parts.length - 1];
    let funcName = lastPart;
    let args = [];

    const match = lastPart.match(/^(\w+)\(([^)]*)\)$/);
    if (match) {
      funcName = match[1];
      const argStr = match[2].trim();
      if (argStr) {
        try {
          const parsed = JSON.parse(`[${argStr}]`);
          if (Array.isArray(parsed)) args = parsed;
        } catch (_) { args = []; }
      }
    }

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current && part in current) current = current[part];
      else return null;
    }

    const resultFn = () => {
      if (typeof current[funcName] === 'function') return current[funcName](...args);
      return current[funcName];
    };

    trimFakerCache();
    fakerCache.set(path, resultFn);
    return resultFn();
  } catch (_) {
    return null;
  }
}

function generateFakeResponse(responseBody) {
  if (typeof responseBody === 'string') {
    return responseBody.replace(/\{\{faker\.([^}]+)\}\}/g, (match, expr) => {
      const resolved = getFakerValue(expr.trim());
      return resolved !== null ? String(resolved) : match;
    });
  }
  if (Array.isArray(responseBody)) {
    return responseBody.map((item) => generateFakeResponse(item));
  }
  if (typeof responseBody === 'object' && responseBody !== null) {
    const newObj = {};
    for (const [key, value] of Object.entries(responseBody)) {
      newObj[key] = generateFakeResponse(value);
    }
    return newObj;
  }
  return responseBody;
}

// ---------- Validation Helpers (unchanged) ----------
function validateQueryParams(req, definition) {
  const queryParams = definition.queryParams || [];
  for (const qp of queryParams) {
    if (!qp || !qp.key) continue;
    const isRequired = qp.required !== false;
    const value = req.query[qp.key];
    if (isRequired && (value === undefined || value === '')) {
      return { ok: false, error: `Missing required query parameter: ${qp.key}` };
    }
  }
  return { ok: true };
}

function validateRequestBody(req, definition) {
  const expectedFields = definition.requestBody;
  if (!expectedFields) return { ok: true };
  const method = (definition.method || req.method || '').toUpperCase();
  if (['GET', 'HEAD', 'DELETE'].includes(method)) return { ok: true };

  const isExpectedObject =
    typeof expectedFields === 'object' && expectedFields !== null && !Array.isArray(expectedFields);
  if (!isExpectedObject) return { ok: true };

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Request body must be a valid JSON object' };
  }
  const missingKeys = Object.keys(expectedFields).filter((k) => !(k in body));
  if (missingKeys.length > 0) {
    return { ok: false, error: `Missing required fields: ${missingKeys.join(', ')}` };
  }
  return { ok: true };
}

function validateAuth(req, definition) {
  if (!definition.isAuthEnabled) return { ok: true };
  const scheme = (definition.authScheme || '').toLowerCase();

  if (['bearer', 'jwt', 'bearerauth'].includes(scheme)) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { ok: false, status: 401, error: 'Missing or malformed Bearer token' };
    }
    if (authHeader.slice(7) !== definition.expectedToken) {
      return { ok: false, status: 401, error: 'Invalid Bearer token' };
    }
  } else if (['apikey', 'api-key', 'apikeyauth'].includes(scheme)) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey) return { ok: false, status: 401, error: 'Missing API Key' };
    if (apiKey !== definition.expectedApiKey) {
      return { ok: false, status: 401, error: 'Invalid API Key' };
    }
  }

  const expectedHeaders = definition.headers || [];
  for (const h of expectedHeaders) {
    if (!h || typeof h.key !== 'string') continue;
    if (h.key.toLowerCase() === 'authorization') continue;
    const incomingHeader = req.headers[h.key.toLowerCase()];
    if (incomingHeader !== h.value) {
      return { ok: false, status: 403, error: `Header validation failed: ${h.key}` };
    }
  }

  const expectedCookies = definition.cookies || [];
  for (const c of expectedCookies) {
    if (!c || typeof c.key !== 'string') continue;
    if (req.cookies[c.key] !== c.value) {
      return { ok: false, status: 403, error: `Cookie validation failed: ${c.key}` };
    }
  }
  return { ok: true };
}

function sanitizeDefinition(definition) {
  if (!definition || typeof definition !== 'object') return 'definition must be an object';
  const body = definition.responseBody;
  if (body !== undefined && body !== null) {
    const str = JSON.stringify(body);
    if (Buffer.byteLength(str, 'utf8') > 1_000_000) {
      return 'responseBody exceeds 1MB';
    }
    function getDepth(obj, depth = 0) {
      if (depth > 20) return depth;
      if (Array.isArray(obj)) {
        return obj.reduce((max, item) => Math.max(max, getDepth(item, depth + 1)), 0);
      }
      if (obj && typeof obj === 'object') {
        return Object.values(obj).reduce((max, val) => Math.max(max, getDepth(val, depth + 1)), 0);
      }
      return depth;
    }
    if (getDepth(body) > 20) return 'responseBody exceeds nesting depth of 20';
  }

  const arrayFields = ['queryParams', 'headers', 'responseHeaders', 'cookies', 'pathParams'];
  for (const field of arrayFields) {
    if (definition[field] !== undefined && !Array.isArray(definition[field])) {
      return `${field} must be an array`;
    }
    for (const entry of definition[field] || []) {
      if (entry && entry.key !== undefined && typeof entry.key !== 'string') {
        return `${field} entries must have a string "key"`;
      }
    }
  }

  if (definition.statusCode !== undefined) {
    const sc = Number(definition.statusCode);
    if (!Number.isInteger(sc) || sc < 100 || sc > 599) return 'statusCode must be 100-599';
  }

  
  if (definition.latency !== undefined) {
    const lat = Number(definition.latency);
    if (!Number.isFinite(lat) || lat < 0) return 'latency must be non‑negative';
  }

  if (definition.rateLimit !== undefined) {
    const rl = Number(definition.rateLimit);
    if (!Number.isFinite(rl) || rl < 0) return 'rateLimit must be non‑negative';
  }

  if (definition.isAuthEnabled) {
    const scheme = (definition.authScheme || '').toLowerCase();
    const knownSchemes = ['bearer', 'jwt', 'bearerauth', 'apikey', 'api-key', 'apikeyauth'];
    if (!knownSchemes.includes(scheme)) {
      return `Unrecognized authScheme "${definition.authScheme}"`;
    }
  }
  return null;
}

// ---------- Internal API Endpoints ----------
app.post('/internal/apis', (req, res) => {
  const { version, method, urlpath, definition } = req.body || {};
  if (!version || !method || !urlpath || !definition) {
    return res.status(400).json({ error: 'Fields: version, method, urlpath, definition are required' });
  }

  const err = sanitizeDefinition(definition);
  if (err) return res.status(400).json({ error: `Invalid definition: ${err}` });

  const newVersion = {
    ...definition,
    method: method.toUpperCase(),
    urlPath: urlpath,
    version,
  };

  if (!registerRoute(newVersion)) {
    return res.status(500).json({ error: 'Failed to register route' });
  }

  trimFakerCache();
  res.status(201).json({ stored: `${version}:${method.toUpperCase()}:${urlpath}` });
});

app.delete('/internal/apis', (req, res) => {
  const { version, method, urlpath } = req.body || {};
  if (!version || !method || !urlpath) {
    return res.status(400).json({ error: 'Fields: version, method, urlpath are required' });
  }

  const fullPath = `/${version}${urlpath}`;
  const methodUpper = method.toUpperCase();
  const routeKey = getRouteKey(methodUpper, fullPath);

  if (!registeredKeys.has(routeKey)) {
    return res.json({ deleted: true, alreadyDeleted: true });
  }

  const removed = unregisterRoute(methodUpper, fullPath);
  if (!removed) return res.status(500).json({ error: 'Failed to remove route from router' });

  // Clean up rate-limit keys (only if Redis is ready)
  if (isRedisReady()) {
    redis.keys(`rate:${PROJECT_ID}:${methodUpper}:${fullPath}:*`).then(keys => {
      if (keys.length > 0) redis.del(...keys).catch(() => {});
    }).catch(() => {});
  }

  res.json({ deleted: true, routeKey });
});

app.get('/internal/apis', (req, res) => {
  const routes = [];
  for (const [key, definition] of routeDefinitions) {
    routes.push({
      key,
      method: definition.method,
      version: definition.version,
      urlPath: definition.urlPath,
      definition,
    });
  }
  res.json(routes);
});

// ---------- Health & Sync ----------
app.get('/health', (req, res) => res.json({
  status: 'OK',
  routes: registeredKeys.size,
  uptime: process.uptime(),
  project: PROJECT_ID,
}));

app.get('/healthz', (req, res) => res.json({ status: 'OK' }));

app.post('/internal/sync', (req, res) => {
  res.json({ synced: true, loaded: registeredKeys.size });
});

// ---------- Main Request Handler ----------
app.all('*', async (req, res) => {
  const route = router.find(req.method, req.path);
  if (!route) {
    return res.status(404).json({ error: `No mock route matches ${req.method} ${req.path}` });
  }

  const definition = route.store;
  const params = route.params || {};

  // Caching headers
  if (definition.aiResponse === false && (req.method === 'GET' || req.method === 'HEAD')) {
    res.set('X-Accel-Expires', '600');
    res.set('Cache-Control', 'public, max-age=600');
  } else {
    res.set('X-Accel-Expires', '0');
    res.set('Cache-Control', 'no-store, private');
  }

  const routeKey = `${req.method}:${req.path}`;
  const clientIp = req.ip || req.connection.remoteAddress;
  const rateResult = await checkRateLimit(routeKey, clientIp, definition.rateLimit, 60000);
  if (!rateResult.allowed) {
    res.set('Retry-After', String(rateResult.resetSeconds));
    return res.status(429).json({
      error: 'Rate limit exceeded',
      resetAfterSeconds: rateResult.resetSeconds,
      remaining: 0,
    });
  }

  // Latency simulation
  const configuredLatency = definition.latency || 0;
  const effectiveLatency = Math.max(0, configuredLatency - 300);
  if (effectiveLatency > 0) {
    res.set('X-Latency', String(Math.min(effectiveLatency, 30000)));
  }

  req.params = params;

  const qv = validateQueryParams(req, definition);
  if (!qv.ok) return res.status(400).json({ error: qv.error });

  if (!['GET', 'HEAD', 'DELETE'].includes(req.method)) {
    const rv = validateRequestBody(req, definition);
    if (!rv.ok) return res.status(400).json({ error: rv.error });
  }

  const av = validateAuth(req, definition);
  if (!av.ok) return res.status(av.status || 401).json({ error: av.error });

  const finalBody = definition.airesponse
    ? generateFakeResponse(definition.responseBody ?? { ok: true })
    : (definition.responseBody ?? { ok: true });

  const outboundHeaders = definition.responseHeaders || [];
  const outboundCookies = definition.cookies || [];
  const statusCode = definition.statusCode || 200;

  outboundHeaders.forEach(({ key, value }) => {
    if (key && value != null) res.set(key, String(value));
  });

  outboundCookies.forEach(({ key, value = '', options = {} }) => {
    if (!key) return;
    res.cookie(key, value, {
      httpOnly: options.httpOnly !== false,
      path: options.path || '/',
      ...(options.domain && { domain: options.domain }),
      ...(options.secure && { secure: true }),
      ...(options.sameSite && { sameSite: options.sameSite }),
      ...(options.maxAge && { maxAge: Number(options.maxAge) }),
    });
  });

  if (effectiveLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, effectiveLatency));
  }

  res.status(statusCode).json(finalBody);
});

// ---------- Error Handler ----------
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Internal server error' });
});

// ---------- Startup ----------
app.listen(PORT, () => {});

process.on('SIGTERM', async () => {
  if (isRedisReady()) {
    await redis.quit();
  }
  process.exit(0);
});