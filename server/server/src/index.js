/*require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

// Security packages
const xss = require('xss');
const { doubleCsrf } = require('csrf-csrf');

// Configs
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const { authenticateToken, requireAuth } = require('./middleware/auth');

// Models
const SystemEventLog = require('./models/SystemEventLog');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

console.log('[BOOT] CLIENT_URL =', process.env.CLIENT_URL);
console.log('[BOOT] Socket.io server initialized');

// ============ DATABASE CONNECTION ============
let dbConnected = false;
let redisConnected = false;

// Redis adapter clients (for clean shutdown)
let pubClient, subClient;
// Main Redis client (BullMQ)
let mainRedisClient;

const startServer = async () => {
  // ---------- MongoDB ----------
  try {
    await connectDB();
    dbConnected = true;
    console.log('[BOOT] MongoDB connected');
  } catch (err) {
    console.error('[BOOT] MongoDB connection failed:', err.message);
    process.exit(1);
  }

  // ---------- Redis (BullMQ) ----------
  try {
    const redisConn = await connectRedis();
    redisConnected = true;
    mainRedisClient = redisConn;
    console.log('[BOOT] BullMQ Redis connected');
  } catch (err) {
    console.error('[BOOT] BullMQ Redis connection failed:', err.message);
    process.exit(1);
  }

  // ---------- Socket.IO Redis adapter ----------
  try {
    pubClient = createClient({ url: process.env.REDIS_URL || 'redis://redis-internal:6379' });
    subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[BOOT] Socket.io Redis adapter attached');
  } catch (err) {
    console.error('[BOOT] Socket.io Redis adapter failed (non-fatal):', err.message);
  }

  // ============ BACKGROUND QUEUE SERVICES ============
  require('./queues/emailQueue');

  // ============ MIDDLEWARE ============
  app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
  }));
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, res, next) => { req.io = io; next(); });

  // ---------- DEBUG: log every incoming request ----------
  app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.originalUrl} | Origin: ${req.headers.origin} | Cookie: ${req.headers.cookie ? 'present' : 'MISSING'}`);
    next();
  });

  // ---------- SECURITY: XSS Sanitizer ----------
  app.use((req, res, next) => {
    const sanitize = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = xss(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    };
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
  });

  // ---------- SECURITY: CSRF Protection ----------
  const { generateToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET || 'a-very-secure-random-string',
    cookieName: 'x-csrf-token',
    cookieOptions: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  });

  // Let API routes bypass CSRF (they use JWT, not cookies)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    doubleCsrfProtection(req, res, next);
  });

  // Provide CSRF token endpoint for frontend
  app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: generateToken(req, res) });
  });

  // ============ CONTROLLERS ============
  const login = require('./controllers/login');
  const setuser = require('./controllers/setuser');
  const isemailvalid = require('./controllers/isemailvalid');
  const isvalidusername = require('./controllers/isvalidusername');
  const otp_resend = require('./controllers/otp_resend');
  const otp_verify = require('./controllers/otp_verify');
  const logout = require('./controllers/logout');
  const sync_auth = require('./controllers/sync_auth');
  const guest_session = require('./controllers/guest_session');
  const create_project = require('./controllers/create_project');
  const projects = require('./controllers/projects');
  const join_project = require('./controllers/join_project');
  const updateProjectStatus = require('./controllers/updateProjectStatus');
  const api_history = require('./controllers/api_history');
  const update_api = require('./controllers/update_api');
  const add_api = require('./controllers/add_api');
  const verify_project = require('./controllers/verify_project');
  const api_version_data = require('./controllers/api_version_data');
  const reset_invitation_code = require('./controllers/reset_invitation_code');
  const verify_invitationcode_otp = require('./controllers/verify_invitationcode_otp');
  const approve_project_request = require('./controllers/approve_project_request');
  const get_received_requests = require('./controllers/get_received_requests');
  const get_sent_requests = require('./controllers/get_sent_requests');
  const revoke_request = require('./controllers/revoke_request');
  const get_user_apis = require('./controllers/get_user_apis');
  const delete_api_version = require('./controllers/delete_api_version');
  const reverse_ai = require('./controllers/reverse_ai');
  const subscribe = require('./controllers/subscribe');
  const logs = require('./controllers/logs');
  const unsubscribe = require('./controllers/unsubscribe');
  const { ask_ai } = require('./controllers/ask_ai');
  const delete_project = require('./controllers/delete_project');

  // ============ ROUTES ============
  app.post('/api/subscribe', authenticateToken, subscribe);
  app.post('/api/unsubscribe', authenticateToken, unsubscribe);
  app.post('/api/isemailvalid', isemailvalid);
  app.post('/api/isvalidusername', isvalidusername);
  app.post('/api/setuser', setuser);
  app.post('/api/login', login);
  app.post('/api/logout', logout);
  app.post('/api/otp-resend', otp_resend);
  app.post('/api/otp-verify', otp_verify);
  app.get('/api/sync-auth', sync_auth);
  app.post('/api/guest-session', guest_session);
  app.post('/api/create-project', authenticateToken, create_project);
  app.post('/api/join-project', authenticateToken, join_project);
  app.get('/api/projects', authenticateToken, projects);
  app.patch('/api/projects/:projectId/status', authenticateToken, updateProjectStatus);
  app.post('/api/verify-project', authenticateToken, verify_project);
  app.post('/api/reset-invitation-code', authenticateToken, reset_invitation_code);
  app.post('/api/verify-invitationcode-otp', authenticateToken, verify_invitationcode_otp);
  app.get('/api/requests/received', authenticateToken, get_received_requests);
  app.get('/api/requests/sent', authenticateToken, get_sent_requests);
  app.post('/api/requests/accept/:requestId', authenticateToken, approve_project_request);
  app.delete('/api/requests/revoke/:requestId', authenticateToken, revoke_request);
  app.get('/api/user-apis', authenticateToken, get_user_apis);
  app.post('/api/update-api', authenticateToken, update_api);
  app.post('/api/add-api', authenticateToken, add_api);
  app.post('/api/api-version-data', authenticateToken, api_version_data);
  app.get('/api/api-history', authenticateToken, api_history);
  app.delete('/api/versions/delete/:versionId', authenticateToken, delete_api_version);
  app.post('/api/ask-ai', authenticateToken, ask_ai);
  app.post('/api/reverse-ai', authenticateToken, reverse_ai);
  app.post('/api/logs', authenticateToken, logs);
  app.delete('/api/deleteproject', authenticateToken, delete_project);

  app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });

  // ============ SOCKET.IO ============
  let heartbeatInterval;
  let dataPollingInterval;
  let lastCheckedTime = new Date();

  // ---------- DEBUG: log engine-level connection errors (handshake rejections) ----------
  io.engine.on('connection_error', (err) => {
    console.error('[SOCKET.IO ENGINE ERROR]', {
      code: err.code,
      message: err.message,
      context: err.context,
      req_url: err.req?.url,
      req_headers: err.req?.headers,
    });
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Connected: ${socket.id} | transport: ${socket.conn.transport.name}`);

    socket.on('join_room', (roomName) => {
      if (roomName && typeof roomName === 'string') {
        console.log(`[SOCKET] ${socket.id} joined room: ${roomName}`);
        socket.join(roomName);
      }
    });

    socket.on('join_project', async (projectId) => {
      if (!projectId) return;
      console.log(`[SOCKET] ${socket.id} joined project: ${projectId}`);
      socket.join(projectId);
      try {
        const initialLogs = await SystemEventLog.find({ projectId })
          .sort({ createdAt: -1 })
          .limit(50);
        socket.emit('initial_logs', initialLogs);
      } catch (err) {
        console.error('[SOCKET] Error fetching initial logs:', err.message);
        socket.emit('initial_logs', []);
      }
    });

    socket.on('leave_project', (projectId) => {
      console.log(`[SOCKET] ${socket.id} left project: ${projectId}`);
      socket.leave(projectId);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] Disconnected: ${socket.id} | reason: ${reason}`);
    });
  });

  // Heartbeat interval – read from env
  const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL);
  heartbeatInterval = setInterval(() => {
    io.emit('heartbeat', { timestamp: Date.now() });
  }, HEARTBEAT_INTERVAL);

  // Polling fallback interval – read from env
  const LOG_POLLING_INTERVAL = parseInt(process.env.LOG_POLLING_INTERVAL);
  dataPollingInterval = setInterval(async () => {
    const now = new Date();
    try {
      const newLogs = await SystemEventLog.find({ createdAt: { $gt: lastCheckedTime } })
        .sort({ createdAt: 1 });
      if (newLogs.length > 0) {
        const logsByProject = {};
        newLogs.forEach(log => {
          if (!logsByProject[log.projectId]) logsByProject[log.projectId] = [];
          logsByProject[log.projectId].push(log);
        });
        for (const [projectId, logs] of Object.entries(logsByProject)) {
          logs.forEach(singleLog => {
            io.to(projectId).emit('new_api_log', singleLog);
          });
        }
      }
      lastCheckedTime = now;
    } catch (err) {
      console.error('[POLLING] Error polling logs:', err.message);
    }
  }, LOG_POLLING_INTERVAL);

  // ============ GRACEFUL SHUTDOWN ============
  const gracefulShutdown = async () => {
    console.log('[SHUTDOWN] Graceful shutdown initiated');
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (dataPollingInterval) clearInterval(dataPollingInterval);

    try {
      if (pubClient) await pubClient.quit();
      if (subClient) await subClient.quit();
    } catch (_) {}

    if (mainRedisClient) {
      try { await mainRedisClient.quit(); } catch (_) {}
    }

    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  // ============ START SERVER ============
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`[BOOT] Server listening on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('[BOOT] Fatal startup error:', err);
  process.exit(1);
});*/






