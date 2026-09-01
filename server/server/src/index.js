// server/index.js
require('dotenv').config();
require('./opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const xss = require('xss');
const { doubleCsrf } = require('csrf-csrf');
const { Queue } = require('bullmq');

const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const { authenticateToken } = require('./middleware/auth');
const SystemEventLog = require('./models/SystemEventLog');

// ---------- MODELS ----------
const ApiCallLog = require('./models/ApiCallLog');
const Project = require('./models/Project');
const ProjectLatency = require('./models/ProjectLatency');
const ProjectApiHistory = require('./models/ProjectApiHistory');
const User = require('./models/User');
const TeamLatency = require('./models/TeamLatency');

// ---------- ROUTES ----------
const importRoutes = require('./routes/importRoutes');

const app = express();
const server = http.createServer(app);

console.log('[Server] 🚀 Starting server...');
console.log('[Server] 📌 Environment configuration:');
console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`  - PORT: ${process.env.PORT || 3000}`);
console.log(`  - CLIENT_URL: ${process.env.CLIENT_URL || 'http://localhost:8082'}`);
console.log(`  - REDIS_URL: ${process.env.REDIS_URL ? '✅ configured' : '❌ missing'}`);
console.log(`  - MONGO_URI: ${process.env.MONGO_URI ? '✅ configured' : '❌ missing'}`);

// ================================================================
// TIME WINDOW HELPER
// ================================================================
const TIME_WINDOWS_MS = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};
function resolveTimeWindow(range) {
  return TIME_WINDOWS_MS[range] || TIME_WINDOWS_MS['6h'];
}

// ================================================================
// 🚀 SOCKET.IO SETUP
// ================================================================
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:8082',
    credentials: true,
  },
  perMessageDeflate: { threshold: 1024 },
  maxHttpBufferSize: 1e6,
  pingInterval: 60000,
  pingTimeout: 20000,
});

let pubClient, subClient;
let mainRedisClient;
let aiSubscriber, logSubscriber, historySubscriber;
let latencyQueue, projectQueue, mockSyncQueue, openapiImportQueue;
let heartbeatInterval, dataPollingInterval;
let isRedisLogStreamActive = false;

// -----------------------------------------------------------------
// HELPER: aggregateAllLatencies
// -----------------------------------------------------------------
async function aggregateAllLatencies(projectIds) {
  if (!projectIds || projectIds.length === 0) {
    return new Map();
  }

  try {
    const stats = await ApiCallLog.aggregate([
      {
        $match: {
          project_id: { $in: projectIds },
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            project_id: '$project_id',
            path: '$path',
            method: '$method',
          },
          avgLatency: {
            $avg: { $ifNull: ['$total_latency', { $ifNull: ['$latency_ms', 0] }] },
          },
        },
      },
    ]);

    const map = new Map();
    for (const s of stats) {
      const key = `${s._id.project_id}::${s._id.path}::${s._id.method}`;
      map.set(key, Math.round(s.avgLatency || 0));
    }
    return map;
  } catch (err) {
    console.error('[DB] aggregateAllLatencies error:', err.message);
    return new Map();
  }
}

