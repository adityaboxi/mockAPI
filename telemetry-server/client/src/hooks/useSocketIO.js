import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

export function useSocketIO(serverUrl, enabled, token, onLog, onTrace) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Allow connection even if token is missing (server will fallback to session cookie)
    if (!enabled) return;

    // Build the connection options
    const options = {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    };

    // Only add auth if token is provided
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

      // If the server initiated the disconnect, manually reconnect
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('init', (data) => {
      console.log('[SocketIO] Initial logs:', data.logs?.length);
      if (data.logs) data.logs.forEach((log) => onLog(log));
    });

    socket.on('log', (logData) => {
      onLog(logData);
    });

    socket.on('trace', (traceData) => {
      if (onTrace) onTrace(traceData);
    });

    socket.on('connect_error', (err) => {
      console.error('[SocketIO] Connection error:', err.message);
      // Optionally, you can check if it's an authentication error
      if (err.message === 'Authentication error: token missing' || err.message === 'Authentication error: invalid token') {
        console.warn('[SocketIO] Authentication failed – ensure you are logged in');
      }
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log(`[SocketIO] Reconnection attempt ${attempt}`);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [serverUrl, enabled, token]); // token is a dependency

  return { isConnected, socket: socketRef.current };
}