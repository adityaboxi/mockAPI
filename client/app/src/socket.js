// src/socket.js
import { io } from 'socket.io-client';

// Resolve socket URL safely (supports absolute URLs, relative paths, or Vite env fallbacks)
const getSocketUrl = () => {
  const envUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string') {
    return envUrl.replace(/\/+$/, ''); // Remove trailing slashes
  }
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return 'http://localhost:8081';
};

const SOCKET_URL = getSocketUrl();

// Prevent multiple socket instances during React / Vite Hot Module Replacement
const globalScope = typeof window !== 'undefined' ? window : globalThis;

export const socket =
  globalScope.__MOCKAPI_SOCKET_INSTANCE__ ||
  io(SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 10000,
    autoConnect: true,
    forceNew: false,
    // Dynamic token injection on every connection / reconnect handshake
    auth: (cb) => {
      let token = null;
      try {
        if (typeof window !== 'undefined') {
          token = localStorage.getItem('auth_token');
        }
      } catch (_) {}
      cb({ token });
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalScope.__MOCKAPI_SOCKET_INSTANCE__ = socket;
}

// Connection lifecycle logs & recovery
socket.on('connect', () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Socket] Connected to server:', socket.id);
  }
});

socket.on('disconnect', (reason) => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[Socket] Disconnected. Reason:', reason);
  }
  // If server closed connection abruptly, proactively attempt reconnect
  if (reason === 'io server disconnect') {
    socket.connect();
  }
});

socket.on('connect_error', (err) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Socket] Connection error:', err.message);
  }
});

export default socket;