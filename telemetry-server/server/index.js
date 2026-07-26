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
const { Server } = require('socket.io');

const app = express();

// ─── Environment ──────────────────────────────────────────────
const PORT = process.env.PORT || 3003;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-in-production';
const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-change-me';
const DASHBOARD_USER = process.env.DASHBOARD_USER || 'admin';
const DASHBOARD_PASS = process.env.DASHBOARD_PASS || 'password';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:8083';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// ════════════════════════════════════════════════════════════
//  REDIS CLIENT
// ════════════════════════════════════════════════════════════

const redisClient = createClient({ url: REDIS_URL });

redisClient.on('error', (err) => console.error('[Redis] Client Error:', err));
redisClient.on('connect', () => console.log('[Redis] Connected'));
redisClient.on('reconnecting', () => console.log('[Redis] Reconnecting...'));

// ─── Session Store (Redis) ────────────────────────────────────
const sessionStore = new RedisStore({ client: redisClient, prefix: 'sess:' });

// ─── Session Middleware ───────────────────────────────────────
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
  origin: CLIENT_ORIGIN,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsers ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── In-Memory Storage (logs/traces stay in memory per instance) ─
let logs = [];
let traces = [];
const MAX_LOGS = 10000;
const MAX_TRACES = 1000;

// ─── JWT Helpers ──────────────────────────────────────────────
function generateToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ─── Routes: Public ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', logs: logs.length, traces: traces.length });
});

app.get('/check-auth', (req, res) => {
  if (req.session?.user) {
    return res.json({ authenticated: true, method: 'session', user: req.session.user.username });
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
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
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (username === DASHBOARD_USER && password === DASHBOARD_PASS) {
    req.session.user = { username };
    req.session.save((err) => {
      if (err) {
        console.error('[AUTH] Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      }
      const token = generateToken(username);
      console.log(`[AUTH] ✅ Login successful: ${username}`);
      res.json({ success: true, token });
    });
  } else {
    console.warn(`[AUTH] ❌ Failed login attempt: ${username}`);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[AUTH] Session destroy error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    console.log('[AUTH] ✅ Logout successful');
    res.json({ success: true });
  });
});

// ─── Routes: Ingest ──────────────────────────────────────────
let io = null;

function broadcastLog(logEntry) {
  if (io) io.emit('log', logEntry);
}

app.post('/ingest', (req, res) => {
  const entries = Array.isArray(req.body) ? req.body : [req.body];
  entries.forEach((entry) => {
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
    broadcastLog(logEntry);
  });
  res.status(200).json({ status: 'ok', count: entries.length });
});

app.post('/v1/logs', (req, res) => {
  const entries = Array.isArray(req.body) ? req.body : [req.body];
  entries.forEach((entry) => {
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
    broadcastLog(logEntry);
  });
  res.status(200).json({ status: 'ok', count: entries.length });
});

app.post('/v1/traces', (req, res) => {
  const contentType = req.headers['content-type'] || '';
  let resourceSpans = [];
  if (contentType.includes('application/json')) {
    resourceSpans = req.body.resourceSpans || [];
  } else if (contentType.includes('application/x-protobuf')) {
    console.warn('[TRACES] Protobuf not supported');
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
        traces.unshift({
          traceId,
          spanId,
          name,
          serviceName,
          startTime: new Date(Number(startTimeUnixNano) / 1_000_000),
          durationMs: durationMs > 0 ? durationMs : 0,
          attributes: Object.fromEntries(attributes.map((a) => [a.key, a.value?.stringValue || a.value?.intValue || a.value?.boolValue || ''])),
          timestamp: Date.now(),
        });
        if (traces.length > MAX_TRACES) traces.pop();
      }
    }
  }

  if (io) io.emit('trace', { count: resourceSpans.length });
  res.status(200).json({ success: true, received: resourceSpans.length });
});

