import { useState, useEffect, useRef } from 'react';

export function useWebSocket(url, enabled, onMessage) {
  const [readyState, setReadyState] = useState(0);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setReadyState(1);
        console.log('[WS] Connected');
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          onMessage(data);
        } catch (err) {
          console.error('[WS] Error parsing message:', err);
        }
      };

      ws.onclose = () => {
        setReadyState(0);
        console.log('[WS] Disconnected, reconnecting in 3s...');
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [url, enabled, onMessage]);

  return { ws: wsRef.current, readyState };
}