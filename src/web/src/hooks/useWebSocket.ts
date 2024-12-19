// @package react ^18.0.0
// @package socket.io-client ^4.6.0
// @package socket.io-msgpack-parser ^3.0.0

import { useState, useEffect, useCallback } from 'react';
import { ApiResponse } from '../types/api.types';
import { WebSocketWorker } from '../workers/websocket.worker';

/**
 * WebSocket connection states
 */
export enum WebSocketConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

/**
 * Enhanced WebSocket error interface with detailed tracking
 */
export interface WebSocketError {
  code: number;
  message: string;
  timestamp: number;
  attemptCount: number;
  context?: Record<string, unknown>;
}

/**
 * WebSocket state interface with comprehensive tracking
 */
export interface WebSocketState {
  connected: boolean;
  connectionState: WebSocketConnectionState;
  error: WebSocketError | null;
  reconnecting: boolean;
  lastMessageTime: number;
  messageQueue: Array<PendingMessage>;
  connectionAttempts: number;
  metrics: WebSocketMetrics;
}

/**
 * Performance metrics interface for monitoring
 */
export interface WebSocketMetrics {
  latency: number;
  messageCount: number;
  errorCount: number;
  reconnections: number;
  uptime: number;
  lastHealthCheck: number;
}

/**
 * Pending message interface for queue management
 */
interface PendingMessage {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  retryCount: number;
}

/**
 * WebSocket hook configuration options
 */
export interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  messageQueueSize?: number;
  workerOptions?: {
    timeout?: number;
    batchSize?: number;
    maxRetries?: number;
  };
}

/**
 * Default configuration for WebSocket connections
 */
const DEFAULT_OPTIONS: Required<UseWebSocketOptions> = {
  autoConnect: true,
  reconnectAttempts: 5,
  reconnectInterval: 1000,
  heartbeatInterval: 30000,
  messageQueueSize: 1000,
  workerOptions: {
    timeout: 5000,
    batchSize: 100,
    maxRetries: 3
  }
};

/**
 * WebSocket event types for internal handling
 */
const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  OCCUPANCY_UPDATE: 'occupancy:update',
  RESOURCE_UPDATE: 'resource:update',
  HEARTBEAT: 'heartbeat',
  RECONNECT: 'reconnect',
  MESSAGE_QUEUE_UPDATE: 'queue:update'
} as const;

/**
 * Custom hook for managing WebSocket connections with enhanced features
 * @param url WebSocket server URL
 * @param options Configuration options for WebSocket behavior
 */
