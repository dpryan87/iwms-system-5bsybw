/**
 * @fileoverview Enhanced User Controller with comprehensive security features
 * Implements secure user management endpoints with RBAC, audit logging, and rate limiting
 * @version 1.0.0
 */

// External dependencies
import { injectable, inject } from 'inversify'; // v6.0.1
import { 
  controller, 
  httpGet, 
  httpPost, 
  httpPut, 
  httpDelete,
  request,
  response
} from 'inversify-express-utils'; // v6.3.2
import { Request, Response } from 'express'; // v4.18.2
import rateLimit from 'express-rate-limit'; // v6.7.0
import helmet from 'helmet'; // v7.0.0
import { Logger } from 'winston'; // v3.8.2

// Internal imports
import { UserService } from '../services/user.service';
import { 
  IUser, 
  IUserCreate, 
  IUserUpdate, 
  IUserSecurityUpdate,
  UserRole 
} from '../interfaces/user.interface';
import { createUserSchema, updateUserSchema } from '../validation/user.schema';
import { validateSchema, ValidationError } from '../../../common/utils/validation.util';
import { ErrorCodes } from '../../../common/constants/error-codes';
import { TYPES } from '../../../common/constants/types';

// Rate limiting configuration
const rateLimitConfig = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

/**
 * Enhanced User Controller implementing secure user management operations
 * Includes RBAC, audit logging, and comprehensive security measures
 */
@injectable()
@controller('/api/users')
export class UserController {
  constructor(
    @inject(TYPES.UserService) private readonly userService: UserService,
    @inject(TYPES.Logger) private readonly logger: Logger
  ) {}

