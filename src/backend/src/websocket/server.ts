// @package socket.io v4.6.0
// @package inversify v6.0.1
// @package rate-limiter-flexible v2.4.1
import { Server, Socket } from 'socket.io';
import { injectable } from 'inversify';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { 
  ISocketHandler, 
  SocketEventType, 
  SocketErrorCode,
  ISocketEvent,
  ISocketResponse,
  ISocketMetrics
} from './interfaces/socket.interface';
import { ServiceHealthStatus, IHealthCheckResult } from '../common/interfaces/service.interface';

/**
 * Connection state tracking interface
 */
interface ConnectionState {
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
  messageCount: number;
  errors: number;
}

/**
 * Enhanced WebSocket server implementation with comprehensive monitoring,
 * error handling, and high availability features
 */
@injectable()
export class WebSocketServer {
  private server: Server;
  private handlers: Map<string, ISocketHandler>;
  private connectionStates: Map<string, ConnectionState>;
  private rateLimiter: RateLimiterMemory;
  private metrics: ISocketMetrics;
  private isShuttingDown: boolean;

  constructor(private readonly port: number) {
    this.handlers = new Map();
    this.connectionStates = new Map();
    this.isShuttingDown = false;
    this.metrics = this.initializeMetrics();

    // Initialize rate limiter with enterprise-grade settings
    this.rateLimiter = new RateLimiterMemory({
      points: 100, // Number of points
      duration: 60, // Per 60 seconds
      blockDuration: 60 * 2 // Block for 2 minutes if exceeded
    });

    // Initialize Socket.IO server with production configuration
    this.server = new Server({
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || [],
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 20000,
      pingInterval: 25000,
      connectTimeout: 10000,
      transports: ['websocket', 'polling']
    });
  }

  /**
   * Initializes server metrics tracking
   */
  private initializeMetrics(): ISocketMetrics {
    return {
      activeConnections: 0,
      messageRate: 0,
      activeSubscriptions: 0,
      errorRate: 0,
      avgResponseTime: 0
    };
  }

