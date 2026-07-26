// src/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8081';

export const socket = io(SOCKET_URL, {
  withCredentials: true,
  transports: ['websocket', 'polling'],
});

// Optional: log connection statusss
socket.on('connect', () => {
  console.log('[Socket] Connected to server');
});
socket.on('disconnect', () => {
  console.log('[Socket] Disconnected');
});
socket.on('connect_error', (err) => {
  console.error('[Socket] Connection error:', err);
});