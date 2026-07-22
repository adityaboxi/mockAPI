const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();




// ---------- Environment configuration ----------
const DASHBOARD_USER = process.env.DASHBOARD_USER || 'admin';
const DASHBOARD_PASS = process.env.DASHBOARD_PASS || 'password';
const SESSION_SECRET = process.env.SESSION_SECRET || 'my-super-secret-key';

// ---------- Session   middleware (in‑memory) ----------
app.use(cookieParser());
const sessionParser = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,                // HTTP only (set to true if using HTTPS)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
});
app.use(sessionParser);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- In‑memory log storage ----------
let logs = [];
let wsClients = [];
const MAX_LOGS = 10000;

// ---------- Public routes (no auth) ----------
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
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
      return res.json({ success: true, redirect: '/telemetry/' });
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

// ---------- Auth middleware ----------
function requireAuth(req, res, next) {
  // Allow log ingestion without authentication
  if (req.path === '/ingest') {
    return next();
  }
  if (req.session && req.session.user) {
    return next();
  }
  // Protect API endpoints
  if (req.path.startsWith('/api/') || req.path === '/logs' || req.path === '/errors' || req.path === '/traces') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Redirect to login for page requests
  res.redirect('/login');
}

app.use(requireAuth);

// ---------- Serve static dashboard (protected) ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Log ingestion (unauthenticated) ----------
app.post('/ingest', (req, res) => {
  const entries = Array.isArray(req.body) ? req.body : [req.body];
  entries.forEach(entry => {
    logs.push({
      timestamp: Date.now(),
      ...entry
    });
    if (logs.length > MAX_LOGS) logs.shift();

    wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'log', data: entry }));
      }
    });
  });
  res.status(200).json({ status: 'ok', count: entries.length });
});

// ---------- Protected REST endpoints ----------
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

// ---------- ADDED: /traces endpoint (dummy for now) ----------
app.get('/traces', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  // You can later add real trace storage. For now, return empty array.
  res.json({ total: 0, traces: [] });
});

// ---------- WebSocket server ----------
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
  wsClients.push(ws);
  ws.on('close', () => {
    wsClients = wsClients.filter(client => client !== ws);
  });
});

// Authentication for WebSocket upgrade
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

// ---------- Catch‑all: serve dashboard (protected) ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- Start server ----------
const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 Telemetry server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`📝 Logs endpoint: POST http://localhost:${PORT}/ingest`);
  console.log(`========================================\n`);
});