require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const xss = require('xss');
const { doubleCsrf } = require('csrf-csrf');

const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const { authenticateToken } = require('./middleware/auth');
const SystemEventLog = require('./models/SystemEventLog');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

let pubClient, subClient;
let mainRedisClient;

const startServer = async () => {
  await connectDB();
  mainRedisClient = await connectRedis();

  try {
    pubClient = createClient({ url: process.env.REDIS_URL });
    subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
  } catch (err) {
    console.error('[BOOT] Socket.io Redis adapter failed (non-fatal):', err.message);
  }

  require('./queues/emailQueue');

  app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
  }));
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, res, next) => { req.io = io; next(); });

  // XSS sanitization
  app.use((req, res, next) => {
    const sanitize = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = xss(obj[key]);
        } else if (obj[key] && typeof obj[key] === 'object') {
          sanitize(obj[key]);
        }
      }
    };
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
  });

  // CSRF protection (only for non-API routes)
  const { generateToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET,
    cookieName: 'x-csrf-token',
    cookieOptions: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  });

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    doubleCsrfProtection(req, res, next);
  });

  app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: generateToken(req, res) });
  });

  // Controllers
  const login = require('./controllers/login');
  const setuser = require('./controllers/setuser');
  const isemailvalid = require('./controllers/isemailvalid');
  const isvalidusername = require('./controllers/isvalidusername');
  const otp_resend = require('./controllers/otp_resend');
  const otp_verify = require('./controllers/otp_verify');
  const logout = require('./controllers/logout');
  const sync_auth = require('./controllers/sync_auth');
  const guest_session = require('./controllers/guest_session');
  const create_project = require('./controllers/create_project');
  const projects = require('./controllers/projects');
  const join_project = require('./controllers/join_project');
  const updateProjectStatus = require('./controllers/updateProjectStatus');
  const api_history = require('./controllers/api_history');
  const update_api = require('./controllers/update_api');
  const add_api = require('./controllers/add_api');
  const verify_project = require('./controllers/verify_project');
  const api_version_data = require('./controllers/api_version_data');
  const reset_invitation_code = require('./controllers/reset_invitation_code');
  const verify_invitationcode_otp = require('./controllers/verify_invitationcode_otp');
  const approve_project_request = require('./controllers/approve_project_request');
  const get_received_requests = require('./controllers/get_received_requests');
  const get_sent_requests = require('./controllers/get_sent_requests');
  const revoke_request = require('./controllers/revoke_request');
  const get_user_apis = require('./controllers/get_user_apis');
  const delete_api_version = require('./controllers/delete_api_version');
  const reverse_ai = require('./controllers/reverse_ai');
  const subscribe = require('./controllers/subscribe');
  const logs = require('./controllers/logs');
  const unsubscribe = require('./controllers/unsubscribe');
  const { ask_ai } = require('./controllers/ask_ai');
  const delete_project = require('./controllers/delete_project');

  app.post('/api/subscribe', authenticateToken, subscribe);
  app.post('/api/unsubscribe', authenticateToken, unsubscribe);
  app.post('/api/isemailvalid', isemailvalid);
  app.post('/api/isvalidusername', isvalidusername);
  app.post('/api/setuser', setuser);
  app.post('/api/login', login);
  app.post('/api/logout', logout);
  app.post('/api/otp-resend', otp_resend);
  app.post('/api/otp-verify', otp_verify);
  app.get('/api/sync-auth', sync_auth);
  app.post('/api/guest-session', guest_session);
  app.post('/api/create-project', authenticateToken, create_project);
  app.post('/api/join-project', authenticateToken, join_project);
  app.get('/api/projects', authenticateToken, projects);
  app.patch('/api/projects/:projectId/status', authenticateToken, updateProjectStatus);
  app.post('/api/verify-project', authenticateToken, verify_project);
  app.post('/api/reset-invitation-code', authenticateToken, reset_invitation_code);
  app.post('/api/verify-invitationcode-otp', authenticateToken, verify_invitationcode_otp);
  app.get('/api/requests/received', authenticateToken, get_received_requests);
  app.get('/api/requests/sent', authenticateToken, get_sent_requests);
  app.post('/api/requests/accept/:requestId', authenticateToken, approve_project_request);
  app.delete('/api/requests/revoke/:requestId', authenticateToken, revoke_request);
  app.get('/api/user-apis', authenticateToken, get_user_apis);
  app.post('/api/update-api', authenticateToken, update_api);
  app.post('/api/add-api', authenticateToken, add_api);
  app.post('/api/api-version-data', authenticateToken, api_version_data);
  app.get('/api/api-history', authenticateToken, api_history);
  app.delete('/api/versions/delete/:versionId', authenticateToken, delete_api_version);
  app.post('/api/ask-ai', authenticateToken, ask_ai);
  app.post('/api/reverse-ai', authenticateToken, reverse_ai);
  app.post('/api/logs', authenticateToken, logs);
  app.delete('/api/deleteproject', authenticateToken, delete_project);

  app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });

  // Socket.IO
  let heartbeatInterval, dataPollingInterval;
  let lastCheckedTime = new Date();

  io.engine.on('connection_error', (err) => {
    console.error('[SOCKET.IO] Handshake error:', err.message, err.context);
  });

  io.on('connection', (socket) => {
    socket.on('join_room', (roomName) => {
      if (roomName && typeof roomName === 'string') {
        socket.join(roomName);
      }
    });

    socket.on('join_project', async (projectId) => {
      if (!projectId) return;
      socket.join(projectId);
      try {
        const initialLogs = await SystemEventLog.find({ projectId })
          .sort({ createdAt: -1 })
          .limit(50);
        socket.emit('initial_logs', initialLogs);
      } catch (err) {
        socket.emit('initial_logs', []);
      }
    });

    socket.on('leave_project', (projectId) => {
      if (projectId) socket.leave(projectId);
    });
  });

  const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL, 10);
  heartbeatInterval = setInterval(() => {
    io.emit('heartbeat', { timestamp: Date.now() });
  }, HEARTBEAT_INTERVAL);

  const LOG_POLLING_INTERVAL = parseInt(process.env.LOG_POLLING_INTERVAL, 10);
  dataPollingInterval = setInterval(async () => {
    const now = new Date();
    try {
      const newLogs = await SystemEventLog.find({ createdAt: { $gt: lastCheckedTime } })
        .sort({ createdAt: 1 });
      if (newLogs.length) {
        const logsByProject = {};
        newLogs.forEach(log => {
          if (!logsByProject[log.projectId]) logsByProject[log.projectId] = [];
          logsByProject[log.projectId].push(log);
        });
        for (const [projectId, logs] of Object.entries(logsByProject)) {
          logs.forEach(singleLog => io.to(projectId).emit('new_api_log', singleLog));
        }
      }
      lastCheckedTime = now;
    } catch (err) {
      // silent – logs are non‑critical
    }
  }, LOG_POLLING_INTERVAL);

  const gracefulShutdown = async () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (dataPollingInterval) clearInterval(dataPollingInterval);
    if (pubClient) await pubClient.quit().catch(() => {});
    if (subClient) await subClient.quit().catch(() => {});
    if (mainRedisClient) await mainRedisClient.quit().catch(() => {});
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  const PORT = process.env.PORT;
  server.listen(PORT, () => {
    console.log(`[BOOT] Server listening on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('[BOOT] Fatal startup error:', err);
  process.exit(1);
});