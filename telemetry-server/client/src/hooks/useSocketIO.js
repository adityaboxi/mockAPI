import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

export function useSocketIO(serverUrl, enabled, token, onLog, onTrace) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  // ─── Keep latest callbacks in refs ──────────────────────────
  const onLogRef = useRef(onLog);
  const onTraceRef = useRef(onTrace);

  // Update refs when callbacks change (without re‑connecting)
  useEffect(() => {
    onLogRef.current = onLog;
  }, [onLog]);

  useEffect(() => {
    onTraceRef.current = onTrace;
  }, [onTrace]);

  // ─── Socket lifecycle ───────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const options = {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    };
    if (token) {
      options.auth = { token };
    }

    const socket = io(serverUrl, options);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[SocketIO] Connected');
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[SocketIO] Disconnected:', reason);
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        socket.connect(); // manually reconnect if server closed it
      }
    });

    socket.on('init', (data) => {
      console.log('[SocketIO] Initial logs:', data.logs?.length);
      if (data.logs) {
        data.logs.forEach((log) => onLogRef.current(log));
      }
    });

    socket.on('log', (logData) => {
      onLogRef.current(logData);
    });

    socket.on('trace', (traceData) => {
      if (onTraceRef.current) onTraceRef.current(traceData);
    });

    socket.on('connect_error', (err) => {
      console.error('[SocketIO] Connection error:', err.message);
      if (err.message === 'Authentication error: token missing' || err.message === 'Authentication error: invalid token') {
        console.warn('[SocketIO] Authentication failed – ensure you are logged in');
      }
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log(`[SocketIO] Reconnection attempt ${attempt}`);
    });

    // ─── Cleanup ──────────────────────────────────────────────
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [serverUrl, enabled, token]); // only reconnect when URL/enabled/token change

  // ─── Expose a manual disconnect method ──────────────────────
  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  return { isConnected, socket: socketRef.current, disconnect };
}