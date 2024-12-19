/**
 * @fileoverview Enhanced WebSocket handler for real-time occupancy events
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // v6.0.x
import { Socket, Server } from 'socket.io'; // v4.6.0
import { Subject, Subscription } from 'rxjs'; // v7.8.x
import { bufferTime, retryWhen, delay } from 'rxjs/operators'; // v7.8.x

import { 
  ISocketHandler, 
  ISocketEvent, 
  SocketEventType, 
  SocketErrorCode,
  ISocketResponse,
  ISocketSubscription 
} from '../interfaces/socket.interface';
import { OccupancyService } from '../../core/occupancy/services/occupancy.service';
import { logger } from '../../common/utils/logger.util';
import { IOccupancyData } from '../../core/occupancy/interfaces/occupancy.interface';

interface OccupancyUpdate {
  spaceId: string;
  data: IOccupancyData;
  timestamp: Date;
}

/**
 * Enhanced WebSocket handler for real-time occupancy events with robust error handling
 * and connection management
 */
@injectable()
export class OccupancyHandler implements ISocketHandler {
  private readonly subscriptions: Map<string, Subscription>;
  private readonly updateBuffer: Subject<OccupancyUpdate>;
  private readonly bufferInterval = 100; // milliseconds
  private readonly maxRetries = 3;
  private readonly healthCheckInterval = 30000; // 30 seconds
  private healthCheckTimer: NodeJS.Timer | null = null;

  constructor(
    private readonly server: Server,
    private readonly occupancyService: OccupancyService
  ) {
    this.subscriptions = new Map();
    this.updateBuffer = new Subject<OccupancyUpdate>();
    this.initializeBufferProcessing();
    this.startHealthCheck();
  }

  /**
   * Handles incoming WebSocket events with comprehensive error handling
   */
  public async handleEvent(event: ISocketEvent, socket: Socket): Promise<void> {
    try {
      logger.debug('Processing occupancy event', {
        type: event.type,
        room: event.room,
        socketId: socket.id
      });

      switch (event.type) {
        case SocketEventType.SUBSCRIPTION:
          await this.handleSubscription(socket, event.room);
          break;

        case SocketEventType.UNSUBSCRIPTION:
          await this.handleUnsubscription(socket, event.room);
          break;

        case SocketEventType.OCCUPANCY_UPDATE:
          await this.handleOccupancyUpdate(event.payload as IOccupancyData);
          break;

        default:
          throw new Error(`Unsupported event type: ${event.type}`);
      }
    } catch (error) {
      logger.error('Error handling occupancy event', error);
      this.sendErrorResponse(socket, {
        code: SocketErrorCode.INTERNAL_ERROR,
        message: 'Failed to process occupancy event',
        details: error
      });
    }
  }

  /**
   * Manages client subscriptions to space occupancy updates
   */
  private async handleSubscription(socket: Socket, spaceId: string): Promise<void> {
    try {
      // Validate space ID and permissions
      const occupancyData = await this.occupancyService.getCurrentOccupancy(spaceId);
      if (!occupancyData.success) {
        throw new Error(`Invalid space ID: ${spaceId}`);
      }

      // Set up subscription with retry logic
      const subscription = this.occupancyService.subscribeToUpdates(spaceId)
        .pipe(
          retryWhen(errors => 
            errors.pipe(
              delay(1000),
              take(this.maxRetries)
            )
          )
        )
        .subscribe({
          next: (data) => {
            this.updateBuffer.next({
              spaceId,
              data,
              timestamp: new Date()
            });
          },
          error: (error) => {
            logger.error('Subscription error', { spaceId, error });
            this.handleSubscriptionError(socket, spaceId, error);
          }
        });

      // Store subscription for cleanup
      const subscriptionKey = `${socket.id}:${spaceId}`;
      this.subscriptions.set(subscriptionKey, subscription);

      // Join room and send initial data
      socket.join(spaceId);
      socket.emit('occupancy:subscribed', {
        success: true,
        data: occupancyData.data
      });

      logger.info('Client subscribed to occupancy updates', {
        socketId: socket.id,
        spaceId
      });
    } catch (error) {
      logger.error('Subscription error', { spaceId, error });
      this.sendErrorResponse(socket, {
        code: SocketErrorCode.SUBSCRIPTION_FAILED,
        message: 'Failed to subscribe to occupancy updates',
        details: error
      });
    }
  }

