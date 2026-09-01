require('./opentelemetry/universal-logger');  // <-- Add this line FIRST

const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const { faker } = require('@faker-js/faker');
const IORedis = require('ioredis');
const Router = require('find-my-way');

const app = express();

// Trust the first proxy (OpenResty gateway) to get real client IP
app.set('trust proxy', true);

// Global Middlewares
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(compression({
  level: 6,
  threshold: 1024,
}));

// ---------- Configuration ----------
const PROJECT_ID = process.env.PROJECT_ID;
if (!PROJECT_ID) {
  console.error('[project-container] ❌ PROJECT_ID environment variable is missing.');
  process.exit(1);
}
const PORT = process.env.PORT || 3000;

// ---------- Redis – lazy connect, graceful fallback ----------
const REDIS_URL = process.env.INTERNAL_REDIS_URL || process.env.REDIS_URL || 'redis://redis-internal:6379';

// Local fallback store for rate limiting if Redis is down
const localRateLimitStore = new Map();
let redisWasDown = false;

const redis = new IORedis(REDIS_URL, {
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 10) return null;
    return Math.min(times * 100, 5000);
  },
  enableReadyCheck: false,
  maxRetriesPerRequest: 0,
});

redis.on('error', (err) => {
  if (err.code === 'ENOTFOUND') {
    if (!redis._notfoundLogged) {
      console.warn('[Redis] Hostname not found – rate limiting falling back to in-memory store.');
      redis._notfoundLogged = true;
    }
    redisWasDown = true;
  } else {
    console.error('[Redis] Error:', err.message);
  }
});

function isRedisReady() {
  return redis.status === 'ready';
}

// ---------- Radix Tree Router (find-my-way) ----------
const router = Router({
  ignoreTrailingSlash: true,
  maxParamLength: 500,
});

const routeDefinitions = new Map();
const registeredKeys = new Set();

function getRouteKey(method, fullPath) {
  return `${method.toUpperCase()}:${fullPath}`;
}

function registerRoute(definition) {
  const methodUpper = (definition.method || 'GET').toUpperCase();
  const cleanPath = definition.urlPath.startsWith('/') ? definition.urlPath : `/${definition.urlPath}`;
  const fullPath = `/${definition.version}${cleanPath}`;
  const key = getRouteKey(methodUpper, fullPath);

  if (registeredKeys.has(key)) {
    const existing = routeDefinitions.get(key);
    if (existing && JSON.stringify(existing) === JSON.stringify(definition)) {
      return true;
    }
    try { router.off(methodUpper, fullPath); } catch (_) {}
    registeredKeys.delete(key);
    routeDefinitions.delete(key);
  }

  try {
    router.on(methodUpper, fullPath, () => {}, definition);
    routeDefinitions.set(key, definition);
    registeredKeys.add(key);
    return true;
  } catch (err) {
    console.error(`[router] ❌ Failed to register route ${methodUpper} ${fullPath}:`, err.message);
    return false;
  }
}

function unregisterRoute(method, fullPath) {
  const methodUpper = method.toUpperCase();
  const key = getRouteKey(methodUpper, fullPath);
  try {
    router.off(methodUpper, fullPath);
  } catch (_) {
    return false;
  }
  registeredKeys.delete(key);
  routeDefinitions.delete(key);
  return true;
}

// ---------- Rate Limiting (Redis with In-Memory Fallback) ----------
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

  if (isRedisReady()) {
    if (redisWasDown) {
      localRateLimitStore.clear();
      redisWasDown = false;
      console.log('[Redis] Connection restored – cleared local rate limit store.');
    }
    try {
      const [count, ttl] = await redis.eval(rateLimitScript, 1, redisKey, limit, windowSec);
      if (count > limit) {
        return {
          allowed: false,
          resetSeconds: Math.max(1, ttl),
          remaining: 0,
        };
      }
      return {
        allowed: true,
        remaining: Math.max(0, limit - count),
        resetSeconds: Math.max(1, ttl),
      };
    } catch (_) {
      redisWasDown = true;
    }
  }

  // Fallback: local in-memory sliding counter
  const localKey = `${PROJECT_ID}:${routeKey}:${clientId}`;
  const now = Date.now();
  const entry = localRateLimitStore.get(localKey) || { count: 0, resetTime: now + windowMs };

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
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.count),
    resetSeconds: Math.max(1, Math.ceil((entry.resetTime - now) / 1000)),
  };
}

