require('dotenv').config();
require('./opentelemetry/universal-logger');  // <-- Add this line FIRST

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const xss = require('xss');
const { doubleCsrf } = require('csrf-csrf');
const multer = require('multer');
const { Queue } = require('bullmq');
const { v4: uuidv4 } = require('uuid');
const yaml = require('js-yaml');

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
console.log('[Server] 📌 Environment variables:');
console.log(`  - PORT: ${process.env.PORT || 3000}`);
console.log(`  - CLIENT_URL: ${process.env.CLIENT_URL || 'http://localhost:8082'}`);
console.log(`  - REDIS_URL: ${process.env.REDIS_URL ? '✅ set' : '❌ missing'}`);
console.log(`  - MONGO_URI: ${process.env.MONGO_URI ? '✅ set' : '❌ missing'}`);
console.log(`  - CSRF_SECRET: ${process.env.CSRF_SECRET ? '✅ set' : '❌ missing'}`);

// ================================================================
// TIME WINDOW HELPER (shared by dashboard + latency-stats)
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
// 🚀 SOCKET.IO
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
console.log('[Socket] ✅ Socket.IO server initialized');

let pubClient, subClient; // may remain undefined if adapter fails
let mainRedisClient;
let aiSubscriber, logSubscriber, historySubscriber;
let latencyQueue, projectQueue, mockSyncQueue, openapiImportQueue;
let heartbeatInterval, dataPollingInterval;

// -----------------------------------------------------------------
//  HELPER: aggregateAllLatencies
//  Returns a Map of "projectId::path::method" -> avg latency (ms)
//  over the last 24h, based on total_latency (server + team + user).
// -----------------------------------------------------------------
async function aggregateAllLatencies(projectIds) {
  console.log(`[DB] aggregateAllLatencies called for ${projectIds.length} projects`);
  if (!projectIds || projectIds.length === 0) {
    console.log('[DB] No project IDs provided, returning empty map');
    return new Map();
  }

  try {
    const stats = await ApiCallLog.aggregate([
      {
        $match: {
          project_id: { $in: projectIds },
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            project_id: '$project_id',
            path: '$path',
            method: '$method'
          },
          avgLatency: { $avg: { $ifNull: ['$total_latency', '$latency_ms'] } }
        }
      }
    ]);
    console.log(`[DB] aggregateAllLatencies returned ${stats.length} aggregated entries`);

    const map = new Map();
    for (const s of stats) {
      const key = `${s._id.project_id}::${s._id.path}::${s._id.method}`;
      map.set(key, Math.round(s.avgLatency));
    }
    return map;
  } catch (err) {
    console.error('[DB] aggregateAllLatencies error:', err);
    return new Map();
  }
}

