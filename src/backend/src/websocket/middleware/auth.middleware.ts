// @package socket.io v4.6.0
import { Socket } from 'socket.io';
import { NextFunction } from 'socket.io';
import { ISocketEvent, SocketErrorCode } from '../interfaces/socket.interface';
import { ISSOService } from '../../integrations/sso/interfaces/sso.interface';
import { ErrorCodes } from '../../common/constants/error-codes';

/**
 * Rate limiting configuration for WebSocket connections
 */
const RATE_LIMIT_CONFIG = {
  maxConnectionsPerUser: 5,
  maxEventsPerMinute: 100,
  blockDurationMs: 300000, // 5 minutes
};

/**
 * Required permissions for different WebSocket event types
 */
const EVENT_PERMISSIONS = {
  'occupancy.update': ['read:occupancy'],
  'resource.update': ['write:resources'],
  'subscription.add': ['read:subscriptions'],
  'subscription.remove': ['write:subscriptions'],
  'system.health': ['read:system'],
};

/**
 * Interface for authenticated socket user data
 */
interface IAuthenticatedSocketData {
  userId: string;
  roles: string[];
  permissions: string[];
  mfaVerified: boolean;
  lastActivity: Date;
  connectionCount: number;
}

/**
 * WebSocket authentication middleware
 * Validates JWT tokens, MFA status, and role-based permissions
 * 
 * @param socket - Socket.IO socket instance
 * @param next - Next middleware function
 */
export const authenticateSocket = async (
  socket: Socket,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(socket);
    if (!token) {
      throw new Error('Authentication token missing');
    }

    const ssoService = getSSOService(); // Injected SSO service
    const isValidToken = await ssoService.validateToken(token, {
      audience: 'iwms-websocket',
      issuer: 'iwms-auth',
      clockTolerance: 30, // 30 seconds tolerance
    });

    if (!isValidToken) {
      throw new Error('Invalid or expired token');
    }

    const userInfo = await ssoService.getUserInfo(token);
    
    // Validate MFA if required for user role
    if (requiresMFA(userInfo.roles) && !userInfo.mfaEnabled) {
      throw new Error('MFA verification required');
    }

    // Check connection limits
    const connectionCount = await getConnectionCount(userInfo.id);
    if (connectionCount >= RATE_LIMIT_CONFIG.maxConnectionsPerUser) {
      throw new Error('Maximum connection limit exceeded');
    }

    // Attach authenticated user data to socket
    socket.data.auth = {
      userId: userInfo.id,
      roles: userInfo.roles,
      permissions: userInfo.permissions,
      mfaVerified: userInfo.mfaEnabled,
      lastActivity: new Date(),
      connectionCount: connectionCount + 1,
    } as IAuthenticatedSocketData;

    // Set up disconnect handler to clean up resources
    socket.on('disconnect', () => {
      handleDisconnect(socket);
    });

    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    socket.emit('error', {
      code: SocketErrorCode.UNAUTHORIZED,
      message: errorMessage,
    });
    socket.disconnect(true);
  }
};

/**
 * Validates socket authentication and authorization for specific events
 * 
 * @param socket - Socket.IO socket instance
 * @param event - Socket event to validate
 * @returns boolean indicating if socket is authenticated and authorized
 */
export const validateSocketAuth = (
  socket: Socket,
  event: ISocketEvent
): boolean => {
  try {
    const auth = socket.data.auth as IAuthenticatedSocketData;
    
    // Verify authenticated session exists
    if (!auth || !auth.userId) {
      throw new Error('Unauthenticated socket connection');
    }

    // Verify required permissions for event type
    const requiredPermissions = EVENT_PERMISSIONS[event.type];
    if (requiredPermissions && !hasPermissions(auth.permissions, requiredPermissions)) {
      throw new Error('Insufficient permissions for event');
    }

    // Validate room access if specified
    if (event.room && !canAccessRoom(auth, event.room)) {
      throw new Error('Unauthorized room access');
    }

    // Update last activity timestamp
    auth.lastActivity = new Date();
    
    return true;
  } catch (error) {
    socket.emit('error', {
      code: SocketErrorCode.UNAUTHORIZED,
      message: error instanceof Error ? error.message : 'Authorization failed',
    });
    return false;
  }
};

/**
 * Extracts JWT token from socket handshake
 */
const extractToken = (socket: Socket): string | null => {
  const authHeader = socket.handshake.auth.token || 
                    socket.handshake.headers.authorization;
  
  if (!authHeader) return null;
  
  return authHeader.replace('Bearer ', '');
};

/**
 * Checks if user role requires MFA
 */
const requiresMFA = (roles: string[]): boolean => {
  const mfaRequiredRoles = ['admin', 'facility_manager'];
  return roles.some(role => mfaRequiredRoles.includes(role));
};

/**
 * Gets current connection count for user
 */
const getConnectionCount = async (userId: string): Promise<number> => {
  // Implementation would track active connections per user
  // Typically using Redis or similar store
  return 0; // Placeholder
};

/**
 * Validates if user has required permissions
 */
const hasPermissions = (
  userPermissions: string[],
  requiredPermissions: string[]
): boolean => {
  return requiredPermissions.every(
    permission => userPermissions.includes(permission)
  );
};

/**
 * Validates if user can access specified room
 */
const canAccessRoom = (auth: IAuthenticatedSocketData, room: string): boolean => {
  // Room access validation logic based on user roles and permissions
  // Example: floor-{floorId}, building-{buildingId}
  const [resourceType, resourceId] = room.split('-');
  
  // Admin can access all rooms
  if (auth.roles.includes('admin')) return true;
  
  // Implement specific access rules based on resource type
  switch (resourceType) {
    case 'floor':
      return auth.permissions.includes('read:floor');
    case 'building':
      return auth.permissions.includes('read:building');
    default:
      return false;
  }
};

/**
 * Handles socket disconnect cleanup
 */
const handleDisconnect = (socket: Socket): void => {
  const auth = socket.data.auth as IAuthenticatedSocketData;
  if (auth && auth.userId) {
    // Clean up user connection count and resources
    // Implementation would update connection tracking
  }
};

/**
 * Gets SSO service instance
 * In real implementation, this would be injected via dependency injection
 */
const getSSOService = (): ISSOService => {
  throw new Error('SSO Service not implemented');
};