// ---------- Faker Evaluation Helpers with Full Domain & Alias Mapping ----------
const fakerAliasMap = {
  'name.findName': 'person.fullName',
  'name.fullName': 'person.fullName',
  'name.firstName': 'person.firstName',
  'name.lastName': 'person.lastName',
  'name.jobTitle': 'person.jobTitle',
  'name.gender': 'person.gender',
  'name.prefix': 'person.prefix',
  'name.suffix': 'person.suffix',
  'address.city': 'location.city',
  'address.country': 'location.country',
  'address.streetAddress': 'location.streetAddress',
  'address.zipCode': 'location.zipCode',
  'address.state': 'location.state',
  'address.latitude': 'location.latitude',
  'address.longitude': 'location.longitude',
  'datatype.uuid': 'string.uuid',
  'datatype.number': 'number.int',
  'datatype.float': 'number.float',
  'datatype.string': 'string.sample',
  'company.companyName': 'company.name',
  'phone.phoneNumber': 'phone.number',
};

function resolveFakerFunction(expr) {
  let cleanExpr = expr.trim();
  if (cleanExpr.startsWith('faker.')) {
    cleanExpr = cleanExpr.slice(6);
  }

  let args = [];
  let funcPath = cleanExpr;
  const match = cleanExpr.match(/^([a-zA-Z0-9_.]+)\s*\((.*)\)\s*$/s);
  if (match) {
    funcPath = match[1].trim();
    let argStr = match[2].trim();
    if (argStr) {
      argStr = argStr.replace(/\\"/g, '"');
      try {
        const evalArg = new Function(`return [${argStr}];`);
        args = evalArg();
      } catch (_) {
        try {
          args = JSON.parse(`[${argStr}]`);
        } catch (_) {
          args = [argStr];
        }
      }
    }
  }

  if (fakerAliasMap[funcPath]) {
    funcPath = fakerAliasMap[funcPath];
  }

  const parts = funcPath.split('.');
  let current = faker;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (current && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }

  if (typeof current === 'function') {
    return () => current(...args);
  }
  return () => current;
}

function getFakerValue(expr) {
  try {
    const fn = resolveFakerFunction(expr);
    return fn ? fn() : null;
  } catch (err) {
    return null;
  }
}

function hasFakerTemplate(val) {
  if (typeof val === 'string') return /\{\{(?:faker\.)?[a-zA-Z0-9_.]+(?:\([^)]*\))?\}\}/.test(val);
  if (Array.isArray(val)) return val.some(hasFakerTemplate);
  if (val && typeof val === 'object') return Object.values(val).some(hasFakerTemplate);
  return false;
}

