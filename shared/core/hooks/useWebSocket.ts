// Hook for WebSocket-based real-time notifications

import { useEffect, useRef, useCallback } from 'react';
import { getWebSocketService, WebSocketEventType, WebSocketEvent, DeviceDiscoveredPayload } from '../services';
import type { Job } from '../types';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  onDeviceDiscovered?: (payload: DeviceDiscoveredPayload) => void;
  onJobUpdate?: (job: Job) => void;
  onAnyEvent?: (event: WebSocketEvent) => void;
}

export interface UseWebSocketReturn {
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { autoConnect = true, onDeviceDiscovered, onJobUpdate, onAnyEvent } = options;
  const wsService = getWebSocketService();
  const unsubscribeRefs = useRef<(() => void)[]>([]);

  // Set up event handlers
  useEffect(() => {
    // Clean up previous subscriptions
    unsubscribeRefs.current.forEach(unsub => unsub());
    unsubscribeRefs.current = [];

    if (onDeviceDiscovered) {
      const unsub = wsService.on<DeviceDiscoveredPayload>('device_discovered', (event) => {
        onDeviceDiscovered(event.payload);
      });
      unsubscribeRefs.current.push(unsub);
    }

    if (onJobUpdate) {
      const jobEvents: WebSocketEventType[] = ['job_queued', 'job_started', 'job_completed', 'job_failed'];
      for (const eventType of jobEvents) {
        const unsub = wsService.on<Job>(eventType, (event) => {
          onJobUpdate(event.payload as Job);
        });
        unsubscribeRefs.current.push(unsub);
      }
    }

    if (onAnyEvent) {
      const unsub = wsService.onAny(onAnyEvent);
      unsubscribeRefs.current.push(unsub);
    }

    return () => {
      unsubscribeRefs.current.forEach(unsub => unsub());
      unsubscribeRefs.current = [];
    };
  }, [onDeviceDiscovered, onJobUpdate, onAnyEvent, wsService]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      wsService.connect();
    }

    return () => {
      // Don't disconnect on unmount since other components may still need the connection
      // The service handles its own cleanup
    };
  }, [autoConnect, wsService]);

  const connect = useCallback(() => {
    wsService.connect();
  }, [wsService]);

  const disconnect = useCallback(() => {
    wsService.disconnect();
  }, [wsService]);

  return {
    connect,
    disconnect,
    isConnected: wsService.isConnected,
  };
}