  /**
   * Creates a new user with enhanced security validation
   * @route POST /api/users
   */
  @httpPost('/')
  @rateLimitConfig
  async createUser(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      // Validate request body against schema
      const validationResult = await validateSchema(req.body, createUserSchema);
      if (!validationResult.isValid) {
        throw new ValidationError(
          'User creation validation failed',
          validationResult.errors || [],
          {
            source: 'user_creation',
            timestamp: Date.now(),
            validationType: 'schema',
            inputSize: JSON.stringify(req.body).length
          }
        );
      }

      // Check role-based permissions
      if (!this.hasPermission(req.user?.role, 'CREATE_USER')) {
        return res.status(ErrorCodes.AUTHORIZATION_ERROR).json({
          error: 'Insufficient permissions to create users',
          code: ErrorCodes.AUTHORIZATION_ERROR
        });
      }

      const userData: IUserCreate = req.body;
      const createdUser = await this.userService.createUser(userData);

      // Log audit trail
      this.logAuditEvent('USER_CREATED', req.user?.id, createdUser.id);

      return res.status(201).json(createdUser);

    } catch (error) {
      this.handleControllerError(error, req, res);
      return res.status(error.code || 500).json({
        error: error.message,
        code: error.code || ErrorCodes.INTERNAL_SERVER_ERROR
      });
    }
  }

  /**
   * Updates user data with security validation
   * @route PUT /api/users/:id
   */
  @httpPut('/:id')
  @rateLimitConfig
  async updateUser(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      const userId = req.params.id;
      
      // Validate request body
      const validationResult = await validateSchema(req.body, updateUserSchema);
      if (!validationResult.isValid) {
        throw new ValidationError(
          'User update validation failed',
          validationResult.errors || [],
          {
            source: 'user_update',
            timestamp: Date.now(),
            validationType: 'schema',
            inputSize: JSON.stringify(req.body).length
          }
        );
      }

      // Check update permissions
      if (!this.canUpdateUser(req.user, userId)) {
        return res.status(ErrorCodes.AUTHORIZATION_ERROR).json({
          error: 'Insufficient permissions to update user',
          code: ErrorCodes.AUTHORIZATION_ERROR
        });
      }

      const updateData: IUserUpdate = req.body;
      const updatedUser = await this.userService.updateUser(userId, updateData);

      // Log audit trail
      this.logAuditEvent('USER_UPDATED', req.user?.id, userId);

      return res.json(updatedUser);

    } catch (error) {
      this.handleControllerError(error, req, res);
      return res.status(error.code || 500).json({
        error: error.message,
        code: error.code || ErrorCodes.INTERNAL_SERVER_ERROR
      });
    }
  }

  /**
   * Deletes user with security checks
   * @route DELETE /api/users/:id
   */
  @httpDelete('/:id')
  @rateLimitConfig
  async deleteUser(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      const userId = req.params.id;

      // Check delete permissions
      if (!this.hasPermission(req.user?.role, 'DELETE_USER')) {
        return res.status(ErrorCodes.AUTHORIZATION_ERROR).json({
          error: 'Insufficient permissions to delete users',
          code: ErrorCodes.AUTHORIZATION_ERROR
        });
      }

      await this.userService.deleteUser(userId);

      // Log audit trail
      this.logAuditEvent('USER_DELETED', req.user?.id, userId);

      return res.status(204).send();

    } catch (error) {
      this.handleControllerError(error, req, res);
      return res.status(error.code || 500).json({
        error: error.message,
        code: error.code || ErrorCodes.INTERNAL_SERVER_ERROR
      });
    }
  }

  /**
   * Updates user security settings
   * @route PUT /api/users/:id/security
   */
  @httpPut('/:id/security')
  @rateLimitConfig
  async updateUserSecurity(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      const userId = req.params.id;
      const securityData: IUserSecurityUpdate = req.body;

      // Check security update permissions
      if (!this.hasPermission(req.user?.role, 'UPDATE_USER_SECURITY')) {
        return res.status(ErrorCodes.AUTHORIZATION_ERROR).json({
          error: 'Insufficient permissions to update security settings',
          code: ErrorCodes.AUTHORIZATION_ERROR
        });
      }

      await this.userService.updateUserSecurity(userId, securityData);

      // Log security audit trail
      this.logSecurityEvent('SECURITY_SETTINGS_UPDATED', req.user?.id, userId);

      return res.status(200).send();

    } catch (error) {
      this.handleControllerError(error, req, res);
      return res.status(error.code || 500).json({
        error: error.message,
        code: error.code || ErrorCodes.INTERNAL_SERVER_ERROR
      });
    }
  }

  /**
   * Checks if user has required role-based permission
   * @private
   */
  private hasPermission(userRole?: string, requiredPermission?: string): boolean {
    const roleHierarchy = {
      [UserRole.SYSTEM_ADMIN]: ['CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'UPDATE_USER_SECURITY'],
      [UserRole.FACILITY_MANAGER]: ['CREATE_USER', 'UPDATE_USER'],
      [UserRole.BU_ADMIN]: ['UPDATE_USER']
    };

    return userRole ? 
      roleHierarchy[userRole]?.includes(requiredPermission) || false : 
      false;
  }

  /**
   * Validates if user can update target user
   * @private
   */
  private canUpdateUser(requestUser: any, targetUserId: string): boolean {
    if (!requestUser) return false;

    // System admins can update anyone
    if (requestUser.role === UserRole.SYSTEM_ADMIN) return true;

    // Users can only update themselves unless they have higher privileges
    return requestUser.id === targetUserId;
  }

  /**
   * Handles and logs controller errors
   * @private
   */
  private handleControllerError(error: any, req: Request, res: Response): void {
    this.logger.error('User controller error:', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      timestamp: new Date()
    });
  }

  /**
   * Logs audit events
   * @private
   */
  private logAuditEvent(
    action: string,
    userId?: string,
    targetId?: string
  ): void {
    this.logger.info('User Audit Trail', {
      action,
      userId,
      targetId,
      timestamp: new Date(),
      source: 'user_controller'
    });
  }

  /**
   * Logs security events
   * @private
   */
  private logSecurityEvent(
    event: string,
    userId?: string,
    targetId?: string
  ): void {
    this.logger.warn('Security Event', {
      event,
      userId,
      targetId,
      timestamp: new Date(),
      severity: 'HIGH'
    });
  }
}