function generateFakeResponse(responseBody) {
  if (typeof responseBody === 'string') {
    // If the entire string is a single faker placeholder, preserve native types (number, boolean, object)
    const singleMatch = responseBody.trim().match(/^\{\{(?:faker\.)?([^}]+)\}\}$/);
    if (singleMatch) {
      const val = getFakerValue(singleMatch[1]);
      if (val !== null) return val;
    }

    return responseBody.replace(/\{\{(?:faker\.)?([^}]+)\}\}/g, (match, expr) => {
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

// ---------- Request Validation Helpers ----------
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
    if (definition.expectedToken && authHeader.slice(7).trim() !== definition.expectedToken.trim()) {
      return { ok: false, status: 401, error: 'Invalid Bearer token' };
    }
  } else if (['apikey', 'api-key', 'apikeyauth'].includes(scheme)) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey) return { ok: false, status: 401, error: 'Missing API Key' };
    if (definition.expectedApiKey && apiKey.trim() !== definition.expectedApiKey.trim()) {
      return { ok: false, status: 401, error: 'Invalid API Key' };
    }
  }

  // Validate custom request headers
  const expectedHeaders = definition.headers || [];
  for (const h of expectedHeaders) {
    if (!h || typeof h.key !== 'string' || !h.key.trim()) continue;
    if (h.key.toLowerCase() === 'authorization') continue;
    const incomingHeader = req.headers[h.key.toLowerCase()];
    if (incomingHeader !== h.value) {
      return { ok: false, status: 403, error: `Header validation failed: ${h.key}` };
    }
  }

  // Validate custom request cookies
  const expectedCookies = definition.cookies || [];
  for (const c of expectedCookies) {
    if (!c || typeof c.key !== 'string' || !c.key.trim()) continue;
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
      return 'responseBody exceeds 1MB limit';
    }
  }

  const arrayFields = ['queryParams', 'headers', 'responseHeaders', 'cookies', 'pathParams'];
  for (const field of arrayFields) {
    if (definition[field] !== undefined && !Array.isArray(definition[field])) {
      return `${field} must be an array`;
    }
  }

  if (definition.statusCode !== undefined) {
    const sc = Number(definition.statusCode);
    if (!Number.isInteger(sc) || sc < 100 || sc > 599) return 'statusCode must be between 100 and 599';
  }

  if (definition.latency !== undefined) {
    const lat = Number(definition.latency);
    if (!Number.isFinite(lat) || lat < 0) return 'latency must be non-negative';
  }

  if (definition.rateLimit !== undefined) {
    const rl = Number(definition.rateLimit);
    if (!Number.isFinite(rl) || rl < 0) return 'rateLimit must be non-negative';
  }

  return null;
}

// ---------- Internal Management Endpoints ----------
app.post('/internal/apis', (req, res) => {
  const { version, method, urlpath, definition } = req.body || {};
  if (!version || !method || !urlpath || !definition) {
    return res.status(400).json({ error: 'Fields required: version, method, urlpath, definition' });
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
    return res.status(500).json({ error: 'Failed to register route into Radix tree' });
  }

  res.status(201).json({ stored: `${version}:${method.toUpperCase()}:${urlpath}` });
});

