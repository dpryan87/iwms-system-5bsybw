// @package socket.io-client ^4.6.0
// @package socket.io-msgpack-parser ^3.0.0

import { io, Socket } from 'socket.io-client';
import { encode, decode } from 'socket.io-msgpack-parser';
import { ApiResponse, WebSocketEventType, WebSocketMessage } from '../types/api.types';

/**
 * Constants for WebSocket configuration and events
 */
const SOCKET_EVENTS = {
  CONNECT: WebSocketEventType.CONNECT,
  DISCONNECT: WebSocketEventType.DISCONNECT,
  ERROR: WebSocketEventType.ERROR,
  DATA_UPDATE: WebSocketEventType.DATA_UPDATE,
  STATUS_CHANGE: WebSocketEventType.STATUS_CHANGE,
  OCCUPANCY_UPDATE: 'occupancy:update',
  RESOURCE_UPDATE: 'resource:update',
  HEALTH_CHECK: 'health:check',
  RECONNECT_ATTEMPT: 'reconnect:attempt'
} as const;

/**
 * Configuration for reconnection strategy
 */
const RECONNECT_CONFIG = {
  MAX_ATTEMPTS: 5,
  INITIAL_DELAY: 1000,
  MAX_DELAY: 30000,
  BACKOFF_FACTOR: 1.5,
  JITTER: 100
} as const;

/**
 * Configuration for health monitoring
 */
const HEALTH_CHECK_CONFIG = {
  INTERVAL: 30000,
  TIMEOUT: 5000,
  THRESHOLD: 3
} as const;

/**
 * Interface for WebSocket connection state
 */
interface ConnectionState {
  isConnected: boolean;
  reconnectAttempts: number;
  lastHeartbeat: number;
  failedHealthChecks: number;
}

/**
 * WebSocket Worker class for handling real-time connections
 */
class WebSocketWorker {
  private socket: Socket | null = null;
  private connectionState: ConnectionState = {
    isConnected: false,
    reconnectAttempts: 0,
    lastHeartbeat: Date.now(),
    failedHealthChecks: 0
  };
  private healthCheckInterval: number | null = null;
  private reconnectTimeout: number | null = null;

  /**
   * Initializes the WebSocket connection with enhanced error handling
   * @param url WebSocket server URL
   */
  private async initializeSocket(url: string): Promise<void> {
    try {
      this.socket = io(url, {
        parser: { encode, decode },
        reconnection: false, // We'll handle reconnection manually
        timeout: 10000,
        transports: ['websocket'],
        autoConnect: false
      });

      this.setupEventHandlers();
      this.startHealthCheck();
      await this.connect();
    } catch (error) {
      this.handleError('Initialization failed', error);
    }
  }

  /**
   * Sets up WebSocket event handlers with error boundaries
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on(SOCKET_EVENTS.CONNECT, () => {
      this.connectionState.isConnected = true;
      this.connectionState.reconnectAttempts = 0;
      this.postMessage({ type: SOCKET_EVENTS.CONNECT, success: true });
    });

    this.socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      this.handleDisconnect();
    });

    this.socket.on(SOCKET_EVENTS.ERROR, (error) => {
      this.handleError('Socket error', error);
    });

    this.socket.on(SOCKET_EVENTS.OCCUPANCY_UPDATE, (data) => {
      this.handleOccupancyUpdate(data);
    });

    this.socket.on(SOCKET_EVENTS.RESOURCE_UPDATE, (data) => {
      this.handleResourceUpdate(data);
    });
  }

  /**
   * Handles incoming occupancy updates with validation
   */
  private handleOccupancyUpdate(data: unknown): void {
    try {
      if (!this.validateOccupancyData(data)) {
        throw new Error('Invalid occupancy data format');
      }

      this.postMessage({
        type: SOCKET_EVENTS.DATA_UPDATE,
        event: SOCKET_EVENTS.OCCUPANCY_UPDATE,
        data
      });
    } catch (error) {
      this.handleError('Occupancy update error', error);
    }
  }

  /**
   * Handles incoming resource updates with validation
   */
  private handleResourceUpdate(data: unknown): void {
    try {
      if (!this.validateResourceData(data)) {
        throw new Error('Invalid resource data format');
      }

      this.postMessage({
        type: SOCKET_EVENTS.DATA_UPDATE,
        event: SOCKET_EVENTS.RESOURCE_UPDATE,
        data
      });
    } catch (error) {
      this.handleError('Resource update error', error);
    }
  }