  /**
   * Starts the WebSocket server with monitoring and health checks
   */
  public async start(): Promise<void> {
    try {
      // Set up middleware for authentication and rate limiting
      this.server.use(async (socket, next) => {
        try {
          await this.authenticateConnection(socket);
          await this.applyRateLimit(socket);
          next();
        } catch (error) {
          next(new Error(error instanceof Error ? error.message : 'Authentication failed'));
        }
      });

      // Set up connection handler
      this.server.on('connection', (socket) => this.handleConnection(socket));

      // Start server
      await new Promise<void>((resolve) => {
        this.server.listen(this.port);
        resolve();
      });

      // Start periodic tasks
      this.startPeriodicTasks();

      console.log(`WebSocket server started on port ${this.port}`);
    } catch (error) {
      console.error('Failed to start WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Handles new socket connections with comprehensive error handling
   */
  private async handleConnection(socket: Socket): Promise<void> {
    try {
      // Initialize connection state
      this.connectionStates.set(socket.id, {
        connectedAt: new Date(),
        lastActivity: new Date(),
        subscriptions: new Set(),
        messageCount: 0,
        errors: 0
      });

      // Update metrics
      this.metrics.activeConnections++;

      // Set up event handlers with error boundaries
      this.setupEventHandlers(socket);

      // Set up disconnect handler
      socket.on('disconnect', () => this.handleDisconnect(socket));

      // Send connection acknowledgment
      socket.emit('connection.ack', {
        success: true,
        socketId: socket.id,
        timestamp: new Date()
      });
    } catch (error) {
      this.handleError(socket, error as Error);
    }
  }

  /**
   * Sets up event handlers for the socket
   */
  private setupEventHandlers(socket: Socket): void {
    // Handle occupancy updates
    socket.on(SocketEventType.OCCUPANCY_UPDATE, async (data) => {
      try {
        const event: ISocketEvent = {
          type: SocketEventType.OCCUPANCY_UPDATE,
          room: data.room,
          payload: data,
          timestamp: new Date()
        };
        await this.handleEvent(socket, event);
      } catch (error) {
        this.handleError(socket, error as Error);
      }
    });

    // Handle resource updates
    socket.on(SocketEventType.RESOURCE_UPDATE, async (data) => {
      try {
        const event: ISocketEvent = {
          type: SocketEventType.RESOURCE_UPDATE,
          room: data.room,
          payload: data,
          timestamp: new Date()
        };
        await this.handleEvent(socket, event);
      } catch (error) {
        this.handleError(socket, error as Error);
      }
    });

    // Handle subscriptions
    socket.on(SocketEventType.SUBSCRIPTION, async (data) => {
      try {
        await this.handleSubscription(socket, data);
      } catch (error) {
        this.handleError(socket, error as Error);
      }
    });
  }

  /**
   * Handles WebSocket events with error recovery
   */
  private async handleEvent(socket: Socket, event: ISocketEvent): Promise<void> {
    try {
      const state = this.connectionStates.get(socket.id);
      if (!state) {
        throw new Error('Connection state not found');
      }

      // Update activity timestamp
      state.lastActivity = new Date();
      state.messageCount++;

      // Get appropriate handler
      const handler = this.handlers.get(event.type);
      if (!handler) {
        throw new Error(`No handler registered for event type: ${event.type}`);
      }

      // Handle the event
      await handler.handleEvent(event, socket);

      // Update metrics
      this.updateMetrics(socket.id, true);
    } catch (error) {
      this.handleError(socket, error as Error);
    }
  }

  /**
   * Handles subscription requests
   */
  private async handleSubscription(socket: Socket, data: any): Promise<void> {
    try {
      const state = this.connectionStates.get(socket.id);
      if (!state) {
        throw new Error('Connection state not found');
      }

      // Add to room
      await socket.join(data.room);
      state.subscriptions.add(data.room);

      // Update metrics
      this.metrics.activeSubscriptions++;

      // Send acknowledgment
      socket.emit('subscription.ack', {
        success: true,
        room: data.room,
        timestamp: new Date()
      });
    } catch (error) {
      this.handleError(socket, error as Error);
    }
  }

  /**
   * Handles connection errors with recovery mechanisms
   */
  private handleError(socket: Socket, error: Error): void {
    try {
      // Update error metrics
      const state = this.connectionStates.get(socket.id);
      if (state) {
        state.errors++;
      }
      this.metrics.errorRate++;

      // Log error
      console.error(`Socket Error (${socket.id}):`, error);

      // Send error to client
      const response: ISocketResponse = {
        success: false,
        message: 'Operation failed',
        error: {
          code: SocketErrorCode.INTERNAL_ERROR,
          message: error.message
        },
        metadata: {
          timestamp: new Date()
        }
      };

      socket.emit(SocketEventType.ERROR, response);

      // Attempt recovery or disconnect on fatal errors
      if (state && state.errors >= 5) {
        socket.disconnect(true);
      }
    } catch (error) {
      console.error('Error in error handler:', error);
      socket.disconnect(true);
    }
  }

  /**
   * Performs health check
   */
  public async healthCheck(): Promise<IHealthCheckResult> {
    return {
      status: this.isShuttingDown ? ServiceHealthStatus.UNHEALTHY : ServiceHealthStatus.HEALTHY,
      timestamp: new Date(),
      details: {
        database: true,
        cache: true,
        dependencies: true,
        message: `Active connections: ${this.metrics.activeConnections}`
      },
      metrics: {
        uptime: process.uptime(),
        responseTime: this.metrics.avgResponseTime,
        activeConnections: this.metrics.activeConnections
      }
    };
  }

  /**
   * Gracefully stops the WebSocket server
   */
  public async stop(): Promise<void> {
    this.isShuttingDown = true;

    // Notify all clients
    this.server.emit(SocketEventType.ERROR, {
      success: false,
      message: 'Server shutting down',
      error: {
        code: SocketErrorCode.SERVICE_UNAVAILABLE,
        message: 'Server maintenance'
      }
    });

    // Close all connections
    const sockets = await this.server.fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }

    // Close server
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
  }

  /**
   * Authenticates incoming connections
   */
  private async authenticateConnection(socket: Socket): Promise<void> {
    const token = socket.handshake.auth.token;
    if (!token) {
      throw new Error('Authentication token required');
    }

    // Implement your authentication logic here
    // This is a placeholder for the actual implementation
    if (token === 'invalid') {
      throw new Error('Invalid authentication token');
    }
  }

  /**
   * Applies rate limiting to connections
   */
  private async applyRateLimit(socket: Socket): Promise<void> {
    try {
      await this.rateLimiter.consume(socket.handshake.address);
    } catch (error) {
      throw new Error('Rate limit exceeded');
    }
  }

  /**
   * Updates server metrics
   */
  private updateMetrics(socketId: string, success: boolean): void {
    const state = this.connectionStates.get(socketId);
    if (state) {
      this.metrics.messageRate = (this.metrics.messageRate + 1) / 2;
      if (!success) {
        this.metrics.errorRate = (this.metrics.errorRate + 1) / 2;
      }
    }
  }

  /**
   * Handles client disconnections
   */
  private handleDisconnect(socket: Socket): void {
    const state = this.connectionStates.get(socket.id);
    if (state) {
      this.metrics.activeConnections--;
      this.metrics.activeSubscriptions -= state.subscriptions.size;
      this.connectionStates.delete(socket.id);
    }
  }

  /**
   * Starts periodic maintenance tasks
   */
  private startPeriodicTasks(): void {
    // Clean up stale connections every 5 minutes
    setInterval(() => {
      const now = new Date();
      for (const [socketId, state] of this.connectionStates) {
        const inactiveTime = now.getTime() - state.lastActivity.getTime();
        if (inactiveTime > 300000) { // 5 minutes
          const socket = this.server.sockets.sockets.get(socketId);
          if (socket) {
            socket.disconnect(true);
          }
        }
      }
    }, 300000);

    // Update metrics every minute
    setInterval(() => {
      this.metrics = {
        ...this.metrics,
        activeConnections: this.server.engine.clientsCount,
        activeSubscriptions: Array.from(this.connectionStates.values())
          .reduce((acc, state) => acc + state.subscriptions.size, 0)
      };
    }, 60000);
  }
}