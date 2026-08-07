
const os = require('os');

// ---------- 1. CONFIGURATION ----------
const LOG_SERVER_URL =
  process.env.LOG_SERVER_URL || 'http://telemetry-server:3003/v1/logs';

const CONTAINER_NAME = process.env.CONTAINER_NAME || os.hostname() || 'unknown';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ---------- 2. BOUNDED BATCH BUFFER SETTINGS ----------
const MAX_QUEUE_SIZE = 1000;      // Max logs in memory (~200 KB). Prevents OOM.
const BATCH_INTERVAL = 3000;      // Flush every 3 seconds.


let logQueue = [];
let flushTimer = null;

// ---------- 3. FLUSH FUNCTION (Sends batch to server) ----------
function flushLogs() {
  if (logQueue.length === 0) return;

  // Take a copy of the queue and clear it immediately
  const batch = logQueue.slice();
  logQueue = [];

  // Send the batch in ONE HTTP request
  fetch(LOG_SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch), // Sends an ARRAY of logs
  }).catch(() => {
    // Silently drop logs if the server is down.
    // We don't retry because retries could flood the network.
  });
}

// ---------- 4. START THE TIMER ----------
flushTimer = setInterval(flushLogs, BATCH_INTERVAL);

// ---------- 5. CORE sendLog FUNCTION ----------
function sendLog(levelOrObject, messageOrExtra, extraData) {
  let logEntry;

  // ----- Flexible argument handling -----
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

  // ---------- 6. BOUNDED QUEUE LOGIC (Memory Safety) ----------
  // If the queue is FULL, drop the OLDEST log (FIFO) to make room.
  // This prevents memory from growing forever during traffic spikes.
  if (logQueue.length >= MAX_QUEUE_SIZE) {
    logQueue.shift(); // Remove oldest
  }

  // Push the new log
  logQueue.push(logEntry);

  // ---------- 7. EARLY FLUSH (Reduce memory pressure) ----------
  // If the queue reaches 50% capacity, flush early.
  // This prevents the queue from hitting the max limit in normal traffic.
  if (logQueue.length >= MAX_QUEUE_SIZE / 2) {
    flushLogs();
  }
}

// ---------- 8. OVERRIDE GLOBAL CONSOLE METHODS ----------
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
  const msg = serializeArgs(args);
  sendLog('INFO', msg);
  if (!IS_PRODUCTION) originalLog(...args);
};

console.warn = function (...args) {
  const msg = serializeArgs(args);
  sendLog('WARN', msg);
  if (!IS_PRODUCTION) originalWarn(...args);
};

console.error = function (...args) {
  const msg = serializeArgs(args);
  sendLog('ERROR', msg);
  if (!IS_PRODUCTION) originalError(...args);
};

// ---------- 9. EXPOSE MANUAL FUNCTION ----------
module.exports = { sendLog };

// ---------- 10. CLEANUP ON EXIT ----------
function cleanupAndFlush() {
  if (flushTimer) clearInterval(flushTimer);
  flushLogs();
}


process.on('beforeExit', cleanupAndFlush);
process.on('SIGTERM', () => { cleanupAndFlush(); process.exit(0); });
process.on('SIGINT', () => { cleanupAndFlush(); process.exit(0); });

// ---------- 11. STARTUP MESSAGE ----------
console.log(`✅ Universal logger loaded.`);
console.log(`   🔗 Server: ${LOG_SERVER_URL}`);
console.log(`   🐳 Container: ${CONTAINER_NAME}`);
console.log(`   📦 Queue size: ${MAX_QUEUE_SIZE} logs`);
console.log(`   ⏱️  Flush interval: ${BATCH_INTERVAL}ms`);
console.log(`   💾 Disk-safe: ${IS_PRODUCTION ? 'ON' : 'OFF'}`);