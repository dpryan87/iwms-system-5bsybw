// @package socket.io v4.6.0
import { Socket, Server } from 'socket.io';
import { IBaseService } from '../../common/interfaces/service.interface';

/**
 * Enhanced enumeration of WebSocket event types
 * Covers all real-time events in the IWMS system
 */
export enum SocketEventType {
  // Core occupancy and resource events
  OCCUPANCY_UPDATE = 'occupancy.update',
  RESOURCE_UPDATE = 'resource.update',
  
  // Subscription management events
  SUBSCRIPTION = 'subscription.add',
  UNSUBSCRIPTION = 'subscription.remove',
  
  // System events
  ERROR = 'system.error',
  HEALTH_CHECK = 'system.health',
  RECONNECT = 'system.reconnect'
}

/**
 * Comprehensive enumeration of WebSocket error codes
 * Provides detailed error categorization for troubleshooting
 */
export enum SocketErrorCode {
  // Client-side errors (4xxx)
  INVALID_EVENT = '4000',
  UNAUTHORIZED = '4001',
  INVALID_PAYLOAD = '4002',
  SUBSCRIPTION_FAILED = '4003',
  
  // Server-side errors (5xxx)
  BROADCAST_FAILED = '5000',
  INTERNAL_ERROR = '5001',
  SERVICE_UNAVAILABLE = '5002',
  RATE_LIMITED = '5003'
}

/**
 * Enhanced interface for WebSocket event structure
 * Includes comprehensive metadata for event tracking and debugging
 */
export interface ISocketEvent {
  /** Event type identifier */
  type: SocketEventType;
  
  /** Target room or channel */
  room: string;
  
  /** Event payload data */
  payload: unknown;
  
  /** Event timestamp */
  timestamp: Date;
  
  /** Optional metadata for tracking */
  metadata?: {
    correlationId?: string;
    userId?: string;
    source?: string;
  };
}

/**
 * Enhanced interface for WebSocket response messages
 * Includes detailed error handling and response metadata
 */
export interface ISocketResponse {
  /** Operation success indicator */
  success: boolean;
  
  /** Response message */
  message: string;
  
  /** Response payload */
  data?: unknown;
  
  /** Error details if operation failed */
  error?: {
    code: SocketErrorCode;
    message: string;
    details?: unknown;
  };
  
  /** Response metadata */
  metadata?: {
    timestamp: Date;
    processingTime?: number;
    server?: string;
  };
}

/**
 * Interface for subscription management
 * Handles room/channel subscriptions
 */
export interface ISocketSubscription {
  /** Room identifier */
  room: string;
  
  /** Subscription type */
  type: 'occupancy' | 'resource' | 'system';
  
  /** Optional filter criteria */
  filters?: Record<string, unknown>;
  
  /** Subscription timestamp */
  subscribedAt: Date;
}

/**
 * Enhanced interface for WebSocket event handlers
 * Includes comprehensive error handling and logging
 */
export interface ISocketHandler extends IBaseService {
  /** Socket.IO server instance */
  readonly server: Server;
  
  /**
   * Handles incoming WebSocket events
   * @param event - Socket event details
   * @param socket - Client socket instance
   * @returns Promise resolving to void, with error handling
   */
  handleEvent(event: ISocketEvent, socket: Socket): Promise<void>;
  
  /**
   * Manages client subscriptions
   * @param socket - Client socket instance
   * @param subscription - Subscription details
   * @returns Promise resolving to subscription result
   */
  handleSubscription(socket: Socket, subscription: ISocketSubscription): Promise<ISocketResponse>;
  
  /**
   * Broadcasts events to subscribed clients
   * @param event - Event to broadcast
   * @param room - Target room (optional)
   * @returns Promise resolving to broadcast result
   */
  broadcast(event: ISocketEvent, room?: string): Promise<ISocketResponse>;
  
  /**
   * Validates client authentication and authorization
   * @param socket - Client socket instance
   * @returns Promise resolving to validation result
   */
  validateClient(socket: Socket): Promise<boolean>;
}

/**
 * Interface for WebSocket connection metrics
 * Tracks real-time performance and usage statistics
 */
export interface ISocketMetrics {
  /** Active connections count */
  activeConnections: number;
  
  /** Message throughput */
  messageRate: number;
  
  /** Active subscriptions count */
  activeSubscriptions: number;
  
  /** Error rate */
  errorRate: number;
  
  /** Average response time */
  avgResponseTime: number;
}

/**
 * Interface for WebSocket rate limiting
 * Implements connection and message rate controls
 */
export interface ISocketRateLimit {
  /** Maximum connections per client */
  maxConnections: number;
  
  /** Maximum messages per interval */
  maxMessages: number;
  
  /** Time interval in milliseconds */
  interval: number;
  
  /** Burst allowance */
  burst: number;
}