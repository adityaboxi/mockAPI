// telemetry-server/server/index.js - High-Performance Telemetry & Trace Server
const express = require('express');
const session = require('express-session');
const { createClient } = require('redis');
const connectRedis = require('connect-redis');
const RedisStore = connectRedis.RedisStore || connectRedis.default || connectRedis;
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const signature = require('cookie-signature');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const { Server } = require('socket.io');

const app = express();

// High-speed HTTP compression for all telemetry JSON responses
app.use(compression({ threshold: 1024 }));

// ─── Environment Configuration ────────────────────────────────
const PORT = process.env.PORT || 3003;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-in-production';
const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-change-me';
const DASHBOARD_USER = process.env.DASHBOARD_USER || 'admin';
const DASHBOARD_PASS = process.env.DASHBOARD_PASS || 'password';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:8083';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// ─── Redis Client & Reconnect Resilience ───────────────────────
const redisClient = createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      const delay = Math.min(retries * 100, 3000) + Math.random() * 200;
      return delay;
    },
  },
});

redisClient.on('error', (err) => console.error('[Telemetry Redis] Error:', err.message));
redisClient.on('connect', () => console.log('[Telemetry Redis] Connected'));
redisClient.on('reconnecting', () => console.log('[Telemetry Redis] Reconnecting...'));

// ─── Session Store ────────────────────────────────────────────
const sessionStore = new RedisStore({ client: redisClient, prefix: 'sess:' });

app.use(cookieParser());
const sessionParser = session({
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
});

app.use(sessionParser);

// ─── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin: CLIENT_ORIGIN === '*' ? true : [CLIENT_ORIGIN, 'http://localhost:8083', 'http://localhost:5173'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsers (High Limit for Batch Telemetry) ────────────
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ─── Memory Storage ───────────────────────────────────────────
let logs = [];
let traces = [];
const MAX_LOGS = 10000;
const MAX_TRACES = 2000;

// ─── JWT Helpers ──────────────────────────────────────────────
function generateToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ─── Routes: Public & Ingestion ───────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    logs: logs.length,
    traces: traces.length,
    timestamp: Date.now(),
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'MockAPI Telemetry & Observability Server',
    endpoints: {
      health: '/health',
      logs: '/logs (auth)',
      traces: '/traces (auth)',
      ingest: '/ingest',
      otlpLogs: '/v1/logs',
      otlpTraces: '/v1/traces',
    },
  });
});

app.get('/check-auth', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded) {
      return res.json({ authenticated: true, method: 'jwt', user: decoded.username });
    }
  }
  if (req.session?.user) {
    return res.json({ authenticated: true, method: 'session', user: req.session.user.username });
  }
  res.status(401).json({ authenticated: false, error: 'Unauthorized' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (username === DASHBOARD_USER && password === DASHBOARD_PASS) {
    const token = generateToken(username);
    if (req.session) {
      req.session.user = { username };
    }
    console.log(`[AUTH] ✅ Dashboard JWT login: ${username}`);
    return res.json({ success: true, token, user: { username } });
  } else {
    console.warn(`[AUTH] ❌ Failed login attempt: ${username}`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[AUTH] Session destroy error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// ─── Real-Time Container & Edge Telemetry Store ──────────────
const containerMetrics = new Map();
const edgeMetrics = new Map();

// Helper to sanitize node IDs
function normalizeNodeId(rawId) {
  if (!rawId) return 'unknown';
  const clean = String(rawId).toLowerCase().trim().replace(/^\//, '');
  if (clean.includes('client-1') || clean === 'react-app-1') return 'client-1';
  if (clean.includes('client-2') || clean === 'react-app-2') return 'client-2';
  if (clean.includes('nginx-client') || clean === 'mockapi-client') return 'nginx-client';
  if (clean.includes('server-1') || clean === 'mockapi-app') return 'server-1';
  if (clean.includes('server-2') || clean === 'mockapi-app-2') return 'server-2';
  if (clean.includes('nginx-server') || clean === 'mockapi-nginx') return 'nginx-server';
  if (clean.includes('bull') || clean === 'bullmq-worker') return 'bull-server';
  if (clean.includes('worker-server')) return 'worker-server';
  if (clean.includes('worker-logs')) return 'worker-logs';
  if (clean.includes('worker-health')) return 'worker-health';
  if (clean.includes('openresty')) return 'openresty-nginx uses lua';
  if (clean === 'redis-external') return 'redis-external';
  if (clean === 'redis-internal') return 'internal redis';
  if (clean === 'telemetry-server') return 'server';
  if (clean === 'telemetry-client') return 'client';
  if (clean === 'telemetry-redis') return 'redis';
  if (clean.startsWith('proj-pool')) return 'new project';
  if (clean === 'proj-adiisme_xnidif') return 'project1';
  if (clean === 'proj-adiisme_shih') return 'project2';
  if (clean.startsWith('proj-') || clean.includes('project')) return clean.replace('proj-', 'project');
  return rawId;
}

// ─── Real Docker API Client (over Unix Socket) ───────────────
function fetchDockerJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      socketPath: '/var/run/docker.sock',
      path,
      method: 'GET',
      timeout: 2500,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Docker socket timeout'));
    });
    req.end();
  });
}