export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const [worker, setWorker] = useState<WebSocketWorker | null>(null);
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connectionState: WebSocketConnectionState.DISCONNECTED,
    error: null,
    reconnecting: false,
    lastMessageTime: 0,
    messageQueue: [],
    connectionAttempts: 0,
    metrics: {
      latency: 0,
      messageCount: 0,
      errorCount: 0,
      reconnections: 0,
      uptime: 0,
      lastHealthCheck: Date.now()
    }
  });

  /**
   * Initializes WebSocket worker with error handling
   */
  const initializeWorker = useCallback(() => {
    try {
      const newWorker = new WebSocketWorker();
      
      newWorker.postMessage({
        type: 'connect',
        data: {
          url,
          options: config.workerOptions
        }
      });

      setWorker(newWorker);
      setState(prev => ({
        ...prev,
        connectionState: WebSocketConnectionState.CONNECTING
      }));

      return newWorker;
    } catch (error) {
      handleError('Worker initialization failed', error);
      return null;
    }
  }, [url, config.workerOptions]);

  /**
   * Handles WebSocket errors with enhanced tracking
   */
  const handleError = useCallback((message: string, error: unknown) => {
    const wsError: WebSocketError = {
      code: error instanceof Error ? 500 : 0,
      message: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      attemptCount: state.connectionAttempts,
      context: { message }
    };

    setState(prev => ({
      ...prev,
      error: wsError,
      connectionState: WebSocketConnectionState.ERROR,
      metrics: {
        ...prev.metrics,
        errorCount: prev.metrics.errorCount + 1
      }
    }));
  }, [state.connectionAttempts]);

  /**
   * Handles incoming WebSocket messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    const { type, data } = event.data;

    setState(prev => ({
      ...prev,
      lastMessageTime: Date.now(),
      metrics: {
        ...prev.metrics,
        messageCount: prev.metrics.messageCount + 1
      }
    }));

    switch (type) {
      case SOCKET_EVENTS.CONNECT:
        setState(prev => ({
          ...prev,
          connected: true,
          connectionState: WebSocketConnectionState.CONNECTED,
          error: null,
          reconnecting: false,
          connectionAttempts: 0
        }));
        break;

      case SOCKET_EVENTS.DISCONNECT:
        handleDisconnect();
        break;

      case SOCKET_EVENTS.ERROR:
        handleError('WebSocket error', data);
        break;

      case SOCKET_EVENTS.OCCUPANCY_UPDATE:
      case SOCKET_EVENTS.RESOURCE_UPDATE:
        handleDataUpdate(type, data);
        break;
    }
  }, []);

  /**
   * Handles WebSocket disconnection with reconnection logic
   */
  const handleDisconnect = useCallback(() => {
    setState(prev => ({
      ...prev,
      connected: false,
      connectionState: WebSocketConnectionState.DISCONNECTED,
      connectionAttempts: prev.connectionAttempts + 1
    }));

    if (state.connectionAttempts < config.reconnectAttempts) {
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          reconnecting: true,
          connectionState: WebSocketConnectionState.RECONNECTING
        }));
        initializeWorker();
      }, config.reconnectInterval * Math.pow(2, state.connectionAttempts));
    }
  }, [state.connectionAttempts, config.reconnectAttempts, config.reconnectInterval]);

  /**
   * Handles data updates with type safety
   */
  const handleDataUpdate = useCallback((type: string, data: unknown) => {
    if (!data || typeof data !== 'object') {
      handleError('Invalid data format', new Error('Data validation failed'));
      return;
    }

    // Process and queue message if needed
    if (state.messageQueue.length < config.messageQueueSize) {
      setState(prev => ({
        ...prev,
        messageQueue: [...prev.messageQueue, {
          id: crypto.randomUUID(),
          type,
          payload: data,
          timestamp: Date.now(),
          retryCount: 0
        }]
      }));
    }
  }, [state.messageQueue.length, config.messageQueueSize]);

  /**
   * Implements heartbeat mechanism
   */
  useEffect(() => {
    if (!state.connected) return;

    const heartbeatInterval = setInterval(() => {
      worker?.postMessage({ type: SOCKET_EVENTS.HEARTBEAT });
      
      setState(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          lastHealthCheck: Date.now()
        }
      }));
    }, config.heartbeatInterval);

    return () => clearInterval(heartbeatInterval);
  }, [state.connected, config.heartbeatInterval]);

  /**
   * Initializes WebSocket connection
   */
  useEffect(() => {
    if (config.autoConnect) {
      const newWorker = initializeWorker();
      
      if (newWorker) {
        newWorker.onmessage = handleMessage;
      }
    }

    return () => {
      worker?.postMessage({ type: 'disconnect' });
      worker?.terminate();
    };
  }, []);

  return {
    state,
    connect: initializeWorker,
    disconnect: useCallback(() => {
      worker?.postMessage({ type: 'disconnect' });
      worker?.terminate();
      setWorker(null);
      setState(prev => ({
        ...prev,
        connected: false,
        connectionState: WebSocketConnectionState.DISCONNECTED
      }));
    }, [worker]),
    metrics: state.metrics
  };
}

export type {
  UseWebSocketOptions,
  WebSocketState,
  WebSocketError,
  WebSocketMetrics
};