// ================================================================
// START SERVER
// ================================================================
const startServer = async () => {
  if (!process.env.CSRF_SECRET) {
    console.error('[FATAL] CSRF_SECRET is not set in environment');
    process.exit(1);
  }

  console.log('[Server] 🔌 Connecting to MongoDB...');
  await connectDB();
  console.log('[Server] ✅ MongoDB connected');

  console.log('[Server] 🔌 Connecting to Redis...');
  mainRedisClient = await connectRedis();
  console.log('[Server] ✅ Redis connected');

  // -------------- Redis adapter for Socket.IO ----------
  const redisUrl = process.env.REDIS_URL || 'redis://redis-external:6379';
  try {
    pubClient = createClient({ url: redisUrl });
    subClient = pubClient.duplicate();
    pubClient.on('error', (err) => console.error('[Socket Redis pubClient] Error:', err.message));
    subClient.on('error', (err) => console.error('[Socket Redis subClient] Error:', err.message));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Socket] ✅ Clustered Redis adapter connected');
  } catch (err) {
    console.error('[Socket] ❌ Redis adapter failed (falling back to in-memory):', err.message);
  }

  // ---------- Redis Pub/Sub listener for AI events ----------
  try {
    aiSubscriber = mainRedisClient.duplicate();
    aiSubscriber.on('error', (err) => console.error('[AI Pub/Sub] Redis error:', err.message));
    await aiSubscriber.connect();

    const AI_CHANNELS = ['ws:ai:chunk', 'ws:ai:response', 'ws:ai:error'];
    aiSubscriber.subscribe(AI_CHANNELS, (message, channel) => {
      try {
        const data = JSON.parse(message);
        const { userId, jobId, ...payload } = data;
        if (!userId) return;
        const eventName = channel.replace('ws:ai:', '');
        io.to(`user:${userId}`).emit(`ai:${eventName}`, { jobId, ...payload });
      } catch (err) {
        console.error('[AI Pub/Sub] Failed to parse message:', err.message);
      }
    });
    console.log('[Redis] ✅ AI Pub/Sub subscriber active');
  } catch (err) {
    console.error('[Redis] AI Pub/Sub subscriber connection error:', err.message);
  }

  // ---------- Redis Pub/Sub listener for live API logs ----------
  try {
    logSubscriber = mainRedisClient.duplicate();
    logSubscriber.on('error', (err) => {
      isRedisLogStreamActive = false;
      console.error('[Log Pub/Sub] Redis error:', err.message);
    });
    await logSubscriber.connect();

    logSubscriber.subscribe('ws:new_api_log', (message) => {
      try {
        const logData = JSON.parse(message);
        const targetProjectId = logData.projectId || logData.project_id;
        if (targetProjectId) {
          io.to(targetProjectId).emit('new_api_log', logData);
        } else {
          io.emit('new_api_log', logData);
        }

        // Cache invalidation for active stats
        if (targetProjectId && mainRedisClient && mainRedisClient.isOpen) {
          mainRedisClient.del(`latStats:${targetProjectId}:*`).catch(() => {});
        }
      } catch (err) {
        console.error('[Log Pub/Sub] Failed to parse log message:', err.message);
      }
    });
    isRedisLogStreamActive = true;
    console.log('[Redis] ✅ Real-time Log Pub/Sub subscriber active');
  } catch (err) {
    isRedisLogStreamActive = false;
    console.error('[Redis] Log Pub/Sub subscriber connection error:', err.message);
  }

  // ---------- Redis Pub/Sub listener for API history updates ----------
  try {
    historySubscriber = mainRedisClient.duplicate();
    historySubscriber.on('error', (err) => console.error('[History Pub/Sub] Redis error:', err.message));
    await historySubscriber.connect();

    historySubscriber.subscribe('api_history_update', (message) => {
      try {
        const { projectId } = JSON.parse(message);
        if (projectId) {
          io.to(projectId).emit('api_history_update', { projectId });
        }
      } catch (err) {
        console.error('[History Pub/Sub] Failed to parse message:', err.message);
      }
    });
    console.log('[Redis] ✅ API History Pub/Sub subscriber active');
  } catch (err) {
    console.error('[Redis] History Pub/Sub subscriber connection error:', err.message);
  }

  // ---------- BullMQ Queues ----------
  const queueConnection = {
    connection: {
      url: redisUrl,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    },
  };

  latencyQueue = new Queue('bullmq-latency-store', queueConnection);
  projectQueue = require('./queues/projectQueue');
  mockSyncQueue = require('./queues/mockSyncQueue');
  openapiImportQueue = require('./queues/importQueue');

  // Load Email Queue Worker
  require('./queues/emailQueue');
  console.log('[Queue] ✅ Background BullMQ queues & workers initialized');

  // ---------- CORS Configuration ----------
  const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [];
  const allowedOrigins = [
    process.env.CLIENT_URL,
    ...envOrigins,
    'http://localhost:8082',
    'http://localhost:5173',
    'http://localhost:8081',
    'http://localhost:3000',
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error('Cross-Origin Request Blocked by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Cookie',
        'X-Requested-With',
        'Accept',
        'x-guest-token',
        'x-auth-token',
        'x-csrf-token',
      ],
    })
  );

  app.use(express.json({ limit: '20mb' }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  // ---------- XSS Sanitization ----------
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
    if (req.body && !req.path.startsWith('/api/ask-ai') && !req.path.startsWith('/api/update-api')) {
      sanitize(req.body);
    }
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
  });

  // ---------- CSRF Protection ----------
  const { generateToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET,
    cookieName: 'x-csrf-token',
    cookieOptions: {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  });

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') return next();
    doubleCsrfProtection(req, res, next);
  });

  app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: generateToken(req, res) });
  });

  app.get(['/health', '/api/health'], (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // ================================================================
  // CONTROLLERS
  // ================================================================
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
  const { ask_ai, getAiResult } = require('./controllers/ask_ai');
  const delete_project = require('./controllers/delete_project');
  const subscribeRouter = require('./controllers/subscribeproject');
  const unsubscribeProject = require('./controllers/unsubscribeproject');
  const forgotPassword = require('./controllers/forgot_password');
  const verifyForgotOtp = require('./controllers/verify_forgot_otp');
  const resetPassword = require('./controllers/reset_password');
  const changePassword = require('./controllers/changePassword');

  // ================================================================
  // ROUTES REGISTRATION
  // ================================================================
  console.log('[Server] 📡 Registering API endpoints...');

  // Auth & Identity
  app.post('/api/isemailvalid', isemailvalid);
  app.post('/api/isvalidusername', isvalidusername);
  app.post('/api/setuser', setuser);
  app.post('/api/login', login);
  app.post('/api/logout', logout);
  app.post('/api/otp-resend', otp_resend);
  app.post('/api/otp-verify', otp_verify);
  app.get('/api/sync-auth', sync_auth);
  app.post('/api/guest-session', guest_session);
  app.post('/api/forgot-password', forgotPassword);
  app.post('/api/verify-forgot-otp', verifyForgotOtp);
  app.post('/api/reset-password', resetPassword);
  app.post('/api/change-password', authenticateToken, changePassword);

  // Subscriptions & Telemetry Access
  app.post('/api/subscribe', authenticateToken, subscribe);
  app.post('/api/unsubscribe', authenticateToken, unsubscribe);
  app.post('/api/subscribeproject', authenticateToken, subscribeRouter);
  app.post('/api/unsubscribeproject', authenticateToken, unsubscribeProject);

  // Workspaces & Projects
  app.post('/api/create-project', authenticateToken, create_project);
  app.post('/api/join-project', authenticateToken, join_project);
  app.get('/api/projects', authenticateToken, projects);
  app.patch('/api/projects/:projectId/status', authenticateToken, updateProjectStatus);
  app.post('/api/verify-project', authenticateToken, verify_project);
  app.post('/api/reset-invitation-code', authenticateToken, reset_invitation_code);
  app.post('/api/verify-invitationcode-otp', authenticateToken, verify_invitationcode_otp);
  app.delete('/api/deleteproject', authenticateToken, delete_project);

  // Invitations & Requests
  app.get('/api/requests/received', authenticateToken, get_received_requests);
  app.get('/api/requests/sent', authenticateToken, get_sent_requests);
  app.post('/api/requests/accept/:requestId', authenticateToken, approve_project_request);
  app.delete('/api/requests/revoke/:requestId', authenticateToken, revoke_request);

  // API Versioning & Endpoints
  app.get('/api/user-apis', authenticateToken, get_user_apis);
  app.post('/api/update-api', authenticateToken, update_api);
  app.post('/api/add-api', authenticateToken, add_api);
  app.post('/api/api-version-data', authenticateToken, api_version_data);
  app.get('/api/api-history', authenticateToken, api_history);
  app.delete('/api/versions/delete/:versionId', authenticateToken, delete_api_version);

  // AI Generation & Rollback
  app.post('/api/ask-ai', authenticateToken, ask_ai);
  app.get('/api/ai-result/:jobId', authenticateToken, getAiResult);
  app.post('/api/reverse-ai', authenticateToken, reverse_ai);

  // Telemetry Logs & OpenAPI Importer
  app.post('/api/logs', authenticateToken, logs);
  app.use('/api', importRoutes);

  // Latency & Real-Time Analytics
  app.get('/api/latency-test', (req, res) => {
    res.json({ timestamp: Date.now() });
  });

  app.post('/api/latency-report', authenticateToken, async (req, res) => {
    try {
      const { project_id, rtts } = req.body;
      if (!project_id) {
        return res.status(400).json({ error: 'Missing project_id' });
      }

      let avgRtt;
      if (Array.isArray(rtts) && rtts.length > 0) {
        const sum = rtts.reduce((a, b) => a + b, 0);
        avgRtt = Math.round(sum / rtts.length);
      } else if (typeof rtts === 'number') {
        avgRtt = Math.round(rtts);
      } else {
        return res.status(400).json({ error: 'Invalid rtts, expected array or number' });
      }

      const username = req.user.username;

      // 1. Update User latency field
      await User.findOneAndUpdate({ username }, { latency: avgRtt }, { new: true });

      // 2. Update TeamLatency
      let teamLat = await TeamLatency.findOne({ project_id, username });
      if (teamLat) {
        const total = teamLat.averageRtt * teamLat.sampleCount + avgRtt;
        teamLat.sampleCount += 1;
        teamLat.averageRtt = Math.round(total / teamLat.sampleCount);
        await teamLat.save();
      } else {
        teamLat = await TeamLatency.create({
          project_id,
          username,
          averageRtt: avgRtt,
          sampleCount: 1,
        });
      }

      // 3. Recalculate global ProjectLatency
      const allTeamLatencies = await TeamLatency.find({ project_id });
      let projectAvg = null;
      if (allTeamLatencies.length > 0) {
        const total = allTeamLatencies.reduce((sum, doc) => sum + doc.averageRtt, 0);
        projectAvg = Math.round(total / allTeamLatencies.length);

        await ProjectLatency.findOneAndUpdate(
          { project_id },
          {
            averageRtt: projectAvg,
            sampleCount: allTeamLatencies.length,
          },
          { upsert: true, new: true }
        );
      }

      // Enqueue to OpenResty sync queue
      if (projectAvg !== null && projectAvg > 0) {
        latencyQueue.add('update-project-avg', {
          project_id,
          averageRtt: projectAvg,
        }).catch(() => {});
      }

      latencyQueue.add('store-member-latency', {
        project_id,
        username,
        rtt: avgRtt,
      }).catch(() => {});

      return res.json({
        success: true,
        userLatency: avgRtt,
        teamLatency: teamLat.averageRtt,
        projectAverage: projectAvg,
      });
    } catch (err) {
      console.error('[API] Error in latency-report:', err);
      return res.status(500).json({ error: 'Failed to record latency report' });
    }
  });

  // ---- DASHBOARD DATA ----
  app.get('/api/dashboard-data', authenticateToken, async (req, res) => {
    const username = req.user.username;
    try {
      const cacheKey = `dashboard:${username}`;
      if (mainRedisClient && mainRedisClient.isOpen) {
        try {
          const cached = await mainRedisClient.get(cacheKey);
          if (cached) return res.json(JSON.parse(cached));
        } catch (_) {}
      }

      const userProjects = await Project.find({
        $or: [{ username }, { members: username }],
      }).lean();

      if (userProjects.length === 0) {
        return res.json({ projects: [] });
      }

      const projectIds = userProjects.map((p) => p.id);

      const [latencyDocs, histories] = await Promise.all([
        ProjectLatency.find({ project_id: { $in: projectIds } }).lean(),
        ProjectApiHistory.find({ projectID: { $in: projectIds } }).lean(),
      ]);

      const latencyMap = new Map(latencyDocs.map((d) => [d.project_id, d]));
      const historyMap = new Map(histories.map((h) => [h.projectID, h]));

      const rttKeys = projectIds.map((id) => `latency:${id}:${username}`);
      const networkRttMap = new Map();
      if (mainRedisClient && mainRedisClient.isOpen) {
        try {
          const pipeline = mainRedisClient.multi();
          rttKeys.forEach((key) => pipeline.get(key));
          const rttResults = await pipeline.exec();
          projectIds.forEach((id, idx) => {
            const val = rttResults[idx]?.[1];
            if (val) networkRttMap.set(id, parseInt(val, 10));
          });
        } catch (_) {}
      }

      let latStatsMap = new Map();
      try {
        latStatsMap = await aggregateAllLatencies(projectIds);
      } catch (_) {}

      const enriched = userProjects.map((project) => {
        const rttDoc = latencyMap.get(project.id);
        const projectRtt = rttDoc ? rttDoc.averageRtt : null;
        const userRtt = networkRttMap.get(project.id) ?? null;

        const history = historyMap.get(project.id);
        const endpoints = history ? history.endpoints : [];

        const apisWithLatency = endpoints.map((endpoint) => {
          const versionsWithLatency = (endpoint.versions || []).map((ver) => {
            const key = `${project.id}::${ver.urlPath}::${ver.method}`;
            const serverLatency = latStatsMap.get(key) || 0;
            const totalLatency = userRtt !== null ? serverLatency + userRtt : serverLatency;
            return {
              version: ver.version,
              label: ver.version,
              latency: totalLatency,
              urlPath: ver.urlPath,
            };
          });

          const primaryVer = (endpoint.versions && endpoint.versions[0]) || {};
          return {
            id: endpoint._id,
            path: endpoint.baseUrlPath,
            method: primaryVer.method || 'GET',
            versions: versionsWithLatency,
          };
        });

        return {
          id: project.id,
          name: project.projectname,
          averageRtt: projectRtt,
          apis: apisWithLatency,
        };
      });

      const response = { projects: enriched };
      if (mainRedisClient && mainRedisClient.isOpen) {
        try {
          await mainRedisClient.setEx(cacheKey, 15, JSON.stringify(response));
        } catch (_) {}
      }
      return res.json(response);
    } catch (err) {
      console.error('[API] Error in dashboard-data:', err);
      return res.status(500).json({ error: err.message || 'Failed to load dashboard data' });
    }
  });

  // ---- LATENCY STATS ----
  app.get('/api/latency-stats', authenticateToken, async (req, res) => {
    const { project_id, path, method } = req.query;
    const range = req.query.range || '6h';

    try {
      if (!project_id || !path || !method) {
        return res.status(400).json({ error: 'Missing project_id, path, or method' });
      }

      const since = new Date(Date.now() - resolveTimeWindow(range));
      const cacheKey = `latStats:${project_id}:${path}:${method}:${range}`;

      if (mainRedisClient && mainRedisClient.isOpen) {
        try {
          const cached = await mainRedisClient.get(cacheKey);
          if (cached) return res.json(JSON.parse(cached));
        } catch (_) {}
      }

      const pipeline = [
        {
          $match: {
            project_id,
            path,
            method: method.toUpperCase(),
            timestamp: { $gte: since },
          },
        },
        {
          $group: {
            _id: {
              $toDate: {
                $subtract: [
                  { $toLong: '$timestamp' },
                  { $mod: [{ $toLong: '$timestamp' }, 1000 * 60 * 5] },
                ],
              },
            },
            avgLatency: {
              $avg: { $ifNull: ['$total_latency', { $ifNull: ['$latency_ms', 0] }] },
            },
            requests: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            time: { $dateToString: { format: '%Y-%m-%dT%H:%M:%S.000Z', date: '$_id' } },
            latency: { $round: ['$avgLatency', 0] },
            requests: 1,
          },
        },
      ];

      const points = await ApiCallLog.aggregate(pipeline);
      const response = { points };

      if (mainRedisClient && mainRedisClient.isOpen) {
        try {
          await mainRedisClient.setEx(cacheKey, 30, JSON.stringify(response));
        } catch (_) {}
      }
      return res.json(response);
    } catch (err) {
      console.error('[API] Error in latency-stats:', err);
      return res.status(500).json({ error: err.message || 'Failed to fetch latency stats' });
    }
  });

  // ---- RECENT API CALL LOGS ----
  app.get('/api/recent-logs', authenticateToken, async (req, res) => {
    const { project_id } = req.query;
    try {
      if (!project_id) {
        return res.status(400).json({ error: 'Missing project_id' });
      }
      const recentLogs = await ApiCallLog.find({ project_id })
        .sort({ timestamp: -1 })
        .limit(30)
        .lean();
      return res.json({ logs: recentLogs || [] });
    } catch (err) {
      console.error('[API] Error in recent-logs:', err);
      return res.status(500).json({ error: err.message || 'Failed to fetch recent logs' });
    }
  });

  // Root status
  app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'MockAPI Microservice Engine Running' });
  });

  // ================================================================
  // SOCKET.IO REAL-TIME EVENTS
  // ================================================================
  let lastCheckedTime = new Date();

  io.engine.on('connection_error', (err) => {
    console.error('[Socket] Connection handshake warning:', err.message);
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
        const cacheKey = `initial_logs:${projectId}`;
        let cachedLogs = null;
        if (pubClient && pubClient.isOpen) {
          const cached = await pubClient.get(cacheKey);
          if (cached) {
            try {
              cachedLogs = JSON.parse(cached);
            } catch (_) {}
          }
        }
        if (!cachedLogs) {
          cachedLogs = await SystemEventLog.find({ projectId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
          if (pubClient && pubClient.isOpen && cachedLogs.length > 0) {
            await pubClient.setEx(cacheKey, 30, JSON.stringify(cachedLogs));
          }
        }
        socket.emit('initial_logs', cachedLogs || []);
      } catch (err) {
        console.error('[Socket] Error loading initial logs:', err.message);
        socket.emit('initial_logs', []);
      }
    });

    socket.on('leave_project', (projectId) => {
      if (projectId) {
        socket.leave(projectId);
      }
    });
  });

  // Heartbeat keep-alive
  const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL, 10) || 60000;
  heartbeatInterval = setInterval(() => {
    io.emit('heartbeat', { timestamp: Date.now() });
  }, HEARTBEAT_INTERVAL);

  // Fallback Polling Worker (Activates strictly if Redis Pub/Sub stream is interrupted)
  const LOG_POLLING_INTERVAL = parseInt(process.env.LOG_POLLING_INTERVAL, 10) || 30000;
  dataPollingInterval = setInterval(async () => {
    if (isRedisLogStreamActive) return; // Redis Pub/Sub handles active delivery
    const now = new Date();
    try {
      const missedLogs = await SystemEventLog.find({ createdAt: { $gt: lastCheckedTime } })
        .sort({ createdAt: 1 })
        .lean();
      if (missedLogs.length) {
        const logsByProject = {};
        missedLogs.forEach((log) => {
          if (!logsByProject[log.projectId]) logsByProject[log.projectId] = [];
          logsByProject[log.projectId].push(log);
        });
        for (const [projectId, projectLogs] of Object.entries(logsByProject)) {
          projectLogs.forEach((l) => io.to(projectId).emit('new_api_log', l));
        }
      }
      lastCheckedTime = now;
    } catch (err) {
      console.error('[Socket Polling Fallback] Error:', err.message);
    }
  }, LOG_POLLING_INTERVAL);

  // ================================================================
  // GRACEFUL SHUTDOWN
  // ================================================================
  const gracefulShutdown = async () => {
    console.log('[Server] 🔴 Shutting down gracefully...');
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (dataPollingInterval) clearInterval(dataPollingInterval);

    if (latencyQueue) await latencyQueue.close().catch(() => {});
    if (projectQueue) await projectQueue.close().catch(() => {});
    if (mockSyncQueue) await mockSyncQueue.close().catch(() => {});
    if (openapiImportQueue) await openapiImportQueue.close().catch(() => {});

    if (pubClient) await pubClient.quit().catch(() => {});
    if (subClient) await subClient.quit().catch(() => {});
    if (mainRedisClient) await mainRedisClient.quit().catch(() => {});
    if (aiSubscriber) await aiSubscriber.quit().catch(() => {});
    if (logSubscriber) await logSubscriber.quit().catch(() => {});
    if (historySubscriber) await historySubscriber.quit().catch(() => {});

    server.close(() => {
      console.log('[Server] ✅ Shutdown complete');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[Server] ⏰ Forced shutdown timeout');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`[Server] ✅ Listening on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('[Server] ❌ Fatal startup error:', err);
  process.exit(1);
});