const os = require('os');

// ---------- 1. CONFIGURATION ----------
const LOG_SERVER_URL =
  process.env.LOG_SERVER_URL || 'http://telemetry-server:3003/v1/logs';

const CONTAINER_NAME = process.env.CONTAINER_NAME || process.env.PROJECT_ID || os.hostname() || 'unknown';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ---------- 2. BOUNDED BATCH BUFFER SETTINGS ----------
const MAX_QUEUE_SIZE = 1000;      // Max logs in memory (~250 KB). Prevents OOM.
const BATCH_INTERVAL = 2000;      // Flush every 2 seconds.

let logQueue = [];
let flushTimer = null;
let isLogging = false;            // Recursion & re-entrancy guard

// ---------- 3. FLUSH FUNCTION (Sends batch with timeout) ----------
function flushLogs() {
  if (logQueue.length === 0) return;

  // Drain current batch atomically
  const batch = logQueue.slice();
  logQueue = [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  fetch(LOG_SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
    signal: controller.signal,
  })
    .catch(() => {
      // Silently drop on server disconnect to avoid network storms
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });
}

// ---------- 4. START FLUSH TIMER ----------
flushTimer = setInterval(flushLogs, BATCH_INTERVAL);

// ---------- 5. CORE sendLog FUNCTION ----------
function sendLog(levelOrObject, messageOrExtra, extraData) {
  if (isLogging) return; // Prevent recursive loops
  isLogging = true;

  try {
    let logEntry;
    const now = Date.now();

    if (typeof levelOrObject === 'object' && levelOrObject !== null) {
      logEntry = { timestamp: now, container: CONTAINER_NAME, ...levelOrObject };
    } else if (typeof levelOrObject === 'string' && typeof messageOrExtra === 'string') {
      logEntry = {
        timestamp: now,
        container: CONTAINER_NAME,
        level: levelOrObject.toUpperCase(),
        message: messageOrExtra,
        ...(extraData && typeof extraData === 'object' ? extraData : {}),
      };
    } else {
      logEntry = {
        timestamp: now,
        container: CONTAINER_NAME,
        level: 'INFO',
        message: String(levelOrObject),
        ...(typeof messageOrExtra === 'object' && messageOrExtra !== null ? messageOrExtra : {}),
      };
    }

    if (!logEntry.container) logEntry.container = CONTAINER_NAME;
    if (!logEntry.timestamp) logEntry.timestamp = now;

    // FIFO Bounded queue to prevent memory growth under heavy load
    if (logQueue.length >= MAX_QUEUE_SIZE) {
      logQueue.shift(); // Drop oldest log
    }

    logQueue.push(logEntry);

    // Early flush if queue reaches 50% capacity
    if (logQueue.length >= MAX_QUEUE_SIZE / 2) {
      flushLogs();
    }
  } finally {
    isLogging = false;
  }
}

// ---------- 6. CONSOLE OVERRIDES ----------
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function serializeArgs(args) {
  return args
    .map((a) => {
      if (a instanceof Error) {
        return `${a.message}\n${a.stack || ''}`;
      }
      if (typeof a === 'object' && a !== null) {
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
  const msg = serializeArgs(args);
  sendLog('INFO', msg);
  if (!IS_PRODUCTION) originalLog.apply(console, args);
};

console.warn = function (...args) {
  const msg = serializeArgs(args);
  sendLog('WARN', msg);
  originalWarn.apply(console, args); // Always show warnings in console/docker logs
};

console.error = function (...args) {
  const msg = serializeArgs(args);
  sendLog('ERROR', msg);
  originalError.apply(console, args); // Always show errors in console/docker logs
};

// ---------- 7. EXPORTS & CLEANUP ----------
module.exports = { sendLog };

function cleanupAndFlush() {
  if (flushTimer) clearInterval(flushTimer);
  flushLogs();
}

process.on('beforeExit', cleanupAndFlush);
process.on('SIGTERM', () => { cleanupAndFlush(); process.exit(0); });
process.on('SIGINT', () => { cleanupAndFlush(); process.exit(0); });

// Initial boot confirmation
originalLog(`[Universal-Logger] ✅ Loaded for ${CONTAINER_NAME} -> ${LOG_SERVER_URL}`);