async function pollRealDockerMetrics() {
  try {
    const containers = await fetchDockerJson('/containers/json');
    if (!Array.isArray(containers)) return;

    for (const c of containers) {
      const containerName = (c.Names && c.Names[0]) ? c.Names[0].replace(/^\//, '') : '';
      const nodeId = normalizeNodeId(containerName);
      if (!nodeId || nodeId === 'unknown') continue;

      try {
        const stats = await fetchDockerJson(`/containers/${c.Id}/stats?stream=false`);
        if (!stats || !stats.cpu_stats) continue;

        // Exact real CPU % calculation
        const cpuTotal = stats.cpu_stats.cpu_usage?.total_usage || 0;
        const preCpuTotal = stats.precpu_stats?.cpu_usage?.total_usage || 0;
        const sysTotal = stats.cpu_stats.system_cpu_usage || 0;
        const preSysTotal = stats.precpu_stats?.system_cpu_usage || 0;
        const onlineCpus = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage?.percpu_usage?.length || 1;

        const cpuDelta = cpuTotal - preCpuTotal;
        const sysDelta = sysTotal - preSysTotal;

        let realCpuPercent = 0;
        if (sysDelta > 0 && cpuDelta > 0) {
          realCpuPercent = Math.round(((cpuDelta / sysDelta) * onlineCpus * 100) * 100) / 100;
        }

        // Exact real RAM calculation
        const memUsage = stats.memory_stats?.usage || 0;
        const memLimit = stats.memory_stats?.limit || (512 * 1024 * 1024);
        const realMemMb = Math.round((memUsage / (1024 * 1024)) * 10) / 10;
        const realMemLimitMb = Math.round((memLimit / (1024 * 1024)) * 10) / 10;
        const realMemPercent = Math.min(100, Math.round((memUsage / memLimit) * 100));

        const existing = containerMetrics.get(nodeId) || {
          nodeId,
          totalRequests: 0,
          failedRequests: 0,
          completedRequests: 0,
          activeRequests: 0,
          avgLatencyMs: 0,
          totalLatencyMs: 0,
          throughputRps: 0,
          status: 'healthy',
        };

        existing.nodeId = nodeId;
        existing.cpuPercent = realCpuPercent;
        existing.memoryMb = realMemMb;
        existing.memoryLimitMb = realMemLimitMb;
        existing.memoryPercent = realMemPercent;
        existing.lastSeen = Date.now();
        existing.real = true;
        existing.containerName = containerName;
        existing.containerState = c.State || 'running';
        existing.status = (c.State === 'running' && existing.failedRequests === 0) ? 'healthy' : (existing.failedRequests > 0 ? 'error' : 'healthy');

        containerMetrics.set(nodeId, existing);
      } catch (_) {}
    }

    broadcastMetrics();
  } catch (_) {
    // Docker socket not mounted or permission error - fallback silently
  }
}

function updateNodeMetrics(rawNodeId, isError = false, latency = 0) {
  const nodeId = normalizeNodeId(rawNodeId);
  const now = Date.now();
  const existing = containerMetrics.get(nodeId) || {
    nodeId,
    totalRequests: 0,
    failedRequests: 0,
    completedRequests: 0,
    activeRequests: 1,
    avgLatencyMs: latency || 15,
    totalLatencyMs: 0,
    cpuPercent: 0,
    memoryMb: 45,
    memoryLimitMb: 512,
    memoryPercent: 10,
    throughputRps: 1,
    lastSeen: now,
    status: 'healthy',
  };

  existing.totalRequests += 1;
  if (isError) {
    existing.failedRequests += 1;
  } else {
    existing.completedRequests += 1;
  }
  if (latency > 0) {
    existing.totalLatencyMs += latency;
    existing.avgLatencyMs = Math.round(existing.totalLatencyMs / existing.totalRequests);
  }
  existing.lastSeen = now;
  const errRatio = existing.totalRequests > 0 ? (existing.failedRequests / existing.totalRequests) : 0;
  existing.status = errRatio > 0.15 ? 'error' : errRatio > 0.05 ? 'warning' : 'healthy';
  existing.throughputRps = Math.max(1, Math.round((existing.totalRequests / 60) * 10) / 10);

  containerMetrics.set(nodeId, existing);
}

// ─── Socket.IO Instance ───────────────────────────────────────
let io = null;

function broadcastLog(logEntry) {
  if (io) io.emit('log', logEntry);
}

function broadcastMetrics() {
  if (io && containerMetrics.size > 0) {
    const metricList = Array.from(containerMetrics.values());
    io.emit('metrics', metricList);
    saveMetricsToRedis(metricList);
  }
}

// ─── Redis Telemetry Data Persistence (Logs, Errors, Traces, Metrics) ────────
async function saveLogToRedis(logEntry) {
  try {
    if (redisClient && redisClient.isOpen) {
      const payload = JSON.stringify(logEntry);
      const multi = redisClient.multi();
      multi.lPush('telemetry:logs', payload);
      multi.lTrim('telemetry:logs', 0, 9999);
      if (logEntry.level === 'ERROR' || logEntry.level === 'FATAL' || logEntry.statusCode >= 400) {
        multi.lPush('telemetry:errors', payload);
        multi.lTrim('telemetry:errors', 0, 4999);
      }
      await multi.exec();
    }
  } catch (err) {
    console.error('[Telemetry Redis] Error saving log:', err.message);
  }
}

async function saveTraceToRedis(traceEntry) {
  try {
    if (redisClient && redisClient.isOpen) {
      const multi = redisClient.multi();
      multi.lPush('telemetry:traces', JSON.stringify(traceEntry));
      multi.lTrim('telemetry:traces', 0, 4999);
      await multi.exec();
    }
  } catch (err) {
    console.error('[Telemetry Redis] Error saving trace:', err.message);
  }
}

async function saveMetricsToRedis(metricList) {
  try {
    if (redisClient && redisClient.isOpen && metricList && metricList.length > 0) {
      await redisClient.set('telemetry:metrics', JSON.stringify(metricList), { EX: 86400 });
    }
  } catch (err) {
    console.error('[Telemetry Redis] Error saving metrics snapshot:', err.message);
  }
}

async function loadPersistedTelemetryFromRedis() {
  try {
    if (redisClient && redisClient.isOpen) {
      const rawLogs = await redisClient.lRange('telemetry:logs', 0, 499);
      if (rawLogs && rawLogs.length > 0) {
        logs = rawLogs.map((r) => {
          try { return JSON.parse(r); } catch (_) { return null; }
        }).filter(Boolean);
        console.log(`[Telemetry Redis] 📥 Loaded ${logs.length} persisted logs from Redis`);
      }

      const rawTraces = await redisClient.lRange('telemetry:traces', 0, 499);
      if (rawTraces && rawTraces.length > 0) {
        traces = rawTraces.map((r) => {
          try { return JSON.parse(r); } catch (_) { return null; }
        }).filter(Boolean);
        console.log(`[Telemetry Redis] 📥 Loaded ${traces.length} persisted traces from Redis`);
      }

      const rawMetrics = await redisClient.get('telemetry:metrics');
      if (rawMetrics) {
        try {
          const metricsList = JSON.parse(rawMetrics);
          if (Array.isArray(metricsList)) {
            metricsList.forEach((m) => {
              if (m && m.nodeId) containerMetrics.set(normalizeNodeId(m.nodeId), m);
            });
            console.log(`[Telemetry Redis] 📥 Restored ${containerMetrics.size} node metrics from Redis`);
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error('[Telemetry Redis] Error restoring persisted telemetry:', err.message);
  }
}

function processIncomingLogs(entries) {
  const normalizedList = Array.isArray(entries) ? entries : [entries];
  normalizedList.forEach((entry) => {
    if (!entry) return;
    const isError = entry.level === 'ERROR' || entry.level === 'FATAL' || entry.status >= 400;
    const nodeName = entry.container || entry.serviceName || entry.service || 'unknown';
    
    updateNodeMetrics(nodeName, isError, entry.latency || entry.durationMs || 0);

    const logEntry = {
      id: entry.id || `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: entry.time || entry.timestamp || Date.now(),
      level: (entry.level || (isError ? 'ERROR' : 'INFO')).toUpperCase(),
      message: entry.message || entry.msg || '',
      container: nodeName,
      latency: entry.latency || entry.durationMs || 0,
      statusCode: entry.statusCode || entry.status || 200,
      ...entry,
    };
    delete logEntry.time;
    logs.unshift(logEntry);
    if (logs.length > MAX_LOGS) logs.pop();

    // Persist to Telemetry Redis
    saveLogToRedis(logEntry);
    broadcastLog(logEntry);
  });
  return normalizedList.length;
}

app.post('/ingest', (req, res) => {
  const count = processIncomingLogs(req.body);
  res.status(200).json({ status: 'ok', count });
});

app.post('/v1/logs', (req, res) => {
  const count = processIncomingLogs(req.body);
  res.status(200).json({ status: 'ok', count });
});

app.post('/v1/metrics', (req, res) => {
  const metrics = Array.isArray(req.body) ? req.body : [req.body];
  metrics.forEach((m) => {
    if (m && m.nodeId) {
      containerMetrics.set(normalizeNodeId(m.nodeId), {
        ...m,
        lastSeen: Date.now(),
      });
    }
  });
  broadcastMetrics();
  res.status(200).json({ success: true, count: metrics.length });
});

app.post('/v1/traces', (req, res) => {
  const contentType = req.headers['content-type'] || '';
  let resourceSpans = [];
  if (contentType.includes('application/json')) {
    resourceSpans = req.body.resourceSpans || [];
  } else if (contentType.includes('application/x-protobuf')) {
    return res.status(415).json({ error: 'Protobuf not supported, use JSON' });
  } else {
    resourceSpans = req.body.resourceSpans || [];
  }

  for (const rs of resourceSpans) {
    const resource = rs.resource || {};
    const serviceName = resource.attributes?.find((attr) => attr.key === 'service.name')?.value?.stringValue || 'unknown';
    const scopeSpans = rs.scopeSpans || [];
    for (const ss of scopeSpans) {
      const spans = ss.spans || [];
      for (const span of spans) {
        const traceId = span.traceId || '';
        const spanId = span.spanId || '';
        const name = span.name || 'unnamed';
        const startTimeUnixNano = span.startTimeUnixNano || 0;
        const endTimeUnixNano = span.endTimeUnixNano || 0;
        const durationMs = (endTimeUnixNano - startTimeUnixNano) / 1_000_000;
        const attributes = span.attributes || [];
        const isError = span.status?.code === 2 || attributes.some(a => a.key === 'error' && a.value?.boolValue);

        updateNodeMetrics(serviceName, isError, durationMs);

        const traceEntry = {
          traceId,
          spanId,
          name,
          serviceName,
          startTime: new Date(Number(startTimeUnixNano) / 1_000_000),
          durationMs: durationMs > 0 ? durationMs : 0,
          attributes: Object.fromEntries(attributes.map((a) => [a.key, a.value?.stringValue || a.value?.intValue || a.value?.boolValue || ''])),
          timestamp: Date.now(),
        };

        traces.unshift(traceEntry);
        if (traces.length > MAX_TRACES) traces.pop();

        // Persist trace to Telemetry Redis
        saveTraceToRedis(traceEntry);
      }
    }
  }

  if (io) io.emit('trace', { count: resourceSpans.length });
  res.status(200).json({ success: true, received: resourceSpans.length });
});

// ─── Protected Telemetry Data Routes ──────────────────────────
function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      return next();
    }
  }
  res.status(401).json({ error: 'Unauthorized' });
}

app.get('/logs', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  res.json({ total: logs.length, logs: logs.slice(0, limit) });
});

app.get('/metrics', requireAuth, (req, res) => {
  res.json({ total: containerMetrics.size, metrics: Array.from(containerMetrics.values()) });
});

app.get('/errors', requireAuth, (req, res) => {
  const errors = logs.filter((log) => log.level === 'ERROR' || log.level === 'FATAL');
  res.json({ total: errors.length, logs: errors.slice(0, 100) });
});

app.get('/traces', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  res.json({ total: traces.length, traces: traces.slice(0, limit) });
});

// ─── Metrics Broadcast Interval ──────────────────────────────
setInterval(() => {
  broadcastMetrics();
}, 2000);

// ─── Socket.IO Server Configuration ───────────────────────────
const server = http.createServer(app);
io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN === '*' ? true : [CLIENT_ORIGIN, 'http://localhost:8083', 'http://localhost:5173'],
    credentials: true,
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      return next();
    } catch {
      // Proceed to check session cookie fallback
    }
  }

  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) {
    return next(new Error('No authentication credentials provided'));
  }

  const cookies = cookie.parse(cookieHeader);
  const signedValue = cookies['connect.sid'];

  if (!signedValue || !signedValue.startsWith('s:')) {
    return next(new Error('Invalid session format'));
  }

  const sessionId = signature.unsign(signedValue.slice(2), SESSION_SECRET);
  if (sessionId === false) {
    return next(new Error('Invalid session signature'));
  }

  sessionStore.get(sessionId, (err, sessionData) => {
    if (err || !sessionData || !sessionData.user) {
      return next(new Error('Session validation failed'));
    }
    socket.user = sessionData.user;
    next();
  });
});


io.on('connection', (socket) => {
  const username = socket.user?.username || 'admin';
  console.log(`[Socket.IO] ✅ Client connected: ${socket.id} (user: ${username})`);
  socket.emit('init', { logs: logs.slice(0, 100) });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] ❌ Client disconnected: ${socket.id}`);
  });
});

// ─── Graceful Shutdown ────────────────────────────────────────
async function shutdown() {
  console.log('\n[Telemetry Server] Shutting down gracefully...');
  try {
    if (redisClient.isOpen) await redisClient.quit();
    server.close(() => {
      console.log('[Telemetry Server] Closed HTTP listeners');
      process.exit(0);
    });
  } catch (err) {
    console.error('[Telemetry Server] Shutdown error:', err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ─── Start Server ─────────────────────────────────────────────
async function startServer() {
  try {
    await redisClient.connect();
    // Load persisted telemetry logs and traces from Redis
    await loadPersistedTelemetryFromRedis();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n${'═'.repeat(55)}`);
      console.log(`🚀 Telemetry Server Active on Port ${PORT}`);
      console.log(`📡 Ingestion Endpoints: /v1/logs, /v1/traces, /ingest`);
      console.log(`💾 Telemetry Log Storage: Redis (telemetry:logs, telemetry:traces)`);
      console.log(`🔐 Auth: Redis Session (${SESSION_SECRET.slice(0, 4)}***) + JWT`);
      console.log(`🌐 Dashboard Origin: ${CLIENT_ORIGIN}`);
      console.log(`⚡ Real-Time Docker Container Engine Metrics: Enabled (/var/run/docker.sock)`);
      console.log(`${'═'.repeat(55)}\n`);

      // Immediate initial poll
      pollRealDockerMetrics();
      // Regular 2.5s polling loop for live CPU and Memory utilization
      setInterval(pollRealDockerMetrics, 2500);
    });
  } catch (err) {
    console.error('[Telemetry Server] Startup failure:', err.message);
    process.exit(1);
  }
}
startServer();
