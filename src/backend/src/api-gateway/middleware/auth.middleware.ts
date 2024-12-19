// @package express v4.18.2
// @package inversify v6.0.1
// @package winston v3.8.2
// @package rate-limiter-flexible v2.4.1

import { Request, Response, NextFunction } from 'express';
import { injectable } from 'inversify';
import { Logger } from 'winston';
import { RateLimiter } from 'rate-limiter-flexible';

import { SSOService } from '../../integrations/sso/sso.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { ISSOUser, MFAType } from '../../integrations/sso/interfaces/sso.interface';

/**
 * Enhanced request interface with user context
 */
interface AuthenticatedRequest extends Request {
  user?: ISSOUser;
  token?: string;
}

/**
 * Role hierarchy configuration for RBAC
 */
const ROLE_HIERARCHY = {
  'system_admin': ['facility_manager', 'space_planner', 'bu_admin'],
  'facility_manager': ['space_planner', 'bu_admin'],
  'space_planner': ['bu_admin'],
  'bu_admin': []
};

/**
 * Enhanced authentication middleware implementing comprehensive security features
 * including JWT validation, RBAC, rate limiting, and audit logging
 */
@injectable()
export class AuthMiddleware {
  private readonly logger: Logger;
  private readonly ssoService: SSOService;
  private readonly rateLimiter: RateLimiter;
  private readonly roleCache: Map<string, string[]>;
  private readonly tokenExpiryBuffer: number = 300; // 5 minutes in seconds
  private readonly securityHeaders = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Content-Security-Policy': "default-src 'self'",
  };

  constructor(
    logger: Logger,
    ssoService: SSOService,
    rateLimiter: RateLimiter
  ) {
    this.logger = logger;
    this.ssoService = ssoService;
    this.rateLimiter = rateLimiter;
    this.roleCache = new Map();
  }

  /**
   * Express middleware function implementing comprehensive authentication and authorization
   */
  public authenticate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Apply security headers
      Object.entries(this.securityHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      // Rate limiting check
      await this.checkRateLimit(req.ip);

      // Extract JWT token
      const token = this.extractToken(req);
      if (!token) {
        throw new Error('No authentication token provided');
      }

      // Validate token
      const isValid = await this.ssoService.validateToken(token, {
        clockTolerance: this.tokenExpiryBuffer
      });

      if (!isValid) {
        throw new Error('Invalid authentication token');
      }

      // Get user information
      const user = await this.ssoService.getUserInfo(token);

      // Validate MFA if required
      await this.validateMFA(user);

      // Check required roles
      const requiredRoles = this.getRequiredRoles(req);
      if (requiredRoles.length > 0) {
        const hasAccess = await this.validateRole(user.roles, requiredRoles);
        if (!hasAccess) {
          throw new Error('Insufficient permissions');
        }
      }

      // Attach user context to request
      req.user = user;
      req.token = token;

      // Log successful authentication
      this.logSecurityEvent('authentication_success', req, user);

      next();
    } catch (error) {
      this.logSecurityEvent('authentication_failure', req, undefined, error);

      if (error.message === 'Rate limit exceeded') {
        res.status(ErrorCodes.RATE_LIMIT_ERROR).json({
          error: 'Too many requests',
          code: ErrorCodes.RATE_LIMIT_ERROR
        });
        return;
      }

      if (error.message === 'Insufficient permissions') {
        res.status(ErrorCodes.AUTHORIZATION_ERROR).json({
          error: 'Access denied',
          code: ErrorCodes.AUTHORIZATION_ERROR
        });
        return;
      }

      res.status(ErrorCodes.AUTHENTICATION_ERROR).json({
        error: 'Authentication failed',
        code: ErrorCodes.AUTHENTICATION_ERROR
      });
    }
  };

  /**
   * Validates user roles against required roles with hierarchy support
   */
  private async validateRole(
    userRoles: string[],
    requiredRoles: string[]
  ): Promise<boolean> {
    // Check role cache first
    const cacheKey = `${userRoles.join(',')}_${requiredRoles.join(',')}`;
    const cachedResult = this.roleCache.get(cacheKey);
    if (cachedResult) {
      return true;
    }

    // Evaluate role hierarchy
    const effectiveRoles = new Set<string>();
    userRoles.forEach(role => {
      effectiveRoles.add(role);
      const inheritedRoles = ROLE_HIERARCHY[role] || [];
      inheritedRoles.forEach(r => effectiveRoles.add(r));
    });

    const hasAccess = requiredRoles.some(role => effectiveRoles.has(role));

    // Cache successful results
    if (hasAccess) {
      this.roleCache.set(cacheKey, userRoles);
      // Cleanup cache after 5 minutes
      setTimeout(() => this.roleCache.delete(cacheKey), 300000);
    }

    return hasAccess;
  }

  /**
   * Extracts JWT token from request headers or query parameters
   */
  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return req.query.token as string || null;
  }

  /**
   * Validates MFA requirements for user
   */
  private async validateMFA(user: ISSOUser): Promise<void> {
    if (user.roles.includes('system_admin') && !user.mfaEnabled) {
      throw new Error('MFA required for administrative access');
    }

    if (user.mfaEnabled && user.mfaType === MFAType.TOTP) {
      // Additional MFA validation logic here
      // This would typically involve validating a TOTP code
      // For now, we just check if MFA is enabled
    }
  }

  /**
   * Extracts required roles from request path and method
   */
  private getRequiredRoles(req: Request): string[] {
    // Example role mapping - should be configured based on API routes
    const roleMap = {
      '/api/v1/admin': ['system_admin'],
      '/api/v1/facilities': ['facility_manager'],
      '/api/v1/spaces': ['space_planner'],
      '/api/v1/business-units': ['bu_admin']
    };

    // Find matching path and return required roles
    for (const [path, roles] of Object.entries(roleMap)) {
      if (req.path.startsWith(path)) {
        return roles;
      }
    }

    return [];
  }

  /**
   * Checks rate limit for requesting IP
   */
  private async checkRateLimit(ip: string): Promise<void> {
    try {
      await this.rateLimiter.consume(ip);
    } catch (error) {
      throw new Error('Rate limit exceeded');
    }
  }

  /**
   * Logs security-related events with detailed context
   */
  private logSecurityEvent(
    eventType: string,
    req: Request,
    user?: ISSOUser,
    error?: Error
  ): void {
    this.logger.info('Security event', {
      eventType,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      method: req.method,
      userId: user?.id,
      userRoles: user?.roles,
      error: error?.message,
      correlationId: req.headers['x-correlation-id']
    });
  }
}

export default AuthMiddleware;