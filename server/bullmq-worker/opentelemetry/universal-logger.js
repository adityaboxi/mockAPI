
const os = require('os');

// ---------- 1. CONFIGURATION ----------
const LOG_SERVER_URL =
  process.env.LOG_SERVER_URL || 'http://telemetry-server:3003/v1/logs';

const CONTAINER_NAME = process.env.CONTAINER_NAME || os.hostname() || 'bullmq-worker';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ---------- 2. BOUNDED BATCH BUFFER SETTINGS ----------
const MAX_QUEUE_SIZE = 1000;      // Max logs in memory (~200 KB)
const BATCH_INTERVAL = 3000;      // Flush every 3 seconds

let logQueue = [];
let flushTimer = null;
let isLogging = false;

// ---------- 3. FLUSH FUNCTION (Sends batch to server) ----------
async function flushLogs() {
  if (logQueue.length === 0) return;

  const batch = logQueue.slice();
  logQueue = [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    await fetch(LOG_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      signal: controller.signal,
    });
  } catch (_) {
    // Silently drop logs if the server is unreachable
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------- 4. START THE TIMER ----------
flushTimer = setInterval(flushLogs, BATCH_INTERVAL);

// ---------- 5. CORE sendLog FUNCTION ----------
function sendLog(levelOrObject, messageOrExtra, extraData) {
  let logEntry;

  if (typeof levelOrObject === 'object' && levelOrObject !== null) {
    logEntry = { time: Date.now(), container: CONTAINER_NAME, ...levelOrObject };
  } else if (typeof levelOrObject === 'string' && typeof messageOrExtra === 'string') {
    logEntry = {
      time: Date.now(),
      container: CONTAINER_NAME,
      level: levelOrObject,
      message: messageOrExtra,
      ...extraData,
    };
  } else {
    logEntry = {
      time: Date.now(),
      container: CONTAINER_NAME,
      level: 'INFO',
      message: String(levelOrObject),
      ...(typeof messageOrExtra === 'object' ? messageOrExtra : {}),
    };
  }

  if (!logEntry.container) logEntry.container = CONTAINER_NAME;
  if (!logEntry.time) logEntry.time = Date.now();

  // FIFO bounded buffer
  if (logQueue.length >= MAX_QUEUE_SIZE) {
    logQueue.shift();
  }

  logQueue.push(logEntry);

  if (logQueue.length >= MAX_QUEUE_SIZE / 2) {
    flushLogs();
  }
}

// ---------- 6. OVERRIDE GLOBAL CONSOLE METHODS ----------
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function serializeArgs(args) {
  return args
    .map((a) => {
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');
}

console.log = function (...args) {
  if (isLogging) {
    originalLog(...args);
    return;
  }
  isLogging = true;
  try {
    const msg = serializeArgs(args);
    sendLog('INFO', msg);
    if (!IS_PRODUCTION) originalLog(...args);
  } finally {
    isLogging = false;
  }
};

console.warn = function (...args) {
  if (isLogging) {
    originalWarn(...args);
    return;
  }
  isLogging = true;
  try {
    const msg = serializeArgs(args);
    sendLog('WARN', msg);
    if (!IS_PRODUCTION) originalWarn(...args);
  } finally {
    isLogging = false;
  }
};

console.error = function (...args) {
  if (isLogging) {
    originalError(...args);
    return;
  }
  isLogging = true;
  try {
    const msg = serializeArgs(args);
    sendLog('ERROR', msg);
    if (!IS_PRODUCTION) originalError(...args);
  } finally {
    isLogging = false;
  }
};

module.exports = { sendLog };

// ---------- 7. CLEANUP ON EXIT ----------
function cleanupAndFlush() {
  if (flushTimer) clearInterval(flushTimer);
  flushLogs();
}

process.on('beforeExit', cleanupAndFlush);
process.on('SIGTERM', () => { cleanupAndFlush(); process.exit(0); });
process.on('SIGINT', () => { cleanupAndFlush(); process.exit(0); });

console.log(`✅ Universal logger loaded.`);