  /**
   * Implements exponential backoff reconnection strategy
   */
  private async handleReconnect(): Promise<void> {
    if (this.connectionState.reconnectAttempts >= RECONNECT_CONFIG.MAX_ATTEMPTS) {
      this.handleError('Max reconnection attempts reached', new Error('Connection failed'));
      return;
    }

    const delay = Math.min(
      RECONNECT_CONFIG.INITIAL_DELAY * Math.pow(RECONNECT_CONFIG.BACKOFF_FACTOR, this.connectionState.reconnectAttempts) +
        Math.random() * RECONNECT_CONFIG.JITTER,
      RECONNECT_CONFIG.MAX_DELAY
    );

    this.connectionState.reconnectAttempts++;
    this.postMessage({
      type: SOCKET_EVENTS.RECONNECT_ATTEMPT,
      attempt: this.connectionState.reconnectAttempts
    });

    this.reconnectTimeout = self.setTimeout(async () => {
      await this.connect();
    }, delay);
  }

  /**
   * Handles WebSocket disconnection events
   */
  private handleDisconnect(): void {
    this.connectionState.isConnected = false;
    this.postMessage({ type: SOCKET_EVENTS.DISCONNECT });
    this.handleReconnect();
  }

  /**
   * Implements health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = self.setInterval(() => {
      if (!this.socket?.connected) {
        this.connectionState.failedHealthChecks++;
        
        if (this.connectionState.failedHealthChecks >= HEALTH_CHECK_CONFIG.THRESHOLD) {
          this.handleError('Health check failed', new Error('Connection unhealthy'));
          this.reconnect();
        }
      } else {
        this.connectionState.failedHealthChecks = 0;
        this.connectionState.lastHeartbeat = Date.now();
      }
    }, HEALTH_CHECK_CONFIG.INTERVAL);
  }

  /**
   * Validates occupancy data format
   */
  private validateOccupancyData(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const occupancyData = data as Record<string, unknown>;
    
    return (
      typeof occupancyData.spaceId === 'string' &&
      typeof occupancyData.count === 'number' &&
      typeof occupancyData.timestamp === 'number'
    );
  }

  /**
   * Validates resource data format
   */
  private validateResourceData(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const resourceData = data as Record<string, unknown>;
    
    return (
      typeof resourceData.resourceId === 'string' &&
      typeof resourceData.status === 'string' &&
      typeof resourceData.timestamp === 'number'
    );
  }

  /**
   * Handles errors with logging and notification
   */
  private handleError(message: string, error: unknown): void {
    console.error(`WebSocket Error: ${message}`, error);
    this.postMessage({
      type: SOCKET_EVENTS.ERROR,
      error: message,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  /**
   * Posts messages to the main thread
   */
  private postMessage(message: WebSocketMessage<unknown>): void {
    (self as DedicatedWorkerGlobalScope).postMessage(message);
  }

  /**
   * Establishes WebSocket connection
   */
  private async connect(): Promise<void> {
    if (!this.socket) return;
    
    try {
      this.socket.connect();
    } catch (error) {
      this.handleError('Connection failed', error);
      this.handleReconnect();
    }
  }

  /**
   * Forces a reconnection attempt
   */
  private async reconnect(): Promise<void> {
    if (this.socket) {
      this.socket.close();
    }
    await this.handleReconnect();
  }

  /**
   * Cleans up resources and closes connection
   */
  private cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.socket) {
      this.socket.close();
    }
  }

  /**
   * Handles incoming messages from main thread
   */
  public onMessage(event: MessageEvent): void {
    try {
      const { type, data } = event.data;
      
      switch (type) {
        case 'connect':
          this.initializeSocket(data.url);
          break;
        case 'disconnect':
          this.cleanup();
          break;
        default:
          this.handleError('Unknown message type', new Error(`Invalid message type: ${type}`));
      }
    } catch (error) {
      this.handleError('Message handling error', error);
    }
  }
}

// Initialize worker
const worker = new WebSocketWorker();
self.onmessage = (event: MessageEvent) => worker.onMessage(event);

export type { WebSocketWorker };