const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();

// ─── Environment ──────────────────────────────────────────────
const PORT = process.env.PORT || 3003;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-in-production';
const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-change-me';
const DASHBOARD_USER = process.env.DASHBOARD_USER || 'admin';
const DASHBOARD_PASS = process.env.DASHBOARD_PASS || 'password';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const REDIS_URL = process.env.REDIS_URL || 'redis://telemetry-redis:6379';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Redis / Session Store ────────────────────────────────────
let sessionStore;
let redisClient = null;

try {
  const { createClient } = require('redis');
  redisClient = createClient({ url: REDIS_URL });
  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  redisClient.connect().catch(console.error);

  // Try to load connect-redis (may fail if not installed)
  const RedisStore = require('connect-redis')(session);
  sessionStore = new RedisStore({ client: redisClient });
  console.log('✅ Redis session store enabled');
} catch (err) {
  console.warn('⚠️ RedisStore not available – falling back to MemoryStore');
  console.warn('   Reason:', err.message);
  sessionStore = new session.MemoryStore();
  redisClient = null;
}

// ─── Session middleware ──────────────────────────────────────
app.use(cookieParser());
const sessionParser = session({
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
});
app.use(sessionParser);

// ─── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body parsers ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── In‑memory storage ──────────────────────────────────────
let logs = [];
let traces = [];
let wsClients = [];
const MAX_LOGS = 10000;
const MAX_TRACES = 1000;

// ─── JWT helpers ─────────────────────────────────────────────
function generateToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

// ─── Auth middleware (session OR JWT) ──────────────────────
function requireAuth(req, res, next) {
  if (['/ingest', '/v1/traces', '/v1/logs', '/health', '/login', '/logout', '/check-auth'].includes(req.path)) {
    return next();
  }
  if (req.session && req.session.user) return next();
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      return next();
    }
  }
  res.status(401).json({ error: 'Unauthorized' });
}
app.use(requireAuth);

// ─── Public routes ──────────────────────────────────────────
app.get('/check-auth', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ authenticated: true, method: 'session' });
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded) {
      return res.json({ authenticated: true, method: 'jwt', user: decoded.username });
    }
  }
  res.json({ authenticated: false });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === DASHBOARD_USER && password === DASHBOARD_PASS) {
    req.session.user = { username };
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      }
      const token = generateToken(username);
      return res.json({ success: true, token });
    });
  } else {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// ─── Health ──────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', traces: traces.length, logs: logs.length, redis: !!redisClient?.isOpen });
});

// ─── LOG INGESTION ──────────────────────────────────────────
app.post('/ingest', (req, res) => {
  const entries = Array.isArray(req.body) ? req.body : [req.body];
  entries.forEach(entry => {
    const logEntry = {
      timestamp: entry.time || entry.timestamp || Date.now(),
      level: entry.level || 'INFO',
      message: entry.message || '',
      container: entry.container || 'unknown',
      ...entry,
    };
    delete logEntry.time;
    logs.push(logEntry);
    if (logs.length > MAX_LOGS) logs.shift();
    wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'log', data: logEntry }));
      }
    });
  });
  res.status(200).json({ status: 'ok', count: entries.length });
});

app.post('/v1/logs', (req, res) => {
  const entries = Array.isArray(req.body) ? req.body : [req.body];
  entries.forEach(entry => {
    const logEntry = {
      timestamp: entry.time || entry.timestamp || Date.now(),
      level: entry.level || 'INFO',
      message: entry.message || '',
      container: entry.container || 'unknown',
      ...entry,
    };
    delete logEntry.time;
    logs.push(logEntry);
    if (logs.length > MAX_LOGS) logs.shift();
    wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'log', data: logEntry }));
      }
    });
  });
  res.status(200).json({ status: 'ok', count: entries.length });
});

// ─── OTLP Traces ingestion ────────────────────────────────
app.post('/v1/traces', (req, res) => {
  const contentType = req.headers['content-type'] || '';
  let resourceSpans = [];
  if (contentType.includes('application/json')) {
    resourceSpans = req.body.resourceSpans || [];
  } else if (contentType.includes('application/x-protobuf')) {
    console.warn('Protobuf traces not yet supported – please send JSON');
    return res.status(415).json({ error: 'Protobuf not supported, use JSON' });
  } else {
    resourceSpans = req.body.resourceSpans || [];
  }
  for (const rs of resourceSpans) {
    const resource = rs.resource || {};
    const serviceName = resource.attributes?.find(attr => attr.key === 'service.name')?.value?.stringValue || 'unknown';
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
        traces.unshift({
          traceId,
          spanId,
          name,
          serviceName,
          startTime: new Date(Number(startTimeUnixNano) / 1_000_000),
          durationMs: durationMs > 0 ? durationMs : 0,
          attributes: Object.fromEntries(attributes.map(a => [a.key, a.value?.stringValue || a.value?.intValue || a.value?.boolValue || ''])),
          timestamp: Date.now(),
        });
        if (traces.length > MAX_TRACES) traces.pop();
      }
    }
  }
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'trace', data: { count: resourceSpans.length } }));
    }
  });
  res.status(200).json({ success: true, received: resourceSpans.length });
});

// ─── Protected REST endpoints ──────────────────────────────
app.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const sorted = [...logs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  res.json({ total: logs.length, logs: sorted.slice(0, limit) });
});

app.get('/errors', (req, res) => {
  const errors = logs.filter(log => log.level === 'ERROR' || log.level === 'FATAL');
  const sorted = errors.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  res.json({ total: errors.length, logs: sorted.slice(0, 100) });
});

app.get('/traces', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const sorted = [...traces].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  res.json({ total: traces.length, traces: sorted.slice(0, limit) });
});

// ─── WebSocket Server ────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
  wsClients.push(ws);
  ws.on('close', () => {
    wsClients = wsClients.filter(client => client !== ws);
  });
});

server.on('upgrade', (request, socket, head) => {
  sessionParser(request, {}, () => {
    if (!request.session || !request.session.user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
});

// ─── Graceful shutdown ──────────────────────────────────────
function shutdown() {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    if (redisClient) redisClient.quit().then(() => process.exit(0)).catch(() => process.exit(0));
    else process.exit(0);
  });
  setTimeout(() => { console.log('Forcing exit.'); process.exit(1); }, 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ─── Start ──────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n================================`);
  console.log(`🚀 Telemetry server running on port ${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}`);
  console.log(`📝 Logs ingest: POST ${PORT}/ingest (or /v1/logs)`);
  console.log(`🔭 OTLP traces ingest: POST ${PORT}/v1/traces (JSON)`);
  console.log(`🔐 Auth: session cookie (${sessionStore.constructor.name}) OR JWT`);
  console.log(`🌐 Environment: ${NODE_ENV}`);
  console.log(`==================================\n`);
});