  /**
   * Handles client unsubscription and cleanup
   */
  private async handleUnsubscription(socket: Socket, spaceId: string): Promise<void> {
    try {
      const subscriptionKey = `${socket.id}:${spaceId}`;
      const subscription = this.subscriptions.get(subscriptionKey);

      if (subscription) {
        subscription.unsubscribe();
        this.subscriptions.delete(subscriptionKey);
      }

      socket.leave(spaceId);
      socket.emit('occupancy:unsubscribed', {
        success: true,
        message: `Unsubscribed from space ${spaceId}`
      });

      logger.info('Client unsubscribed from occupancy updates', {
        socketId: socket.id,
        spaceId
      });
    } catch (error) {
      logger.error('Unsubscription error', { spaceId, error });
      this.sendErrorResponse(socket, {
        code: SocketErrorCode.INTERNAL_ERROR,
        message: 'Failed to unsubscribe from occupancy updates',
        details: error
      });
    }
  }

  /**
   * Processes and broadcasts occupancy updates with validation
   */
  private async handleOccupancyUpdate(occupancyData: IOccupancyData): Promise<void> {
    try {
      const result = await this.occupancyService.updateOccupancyData(occupancyData, {
        validateSensor: true,
        requireMetadata: true
      });

      if (!result.success) {
        throw new Error('Failed to update occupancy data');
      }

      this.server.to(occupancyData.spaceId).emit('occupancy:update', {
        success: true,
        data: occupancyData
      });
    } catch (error) {
      logger.error('Error processing occupancy update', { 
        spaceId: occupancyData.spaceId,
        error 
      });
      this.broadcastError(occupancyData.spaceId, {
        code: SocketErrorCode.BROADCAST_FAILED,
        message: 'Failed to broadcast occupancy update',
        details: error
      });
    }
  }

  /**
   * Initializes buffered processing of occupancy updates
   */
  private initializeBufferProcessing(): void {
    this.updateBuffer
      .pipe(bufferTime(this.bufferInterval))
      .subscribe(updates => {
        if (updates.length > 0) {
          this.processBatchUpdates(updates);
        }
      });
  }

  /**
   * Processes batched occupancy updates for improved performance
   */
  private async processBatchUpdates(updates: OccupancyUpdate[]): Promise<void> {
    try {
      const batchResult = await this.occupancyService.batchUpdateOccupancy(
        updates.map(u => u.data),
        {
          validateAll: true,
          continueOnError: true,
          maxConcurrent: 10
        }
      );

      if (!batchResult.success) {
        logger.error('Batch update failed', batchResult.error);
      }
    } catch (error) {
      logger.error('Error processing batch updates', error);
    }
  }

  /**
   * Performs periodic health checks on subscriptions
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.subscriptions.forEach((subscription, key) => {
        if (!subscription.closed) {
          const [socketId, spaceId] = key.split(':');
          const socket = this.server.sockets.sockets.get(socketId);
          
          if (!socket?.connected) {
            logger.warn('Cleaning up disconnected subscription', { socketId, spaceId });
            subscription.unsubscribe();
            this.subscriptions.delete(key);
          }
        }
      });
    }, this.healthCheckInterval);
  }

  /**
   * Sends error response to client
   */
  private sendErrorResponse(socket: Socket, error: any): void {
    const response: ISocketResponse = {
      success: false,
      message: error.message,
      error: {
        code: error.code || SocketErrorCode.INTERNAL_ERROR,
        message: error.message,
        details: error.details
      },
      metadata: {
        timestamp: new Date(),
        server: process.env.SERVER_ID
      }
    };
    socket.emit('error', response);
  }

  /**
   * Broadcasts error to all clients in a room
   */
  private broadcastError(room: string, error: any): void {
    const response: ISocketResponse = {
      success: false,
      message: error.message,
      error: {
        code: error.code || SocketErrorCode.BROADCAST_FAILED,
        message: error.message,
        details: error.details
      },
      metadata: {
        timestamp: new Date(),
        server: process.env.SERVER_ID
      }
    };
    this.server.to(room).emit('error', response);
  }

  /**
   * Handles subscription errors with retry logic
   */
  private handleSubscriptionError(socket: Socket, spaceId: string, error: any): void {
    this.sendErrorResponse(socket, {
      code: SocketErrorCode.SUBSCRIPTION_FAILED,
      message: 'Subscription error occurred',
      details: error
    });

    const subscriptionKey = `${socket.id}:${spaceId}`;
    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionKey);
    }
  }
}