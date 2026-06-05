// ============================================================
// WebSocket React Hook — Auto-reconnect with channel support
// ============================================================

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface WSMessage {
  channel: string;
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

type MessageHandler = (message: WSMessage) => void;

export function useWebSocket(channel?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, MessageHandler[]>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Subscribe to channel
        if (channel) {
          ws.send(JSON.stringify({ type: 'subscribe', channel }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          // Call all handlers for this event
          const handlers = handlersRef.current.get(message.event) || [];
          handlers.forEach((handler) => handler(message));

          // Also call wildcard handlers
          const wildcardHandlers = handlersRef.current.get('*') || [];
          wildcardHandlers.forEach((handler) => handler(message));
        } catch (err) {
          console.warn('[WS] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Reconnect after 3 seconds
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket not available (e.g., during build)
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, [channel]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const on = useCallback((event: string, handler: MessageHandler) => {
    const handlers = handlersRef.current.get(event) || [];
    handlers.push(handler);
    handlersRef.current.set(event, handlers);

    return () => {
      const h = handlersRef.current.get(event) || [];
      handlersRef.current.set(event, h.filter((fn) => fn !== handler));
    };
  }, []);

  const send = useCallback((event: string, data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        channel: channel || 'global',
        event,
        data,
        timestamp: new Date().toISOString(),
      }));
    }
  }, [channel]);

  return { isConnected, on, send };
}