// ================================================================
// START SERVER
// ================================================================
const startServer = async () => {
  // --- Check critical environment variables ---
  if (!process.env.CSRF_SECRET) {
    console.error('[FATAL] CSRF_SECRET is not set in environment');
    process.exit(1);
  }
  if (!process.env.CLIENT_URL) {
    console.warn('[WARN] CLIENT_URL   not set, defaulting to http://localhost:8082');
  }

  console.log('[Server] 🔌 Connecting to MongoDB...');
  await connectDB();
  console.log('[Server] ✅ MongoDB connected');

  console.log('[Server] 🔌 Connecting to Redis...');
  mainRedisClient = await connectRedis();
  console.log('[Server] ✅ Redis  connected');

  // -------------- Redis adapter for Socket.IO (multi-instance scaling) ----------
  try {
    console.log('[Socket] Setting up Redis adapter...');
    pubClient = createClient({ url: process.env.REDIS_URL });
    subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Socket] ✅ Redis adapter connected');
  } catch (err) {
    console.error('[Socket] ❌ Redis adapter failed (non-fatal):', err.message);
  }

  // ---------- Redis Pub/Sub listener for AI events ----------
  console.log('[Redis] Setting up AI Pub/Sub listener...');
  aiSubscriber = mainRedisClient.duplicate();
  await aiSubscriber.connect();

  const AI_CHANNELS = ['ws:ai:chunk', 'ws:ai:response', 'ws:ai:error'];
  aiSubscriber.subscribe(AI_CHANNELS, (message, channel) => {
    try {
      const data = JSON.parse(message);
      const { userId, jobId, ...payload } = data;
      if (!userId) {
        console.warn('[AI Pub/Sub] Missing userId in message:', data);
        return;
      }
      const eventName = channel.replace('ws:ai:', '');
      console.log(`[AI Pub/Sub] Emitting ai:${eventName} to user:${userId}`);
      io.to(`user:${userId}`).emit(`ai:${eventName}`, { jobId, ...payload });
    } catch (err) {
      console.error('[AI Pub/Sub] Failed to parse message:', err);
    }
  });
  aiSubscriber.on('error', (err) => console.error('[AI Pub/Sub] Redis error:', err));
  console.log('[Redis] ✅ AI Pub/Sub listener started');

  // ---------- Redis Pub/Sub listener for new API logs (real-time dashboard) ----------
  console.log('[Redis] Setting up log Pub/Sub listener...');
  logSubscriber = mainRedisClient.duplicate();
  await logSubscriber.connect();

  logSubscriber.subscribe('ws:new_api_log', (message) => {
    try {
      const logData = JSON.parse(message);
      console.log('[Redis] 📨 Received new_api_log:', logData);
      io.emit('new_api_log', logData);
    } catch (err) {
      console.error('[Log Pub/Sub] Failed to parse log message:', err);
    }
  });
  logSubscriber.on('error', (err) => console.error('[Log Pub/Sub] Redis error:', err));
  console.log('[Redis] ✅ Log Pub/Sub listener started');

  // ---------- 🆕 Redis Pub/Sub listener for API history updates ----------
  console.log('[Redis] Setting up API history Pub/Sub listener...');
  historySubscriber = mainRedisClient.duplicate();
  await historySubscriber.connect();

  historySubscriber.subscribe('api_history_update', (message) => {
    try {
      const { projectId } = JSON.parse(message);
      console.log(`[Redis] 📨 API history update for project ${projectId}`);
      io.to(projectId).emit('api_history_update', { projectId });
    } catch (err) {
      console.error('[History Pub/Sub] Failed to parse message:', err);
    }
  });
  historySubscriber.on('error', (err) => console.error('[History Pub/Sub] Redis error:', err));
  console.log('[Redis] ✅ API history Pub/Sub listener started');

  // ---------- BullMQ queues ----------
  console.log('[Queue] Initializing BullMQ queues...');
  const queueConnection = { connection: { url: process.env.REDIS_URL } };

  latencyQueue = new Queue('bullmq-latency-store', queueConnection);
  projectQueue = new Queue('projectQueue', queueConnection);
  mockSyncQueue = new Queue('mockSyncQueue', queueConnection);
  openapiImportQueue = new Queue('openapi-import', queueConnection);

  console.log('[Queue] ✅ Queues initialized: latency-store, projectQueue, mockSyncQueue, openapi-import');

  // Load email worker (just requires the file, the worker starts automatically)
  require('./queues/emailQueue');
  console.log('[Queue] ✅ Emaill worker loaded');

  // ---------- CORS ---------------
  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:8082',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
  }));

  app.use(express.json());
  app.use(cookieParser());
  app.use((req, res, next) => { req.io = io; next(); });

  // ---------- XSS sanitization ----------
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

  // ---------- CSRF Protection ----------
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

  // ================================================================
  // CONTROLLERS (imports)
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

  // ================================================================
  // ROUTES
  // ================================================================
  console.log('[Server] 📡 Registering routes...');

  // Auth routes
  app.post('/api/isemailvalid', isemailvalid);
  app.post('/api/isvalidusername', isvalidusername);
  app.post('/api/setuser', setuser);
  app.post('/api/login', login);
  app.post('/api/logout', logout);
  app.post('/api/otp-resend', otp_resend);
  app.post('/api/otp-verify', otp_verify);
  app.get('/api/sync-auth', sync_auth);
  app.post('/api/guest-session', guest_session);

  app.post('/api/subscribe', authenticateToken, subscribe);
  app.post('/api/unsubscribe', authenticateToken, unsubscribe);

  app.post('/api/create-project', authenticateToken, create_project);
  app.post('/api/join-project', authenticateToken, join_project);
  app.get('/api/projects', authenticateToken, projects);
  app.patch('/api/projects/:projectId/status', authenticateToken, updateProjectStatus);
  app.post('/api/verify-project', authenticateToken, verify_project);
  app.post('/api/reset-invitation-code', authenticateToken, reset_invitation_code);
  app.post('/api/verify-invitationcode-otp', authenticateToken, verify_invitationcode_otp);
  app.delete('/api/deleteproject', authenticateToken, delete_project);

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
  app.get('/api/ai-result/:jobId', authenticateToken, getAiResult);
  app.post('/api/reverse-ai', authenticateToken, reverse_ai);

  app.post('/api/logs', authenticateToken, logs);

  app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });

  const upload = multer({ storage: multer.memoryStorage() });

  // ---- LATENCY TEST ----
  app.get('/api/latency-test', (req, res) => {
    res.json({ timestamp: Date.now() });
  });

  // ---- LATENCY REPORT ----
  app.post('/api/latency-report', authenticateToken, async (req, res) => {
    console.log(`[API] POST /api/latency-report (user: ${req.user.username})`, req.body);
    try {
      const { project_id, rtts } = req.body;
      if (!project_id) {
        console.warn('[API] Missing project_id in latency-report');
        return res.status(400).json({ error: 'Missing project_id' });
      }

      let avgRtt;
      if (Array.isArray(rtts) && rtts.length > 0) {
        const sum = rtts.reduce((a, b) => a + b, 0);
        avgRtt = Math.round(sum / rtts.length);
      } else if (typeof rtts === 'number') {
        avgRtt = Math.round(rtts);
      } else {
        console.warn('[API] Invalid rtts format:', rtts);
        return res.status(400).json({ error: 'Invalid rtts, expected array or number' });
      }
      console.log(`[API] Computed avgRtt: ${avgRtt}ms`);

      const username = req.user.username;

      // 1. Update User's latency field
      console.log(`[DB] Updating user ${username} latency to ${avgRtt}`);
      const user = await User.findOneAndUpdate(
        { username },
        { latency: avgRtt },
        { new: true }
      );
      if (!user) {
        console.warn(`[DB] User ${username} not found`);
      } else {
        console.log(`[DB] User ${username} updated`);
      }

      // 2. Update or create TeamLatency for this user + project
      console.log(`[DB] Updating TeamLatency for ${username} in project ${project_id}`);
      let teamLat = await TeamLatency.findOne({ project_id, username });
      if (teamLat) {
        const total = teamLat.averageRtt * teamLat.sampleCount + avgRtt;
        teamLat.sampleCount += 1;
        teamLat.averageRtt = Math.round(total / teamLat.sampleCount);
        await teamLat.save();
        console.log(`[DB] TeamLatency updated: avg=${teamLat.averageRtt}, samples=${teamLat.sampleCount}`);
      } else {
        teamLat = await TeamLatency.create({
          project_id,
          username,
          averageRtt: avgRtt,
          sampleCount: 1,
        });
        console.log(`[DB] TeamLatency created: avg=${avgRtt}`);
      }

      // 3. Recalculate global ProjectLatency
      console.log(`[DB] Recalculating ProjectLatency for project ${project_id}`);
      const allTeamLatencies = await TeamLatency.find({ project_id });
      let projectAvg = null;
      if (allTeamLatencies.length > 0) {
        const total = allTeamLatencies.reduce((sum, doc) => sum + doc.averageRtt, 0);
        projectAvg = Math.round(total / allTeamLatencies.length);
        console.log(`[DB] ProjectLatency computed: ${projectAvg}ms from ${allTeamLatencies.length} members`);

        await ProjectLatency.findOneAndUpdate(
          { project_id },
          {
            averageRtt: projectAvg,
            sampleCount: allTeamLatencies.length,
          },
          { upsert: true, new: true }
        );
      }

      // 4. Enqueue a job for further processing
      console.log(`[Queue] Adding latency job to bullmq-latency-store for ${username}`);
      latencyQueue.add('store-member-latency', {
        project_id,
        username,
        rtt: avgRtt,
      }).catch(err => console.error('[Queue] Failed to add latency job:', err));

      res.json({
        success: true,
        userLatency: avgRtt,
        teamLatency: teamLat.averageRtt,
        projectAverage: projectAvg,
      });

    } catch (err) {
      console.error('[API] Error in latency-report:', err);
      res.status(500).json({ error: 'Failed to save latency report' });
    }
  });

  // ================================================================
  //  ASYNC OPENAPI IMPORT WITH JOB ID
  // ================================================================
  app.post('/api/import-openapi', authenticateToken, upload.single('file'), async (req, res) => {
    console.log(`[API] POST /api/import-openapi (user: ${req.user.username}), file: ${req.file?.originalname}`);
    try {
      if (!req.file) {
        console.warn('[API] No file uploaded');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname || '';
      const isJson = fileName.endsWith('.json') || (req.file.mimetype === 'application/json');
      console.log(`[API] Parsing ${isJson ? 'JSON' : 'YAML'} file: ${fileName}`);

      let spec;
      try {
        spec = isJson
          ? JSON.parse(fileBuffer.toString('utf-8'))
          : yaml.load(fileBuffer.toString('utf-8'));
        console.log('[API] Spec parsed successfully');
      } catch (parseErr) {
        console.error('[API] Parse error:', parseErr);
        return res.status(400).json({ error: 'Invalid file format: ' + parseErr.message });
      }
      if (!spec || !spec.paths) {
        console.warn('[API] No paths found in spec');
        return res.status(400).json({ error: 'No paths found in OpenAPI spec' });
      }

      // ✅ FIX: Use UI-provided project name; fall back to spec title if not provided
      const projectName = req.body.projectName?.trim() || spec.info?.title || 'Imported Project';
      console.log(`[API] Using project name: "${projectName}"`);

      // Enqueue job to openapi-import queue
      const job = await openapiImportQueue.add('import', {
        projectName,
        spec,
        username: req.user.username,
      });

      console.log(`[API] Enqueued import job ${job.id} for project "${projectName}"`);
      res.status(202).json({
        jobId: job.id,
        message: 'Import job queued. Poll /api/import-status/:jobId for progress.'
      });
    } catch (err) {
      console.error('[API] Error in import-openapi:', err);
      res.status(500).json({ error: 'Failed to queue import: ' + err.message });
    }
  });

  // ---- IMPORT STATUS ENDPOINT ----
  app.get('/api/import-status/:jobId', authenticateToken, async (req, res) => {
    const { jobId } = req.params;
    console.log(`[API] GET /api/import-status/${jobId} (user: ${req.user.username})`);

    try {
      const job = await openapiImportQueue.getJob(jobId);
      if (!job) {
        console.warn(`[API] Job ${jobId} not found`);
        return res.status(404).json({ error: 'Job not found' });
      }

      const state = await job.getState();
      const progress = job.progress || 0;
      const result = job.returnvalue;

      let status = 'processing';
      let message = 'Processing...';
      let detail = '';

      if (state === 'completed') {
        status = 'completed';
        message = '✅ Import completed successfully';
        detail = result ? `Imported ${result.endpoints} endpoints from ${result.name}` : '';
      } else if (state === 'failed') {
        status = 'failed';
        message = '❌ Import failed';
        detail = job.failedReason || 'Unknown error';
      } else if (state === 'waiting' || state === 'active' || state === 'delayed') {
        status = 'processing';
        message = `⏳ Import in progress (${Math.round(progress)}%)`;
        detail = 'The import job is being processed.';
      } else {
        status = 'unknown';
        message = `Job state: ${state}`;
      }

      res.json({
        jobId,
        status,
        progress,
        message,
        detail,
        result: state === 'completed' ? result : undefined,
      });
    } catch (err) {
      console.error('[API] Error checking status:', err);
      res.status(500).json({ error: 'Failed to check job status' });
    }
  });

  // ---- DASHBOARD DATA ----
  app.get('/api/dashboard-data', authenticateToken, async (req, res) => {
    const username = req.user.username;
    console.log(`[API] GET /api/dashboard-data (user: ${username})`);
    try {
      const cacheKey = `dashboard:${username}`;
      if (mainRedisClient) {
        const cached = await mainRedisClient.get(cacheKey);
        if (cached) {
          console.log(`[Redis] Cache hit for ${cacheKey}`);
          return res.json(JSON.parse(cached));
        }
        console.log(`[Redis] Cache miss for ${cacheKey}`);
      }

      console.log(`[DB] Fetching projects for user ${username}`);
      const projects = await Project.find({
        $or: [{ username }, { members: username }]
      }).lean();
      console.log(`[DB] Found ${projects.length} projects`);

      if (projects.length === 0) {
        return res.json({ projects: [] });
      }

      const projectIds = projects.map(p => p.id);
      console.log(`[DB] Project IDs: ${projectIds.join(', ')}`);

      // Fetch latencies
      const latencyDocs = await ProjectLatency.find({
        project_id: { $in: projectIds }
      }).lean();
      const latencyMap = new Map(latencyDocs.map(d => [d.project_id, d]));

      const histories = await ProjectApiHistory.find({
        projectID: { $in: projectIds }
      }).lean();
      const historyMap = new Map(histories.map(h => [h.projectID, h]));

      // Fetch user RTT from Redis
      const rttKeys = projectIds.map(id => `latency:${id}:${username}`);
      const networkRttMap = new Map();
      if (mainRedisClient) {
        console.log(`[Redis] Fetching RTT for keys: ${rttKeys.join(', ')}`);
        const pipeline = mainRedisClient.multi();
        rttKeys.forEach(key => pipeline.get(key));
        const rttResults = await pipeline.exec();
        projectIds.forEach((id, idx) => {
          const val = rttResults[idx]?.[1];
          if (val) {
            networkRttMap.set(id, parseInt(val, 10));
            console.log(`[Redis] RTT for ${id}: ${val}ms`);
          }
        });
      }

      // Aggregate server latencies
      const latStatsMap = await aggregateAllLatencies(projectIds);

      // Enrich projects
      const enriched = projects.map(project => {
        const rttDoc = latencyMap.get(project.id);
        const projectRtt = rttDoc ? rttDoc.averageRtt : null;
        const userRtt = networkRttMap.get(project.id) ?? null;

        const history = historyMap.get(project.id);
        const endpoints = history ? history.endpoints : [];

        const apisWithLatency = endpoints.map(endpoint => {
          const versionsWithLatency = endpoint.versions.map(ver => {
            const key = `${project.id}::${ver.urlPath}::${ver.method}`;
            const serverLatency = latStatsMap.get(key) || 0;
            const totalLatency = userRtt !== null ? serverLatency + userRtt : serverLatency;
            return {
              version: ver.version,
              label: ver.version,
              latency: totalLatency,
              urlPath: ver.urlPath
            };
          });

          const primaryVer = endpoint.versions[0] || {};
          return {
            id: endpoint._id,
            path: endpoint.baseUrlPath,
            method: primaryVer.method || 'GET',
            versions: versionsWithLatency
          };
        });

        return {
          id: project.id,
          name: project.projectname,
          averageRtt: projectRtt,
          apis: apisWithLatency
        };
      });

      const response = { projects: enriched };
      if (mainRedisClient) {
        await mainRedisClient.setEx(cacheKey, 15, JSON.stringify(response));
        console.log(`[Redis] Cached dashboard data for ${cacheKey}`);
      }
      res.json(response);
    } catch (err) {
      console.error('[API] Error in dashboard-data:', err);
      res.status(500).json({ error: 'Failed to load dashboard data' });
    }
  });

  // ---- LATENCY STATS ----
  app.get('/api/latency-stats', authenticateToken, async (req, res) => {
    const { project_id, path, method } = req.query;
    const range = req.query.range || '6h';
    console.log(`[API] GET /api/latency-stats (user: ${req.user.username}) – project: ${project_id}, path: ${path}, method: ${method}, range: ${range}`);

    try {
      if (!project_id || !path || !method) {
        console.warn('[API] Missing query params');
        return res.status(400).json({ error: 'Missing project_id, path, or method' });
      }

      const since = new Date(Date.now() - resolveTimeWindow(range));
      console.log(`[API] Fetching stats since ${since.toISOString()}`);

      const cacheKey = `latStats:${project_id}:${path}:${method}:${range}`;
      if (mainRedisClient) {
        const cached = await mainRedisClient.get(cacheKey);
        if (cached) {
          console.log(`[Redis] Cache hit for ${cacheKey}`);
          return res.json(JSON.parse(cached));
        }
        console.log(`[Redis] Cache miss for ${cacheKey}`);
      }

      const pipeline = [
        {
          $match: {
            project_id,
            path,
            method: method.toUpperCase(),
            timestamp: { $gte: since }
          }
        },
        {
          $group: {
            _id: {
              $toDate: {
                $subtract: [
                  { $toLong: '$timestamp' },
                  { $mod: [{ $toLong: '$timestamp' }, 1000 * 60 * 5] }
                ]
              }
            },
            avgLatency: { $avg: { $ifNull: ['$total_latency', '$latency_ms'] } },
            requests: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            time: { $dateToString: { format: '%Y-%m-%dT%H:%M:%S.000Z', date: '$_id' } },
            latency: { $round: ['$avgLatency', 0] },
            requests: 1
          }
        }
      ];

      console.log(`[DB] Executing latency stats aggregation for project ${project_id}`);
      const points = await ApiCallLog.aggregate(pipeline);
      console.log(`[DB] Got ${points.length} data points`);
      const response = { points };

      if (mainRedisClient) {
        await mainRedisClient.setEx(cacheKey, 30, JSON.stringify(response));
        console.log(`[Redis] Cached latency stats for ${cacheKey}`);
      }
      res.json(response);
    } catch (err) {
      console.error('[API] Error in latency-stats:', err);
      res.status(500).json({ error: 'Failed to fetch latency stats' });
    }
  });

  // ---- ASYNC IMPORT ROUTES (legacy, kept for compatibility) ----
  app.use('/api', importRoutes);

  // ================================================================
  // SOCKET.IO EVENTS
  // ================================================================
  let lastCheckedTime = new Date();

  io.engine.on('connection_error', (err) => {
    console.error('[Socket] Handshake error:', err.message, err.context);
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    socket.on('join_room', (roomName) => {
      if (roomName && typeof roomName === 'string') {
        socket.join(roomName);
        console.log(`[Socket] ${socket.id} joined room ${roomName}`);
      }
    });

    socket.on('join_project', async (projectId) => {
      if (!projectId) return;
      socket.join(projectId);
      console.log(`[Socket] ${socket.id} joined project room ${projectId}`);
      try {
        const cacheKey = `initial_logs:${projectId}`;
        let logs = null;
        if (pubClient) {
          const cached = await pubClient.get(cacheKey);
          if (cached) logs = JSON.parse(cached);
          console.log(`[Socket] ${cached ? 'Cache hit' : 'Cache miss'} for ${cacheKey}`);
        }
        if (!logs) {
          logs = await SystemEventLog.find({ projectId })
            .sort({ createdAt: -1 })
            .limit(50);
          console.log(`[Socket] Fetched ${logs.length} logs from DB`);
          if (pubClient) {
            await pubClient.setEx(cacheKey, 30, JSON.stringify(logs));
          }
        }
        socket.emit('initial_logs', logs);
      } catch (err) {
        console.error('[Socket] Error fetching logs:', err);
        socket.emit('initial_logs', []);
      }
    });

    socket.on('leave_project', (projectId) => {
      if (projectId) {
        socket.leave(projectId);
        console.log(`[Socket] ${socket.id} left project room ${projectId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL, 10) || 60000;
  heartbeatInterval = setInterval(() => {
    io.emit('heartbeat', { timestamp: Date.now() });
  }, HEARTBEAT_INTERVAL);
  console.log(`[Socket] Heartbeat interval set to ${HEARTBEAT_INTERVAL}ms`);

  const LOG_POLLING_INTERVAL = parseInt(process.env.LOG_POLLING_INTERVAL, 10) || 30000;
  dataPollingInterval = setInterval(async () => {
    const now = new Date();
    try {
      const newLogs = await SystemEventLog.find({ createdAt: { $gt: lastCheckedTime } })
        .sort({ createdAt: 1 });
      if (newLogs.length) {
        console.log(`[Socket] Polling found ${newLogs.length} new logs`);
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
      console.error('[Socket] Polling error:', err.message);
    }
  }, LOG_POLLING_INTERVAL);
  console.log(`[Socket] Log polling interval set to ${LOG_POLLING_INTERVAL}ms`);

  // ================================================================
  // GRACEFUL SHUTDOWN
  // ================================================================
  const gracefulShutdown = async () => {
    console.log('[Server] 🔴 Shutting down gracefully...');
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (dataPollingInterval) clearInterval(dataPollingInterval);

    console.log('[Queue] Closing queues...');
    if (latencyQueue) await latencyQueue.close().catch(() => {});
    if (projectQueue) await projectQueue.close().catch(() => {});
    if (mockSyncQueue) await mockSyncQueue.close().catch(() => {});
    if (openapiImportQueue) await openapiImportQueue.close().catch(() => {});

    console.log('[Redis] Quitting Redis clients...');
    if (pubClient) await pubClient.quit().catch(() => {});
    if (subClient) await subClient.quit().catch(() => {});
    if (mainRedisClient) await mainRedisClient.quit().catch(() => {});
    if (aiSubscriber) await aiSubscriber.quit().catch(() => {});
    if (logSubscriber) await logSubscriber.quit().catch(() => {});
    if (historySubscriber) await historySubscriber.quit().catch(() => {});

    console.log('[Server] Closing HTTP server...');
    server.close(() => {
      console.log('[Server] ✅ Shutdown complete');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('[Server] ⏰ Shutdown timeout, forcing exit');
      process.exit(1);
    }, 5000);
  };
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`[Server] ✅ Lis tening on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('[Server] ❌ Fatal startup error:', err);
  process.exit(1);
});