// ─── Routes: Protected ──────────────────────────────────────────
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
  const limit = parseInt(req.query.limit) || 100;
  const sorted = [...logs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  res.json({ total: logs.length, logs: sorted.slice(0, limit) });
});

app.get('/errors', requireAuth, (req, res) => {
  const errors = logs.filter((log) => log.level === 'ERROR' || log.level === 'FATAL');
  const sorted = errors.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  res.json({ total: errors.length, logs: sorted.slice(0, 100) });
});

app.get('/traces', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const sorted = [...traces].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  res.json({ total: traces.length, traces: sorted.slice(0, limit) });
});

// ════════════════════════════════════════════════════════════
//  SOCKET.IO SERVER
// ════════════════════════════════════════════════════════════

const server = http.createServer(app);
io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      console.log(`[Socket] ✅ Authenticated via JWT: ${decoded.username}`);
      return next();
    } catch (err) {
      console.warn(`[Socket] ⚠️ Invalid JWT: ${err.message}`);
    }
  }

  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) {
    console.warn('[Socket] ❌ No cookie header');
    return next(new Error('No session cookie provided'));
  }

  const cookies = cookie.parse(cookieHeader);
  const signedValue = cookies['connect.sid'];

  if (!signedValue) {
    console.warn('[Socket] ❌ No connect.sid cookie found');
    return next(new Error('No session ID found'));
  }

  if (!signedValue.startsWith('s:')) {
    console.warn('[Socket] ❌ Cookie is not signed');
    return next(new Error('Invalid cookie format'));
  }

  const sessionId = signature.unsign(signedValue.slice(2), SESSION_SECRET);
  if (sessionId === false) {
    console.warn('[Socket] ❌ Session signature invalid');
    return next(new Error('Invalid session signature'));
  }

  console.log(`[Socket] Looking up sessionId: ${sessionId}`);

  sessionStore.get(sessionId, (err, session) => {
    if (err) {
      console.error('[Socket] Session store error:', err);
      return next(new Error('Session retrieval failed'));
    }
    if (!session || !session.user) {
      console.warn('[Socket] ❌ Session not found or no user');
      return next(new Error('Invalid session'));
    }
    socket.user = session.user;
    console.log(`[Socket] 🍪 Authenticated via session cookie: ${session.user.username}`);
    next();
  });
});

io.on('connection', (socket) => {
  const username = socket.user?.username || 'unknown';
  console.log(`[Socket] ✅ Client connected: ${socket.id} (user: ${username})`);
  const initialLogs = logs.slice(-100);
  socket.emit('init', { logs: initialLogs });

  socket.on('disconnect', () => {
    console.log(`[Socket] ❌ Client disconnected: ${socket.id} (user: ${username})`);
  });
  socket.on('error', (err) => {
    console.error(`[Socket] Error for ${username}:`, err);
  });
});

// ─── Graceful Shutdown ────────────────────────────────────────
async function shutdown() {
  console.log('\n[SERVER] 🛑 Shutting down gracefully...');
  await redisClient.quit();
  server.close(() => {
    console.log('[SERVER] HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[SERVER] Force exit after timeout');
    process.exit(1);
  }, 5000);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ─── Start Server (after Redis connects) ──────────────────────
async function startServer() {
  await redisClient.connect();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`🚀 Telemetry Server Running (Socket.IO + Redis)`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 Origin: ${CLIENT_ORIGIN}`);
    console.log(`🗄️  Redis: ${REDIS_URL}`);
    console.log(`🔐 Credentials: ${DASHBOARD_USER} / ${DASHBOARD_PASS}`);
    console.log(`📦 Session Store: Redis (connect-redis)`);
    console.log(`🔐 Auth Methods: JWT + Session Cookie`);
    console.log(`${'═'.repeat(50)}\n`);
  });
}

startServer().catch((err) => {
  console.error('[SERVER] Failed to start:', err);
  process.exit(1);
});

