// @package inversify v6.0.1
// @package socket.io v4.6.0
// @package winston v3.8.2
// @package rate-limiter-flexible v2.4.1
import { injectable } from 'inversify';
import { Server, Socket } from 'socket.io';
import { Logger } from 'winston';
import { RateLimiterMemory } from 'rate-limiter-flexible';

import { ISocketHandler, ISocketEvent, SocketEventType, SocketErrorCode } from '../interfaces/socket.interface';
import { ResourceService } from '../../core/resources/services/resource.service';
import { validateSchema } from '../../common/utils/validation.util';
import { ResourceStatus } from '../../core/resources/interfaces/resource.interface';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../common/constants/messages';
import { ErrorCodes } from '../../common/constants/error-codes';

/**
 * Enhanced WebSocket handler for resource-related events
 * Implements real-time resource updates with security and performance optimizations
 */
@injectable()
export class ResourceHandler implements ISocketHandler {
  private readonly rateLimiter: RateLimiterMemory;
  private readonly retryAttempts: Map<string, number>;
  private readonly maxRetries: number = 3;
  private readonly broadcastLimit: number = 100; // broadcasts per minute

  constructor(
    private readonly server: Server,
    private readonly resourceService: ResourceService,
    private readonly logger: Logger
  ) {
    this.retryAttempts = new Map();
    this.rateLimiter = new RateLimiterMemory({
      points: this.broadcastLimit,
      duration: 60 // per minute
    });
    
    this.logger.info('Initializing ResourceHandler with enhanced security');
  }

  /**
   * Handles incoming WebSocket events for resources
   * Implements comprehensive validation and error handling
   */
  async handleEvent(event: ISocketEvent, socket: Socket): Promise<void> {
    try {
      // Validate event structure
      const validationResult = await validateSchema(event, 'socketEventSchema');
      if (!validationResult.isValid) {
        throw new Error(ERROR_MESSAGES.VALIDATION_ERROR.replace(
          '{details}',
          validationResult.errors?.join(', ') || ''
        ));
      }

      // Rate limiting check
      try {
        await this.rateLimiter.consume(socket.id);
      } catch (error) {
        socket.emit('error', {
          code: SocketErrorCode.RATE_LIMITED,
          message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED.replace(
            '{retryAfter}',
            '60'
          )
        });
        return;
      }

      switch (event.type) {
        case SocketEventType.RESOURCE_UPDATE:
          await this.handleResourceUpdate(event, socket);
          break;

        case SocketEventType.SUBSCRIPTION:
          await this.handleSubscription(socket, event);
          break;

        case SocketEventType.UNSUBSCRIPTION:
          await this.handleUnsubscription(socket, event);
          break;

        default:
          throw new Error(`Unsupported event type: ${event.type}`);
      }

    } catch (error) {
      this.logger.error('Error handling resource event', {
        eventType: event.type,
        socketId: socket.id,
        error: error.message
      });

      socket.emit('error', {
        code: SocketErrorCode.INTERNAL_ERROR,
        message: error.message
      });
    }
  }

  /**
   * Handles resource update events with retry mechanism
   * @private
   */
  private async handleResourceUpdate(event: ISocketEvent, socket: Socket): Promise<void> {
    const { resourceId, updates } = event.payload;
    const retryKey = `${socket.id}:${resourceId}`;

    try {
      // Validate resource exists
      const resource = await this.resourceService.getResource(resourceId);
      if (!resource) {
        throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND.replace(
          '{resourceId}',
          resourceId
        ));
      }

      // Validate status transition if included
      if (updates.status) {
        const isValidTransition = await this.resourceService.validateStatusTransition(
          resource.status as ResourceStatus,
          updates.status as ResourceStatus
        );

        if (!isValidTransition) {
          throw new Error(`Invalid status transition from ${resource.status} to ${updates.status}`);
        }
      }

      // Update resource with retry mechanism
      const retryCount = this.retryAttempts.get(retryKey) || 0;
      try {
        const updatedResource = await this.resourceService.updateResource(
          resourceId,
          updates
        );

        // Broadcast successful update
        await this.broadcastResourceUpdate(event.room, {
          type: 'UPDATE_SUCCESS',
          resource: updatedResource
        });

        // Clear retry count on success
        this.retryAttempts.delete(retryKey);

        socket.emit('success', {
          message: SUCCESS_MESSAGES.RESOURCE_UPDATED.replace(
            '{resourceType}',
            'Resource'
          ).replace('{changeCount}', '1')
        });

      } catch (error) {
        if (retryCount < this.maxRetries) {
          this.retryAttempts.set(retryKey, retryCount + 1);
          // Exponential backoff retry
          setTimeout(() => {
            this.handleResourceUpdate(event, socket);
          }, Math.pow(2, retryCount) * 1000);
        } else {
          this.retryAttempts.delete(retryKey);
          throw error;
        }
      }

    } catch (error) {
      this.logger.error('Resource update failed', {
        resourceId,
        error: error.message
      });

      socket.emit('error', {
        code: SocketErrorCode.INTERNAL_ERROR,
        message: error.message
      });
    }
  }

  /**
   * Handles subscription requests to resource updates
   * @private
   */
  private async handleSubscription(socket: Socket, event: ISocketEvent): Promise<void> {
    try {
      const { room } = event;

      // Validate room format
      if (!room.match(/^resource:[a-zA-Z0-9-]+$/)) {
        throw new Error('Invalid room format');
      }

      await socket.join(room);
      
      socket.emit('success', {
        message: `Subscribed to ${room}`,
        room
      });

      this.logger.debug('Client subscribed to room', {
        socketId: socket.id,
        room
      });

    } catch (error) {
      socket.emit('error', {
        code: SocketErrorCode.SUBSCRIPTION_FAILED,
        message: error.message
      });
    }
  }

  /**
   * Handles unsubscription requests from resource updates
   * @private
   */
  private async handleUnsubscription(socket: Socket, event: ISocketEvent): Promise<void> {
    try {
      const { room } = event;
      await socket.leave(room);
      
      socket.emit('success', {
        message: `Unsubscribed from ${room}`,
        room
      });

      this.logger.debug('Client unsubscribed from room', {
        socketId: socket.id,
        room
      });

    } catch (error) {
      socket.emit('error', {
        code: SocketErrorCode.INTERNAL_ERROR,
        message: error.message
      });
    }
  }

  /**
   * Broadcasts resource updates to subscribed clients with rate limiting
   * @private
   */
  private async broadcastResourceUpdate(room: string, data: any): Promise<void> {
    try {
      // Add metadata to broadcast
      const broadcastData = {
        ...data,
        timestamp: new Date().toISOString(),
        messageId: Math.random().toString(36).substring(7)
      };

      await this.server.to(room).emit('resource:update', broadcastData);

      this.logger.debug('Resource update broadcasted', {
        room,
        messageId: broadcastData.messageId
      });

    } catch (error) {
      this.logger.error('Broadcast failed', {
        room,
        error: error.message
      });
      throw error;
    }
  }
}