app.delete('/internal/apis', (req, res) => {
  const { version, method, urlpath } = req.body || {};
  if (!version || !method || !urlpath) {
    return res.status(400).json({ error: 'Fields required: version, method, urlpath' });
  }

  const cleanPath = urlpath.startsWith('/') ? urlpath : `/${urlpath}`;
  const fullPath = `/${version}${cleanPath}`;
  const methodUpper = method.toUpperCase();
  const routeKey = getRouteKey(methodUpper, fullPath);

  if (!registeredKeys.has(routeKey)) {
    return res.json({ deleted: true, alreadyDeleted: true });
  }

  const removed = unregisterRoute(methodUpper, fullPath);
  if (!removed) return res.status(500).json({ error: 'Failed to remove route from router' });

  // Non-blocking cleanup of rate limit keys via SCAN stream
  if (isRedisReady()) {
    const stream = redis.scanStream({
      match: `rate:${PROJECT_ID}:${methodUpper}:${fullPath}:*`,
      count: 100,
    });
    stream.on('data', (keys) => {
      if (keys.length > 0) {
        redis.del(keys).catch(() => {});
      }
    });
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

// ---------- Health & Sync Endpoints ----------
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

// ---------- Main Mock Request Dispatcher ----------
app.all('*', async (req, res) => {
  const route = router.find(req.method, req.path);
  if (!route) {
    // Check if route exists under another HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    const otherMethods = methods.filter(m => m !== req.method && router.find(m, req.path));
    if (otherMethods.length > 0) {
      return res.status(405).json({
        error: `Method ${req.method} not allowed for ${req.path}`,
        configuredMethods: otherMethods,
        path: req.path,
        hint: `This mock route is registered with method: ${otherMethods.join(', ')}`
      });
    }

    return res.status(404).json({
      error: `No mock route configured for ${req.method} ${req.path}`,
      availableRoutes: registeredKeys.size,
      registeredRoutes: Array.from(registeredKeys).slice(0, 20),
    });
  }

  const definition = route.store;
  const params = route.params || {};

  const isAiEnabled = Boolean(definition.airesponse ?? definition.aiResponse);
  const rawResponse = definition.responseBody ?? { ok: true };
  const hasFaker = hasFakerTemplate(rawResponse);
  const isDynamic = isAiEnabled || hasFaker;

  // Dynamic Caching Headers (Cache static responses for 5m; bypass only if dynamic faker templates exist)
  if (!hasFaker && (req.method === 'GET' || req.method === 'HEAD')) {
    res.set('X-Accel-Expires', '300');
    res.set('Cache-Control', 'public, max-age=300');
  } else {
    res.set('X-Accel-Expires', '0');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }

  // Rate Limiting Check
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

  // Accurate Latency Simulation (honors full configured latency up to 30s)
  const configuredLatency = Number(definition.latency) || 0;
  const effectiveLatency = Math.min(Math.max(0, configuredLatency), 30000);
  if (effectiveLatency > 0) {
    res.set('X-Latency', String(effectiveLatency));
  }

  req.params = params;

  // Validation Phase
  const qv = validateQueryParams(req, definition);
  if (!qv.ok) return res.status(400).json({ error: qv.error });

  if (!['GET', 'HEAD', 'DELETE'].includes(req.method)) {
    const rv = validateRequestBody(req, definition);
    if (!rv.ok) return res.status(400).json({ error: rv.error });
  }

  const av = validateAuth(req, definition);
  if (!av.ok) return res.status(av.status || 401).json({ error: av.error });

  // Payload Generation (Dynamic Faker on every request if template or AI is enabled)
  const finalBody = (isAiEnabled || hasFaker)
    ? generateFakeResponse(rawResponse)
    : rawResponse;

  // Custom Response Headers & CRLF Protection
  const outboundHeaders = definition.responseHeaders || [];
  outboundHeaders.forEach(({ key, value }) => {
    if (key && value != null) {
      const sanitizedKey = String(key).replace(/[\r\n]/g, '').trim();
      const sanitizedVal = String(value).replace(/[\r\n]/g, '').trim();
      if (sanitizedKey) res.set(sanitizedKey, sanitizedVal);
    }
  });

  // Outbound Cookies
  const outboundCookies = definition.cookies || [];
  outboundCookies.forEach(({ key, value = '', options = {} }) => {
    if (!key) return;
    const cookieOptions = {
      httpOnly: options.httpOnly !== false,
      path: options.path || '/',
      ...(options.domain && { domain: options.domain }),
      ...(options.secure && { secure: true }),
      ...(options.sameSite && { sameSite: options.sameSite }),
      ...(options.maxAge && { maxAge: Number(options.maxAge) * 1000 }),
    };
    res.cookie(key, String(value), cookieOptions);
  });

  if (effectiveLatency > 0) {
    await new Promise((resolve) => setTimeout(resolve, effectiveLatency));
  }

  const statusCode = Number(definition.statusCode) || 200;
  res.status(statusCode).json(finalBody);
});

// ---------- Global Error Handler ----------
app.use((err, req, res, next) => {
  console.error('[project-container] ❌ Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal mock server error' });
});

// ---------- Server Startup & Graceful Shutdown ----------
const server = app.listen(PORT, () => {
  console.log(`[project-container] 🚀 Running on port ${PORT} for project ${PROJECT_ID}`);
});

async function shutdown() {
  console.log('[project-container] 🛑 Shutting down gracefully...');
  if (isRedisReady()) {
    await redis.quit().catch(() => {});
  }
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);