/**
 * @fileoverview Main API Gateway routing configuration with enhanced security,
 * monitoring, and regional support for the IWMS application
 * @version 1.0.0
 */

import { Router, Request, Response, NextFunction } from 'express'; // v4.18.2
import { injectable } from 'inversify'; // v6.0.1
import { OpenAPIValidator } from 'express-openapi-validator'; // v4.13.0
import { Logger } from 'winston'; // v3.8.2
import { kongConfig } from '../config/kong.config';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { ErrorCodes } from '../../common/constants/error-codes';
import { ERROR_MESSAGES } from '../../common/constants/messages';

// Constants for API configuration
const API_PREFIX = '/api/v1';
const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/auth/refresh'];
const RATE_LIMIT_WINDOW = 3600000; // 1 hour in milliseconds
const RATE_LIMIT_MAX_REQUESTS = 1000;
const SUPPORTED_REGIONS = ['us-east', 'us-west', 'eu-west', 'ap-east'];
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'ja'];

/**
 * Enhanced API routes configuration class with security and monitoring
 */
@injectable()
export class ApiRoutes {
  private router: Router;
  private readonly authMiddleware: AuthMiddleware;
  private readonly logger: Logger;
  private readonly validator: OpenAPIValidator;

  constructor(
    authMiddleware: AuthMiddleware,
    logger: Logger
  ) {
    this.router = Router();
    this.authMiddleware = authMiddleware;
    this.logger = logger;
    this.validator = new OpenAPIValidator({
      apiSpec: './openapi.yaml',
      validateRequests: true,
      validateResponses: true
    });
  }

  /**
   * Configures all API routes with enhanced security and monitoring
   */
  public configureRoutes(): Router {
    // Apply base middleware
    this.setupBaseMiddleware();

    // Configure route groups
    this.setupFloorPlanRoutes();
    this.setupLeaseRoutes();
    this.setupOccupancyRoutes();
    this.setupResourceRoutes();

    // Error handling middleware
    this.setupErrorHandling();

    return this.router;
  }

  /**
   * Sets up base middleware for all routes
   */
  private setupBaseMiddleware(): void {
    // Request logging
    this.router.use(this.logRequest.bind(this));

    // Region validation
    this.router.use(this.validateRegion.bind(this));

    // Rate limiting
    this.router.use(rateLimitMiddleware.createRateLimitMiddleware({
      windowMs: RATE_LIMIT_WINDOW,
      max: RATE_LIMIT_MAX_REQUESTS
    }));

    // Authentication for protected routes
    this.router.use((req: Request, res: Response, next: NextFunction) => {
      if (!PUBLIC_ROUTES.includes(req.path)) {
        return this.authMiddleware.authenticate(req, res, next);
      }
      next();
    });

    // OpenAPI validation
    this.router.use(this.validator.middleware());
  }

  /**
   * Configures floor plan management routes
   */
  private setupFloorPlanRoutes(): void {
    const floorPlanRouter = Router();

    floorPlanRouter.get('/', this.handleAsyncRoute(async (req: Request, res: Response) => {
      // Get floor plans with regional filtering
      const region = req.headers['x-region'] as string;
      const response = await kongConfig.services
        .find(s => s.name === 'floor-plan-service')
        ?.url + '/floor-plans';
      res.json(response);
    }));

    floorPlanRouter.post('/', this.handleAsyncRoute(async (req: Request, res: Response) => {
      // Create floor plan with validation
      const response = await kongConfig.services
        .find(s => s.name === 'floor-plan-service')
        ?.url + '/floor-plans';
      res.status(201).json(response);
    }));

    this.router.use(`${API_PREFIX}/floor-plans`, floorPlanRouter);
  }

  /**
   * Configures lease management routes
   */
  private setupLeaseRoutes(): void {
    const leaseRouter = Router();

    leaseRouter.get('/', this.handleAsyncRoute(async (req: Request, res: Response) => {
      // Get leases with filtering
      const response = await kongConfig.services
        .find(s => s.name === 'lease-service')
        ?.url + '/leases';
      res.json(response);
    }));

    leaseRouter.post('/', this.handleAsyncRoute(async (req: Request, res: Response) => {
      // Create lease with validation
      const response = await kongConfig.services
        .find(s => s.name === 'lease-service')
        ?.url + '/leases';
      res.status(201).json(response);
    }));

    this.router.use(`${API_PREFIX}/leases`, leaseRouter);
  }

  /**
   * Configures occupancy monitoring routes
   */
  private setupOccupancyRoutes(): void {
    const occupancyRouter = Router();

    occupancyRouter.get('/', this.handleAsyncRoute(async (req: Request, res: Response) => {
      // Get real-time occupancy data
      const response = await kongConfig.services
        .find(s => s.name === 'occupancy-service')
        ?.url + '/occupancy';
      res.json(response);
    }));

    this.router.use(`${API_PREFIX}/occupancy`, occupancyRouter);
  }

  /**
   * Configures resource management routes
   */
  private setupResourceRoutes(): void {
    const resourceRouter = Router();

    resourceRouter.get('/', this.handleAsyncRoute(async (req: Request, res: Response) => {
      // Get resources with filtering
      const response = await kongConfig.services
        .find(s => s.name === 'resource-service')
        ?.url + '/resources';
      res.json(response);
    }));

    this.router.use(`${API_PREFIX}/resources`, resourceRouter);
  }

  /**
   * Sets up error handling middleware
   */
  private setupErrorHandling(): void {
    this.router.use((err: any, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('API Error:', {
        error: err,
        path: req.path,
        method: req.method,
        correlationId: req.headers['x-correlation-id']
      });

      res.status(err.status || ErrorCodes.INTERNAL_SERVER_ERROR).json({
        error: {
          code: err.code || ErrorCodes.INTERNAL_SERVER_ERROR,
          message: err.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
        }
      });
    });
  }

  /**
   * Validates region header for regional routing
   */
  private validateRegion(req: Request, res: Response, next: NextFunction): void {
    const region = req.headers['x-region'] as string;
    if (region && !SUPPORTED_REGIONS.includes(region)) {
      res.status(ErrorCodes.VALIDATION_ERROR).json({
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Unsupported region specified'
        }
      });
      return;
    }
    next();
  }

  /**
   * Logs incoming requests with correlation ID
   */
  private logRequest(req: Request, res: Response, next: NextFunction): void {
    this.logger.info('Incoming request', {
      path: req.path,
      method: req.method,
      correlationId: req.headers['x-correlation-id'],
      region: req.headers['x-region'],
      userAgent: req.headers['user-agent']
    });
    next();
  }

  /**
   * Wraps async route handlers with error handling
   */
  private handleAsyncRoute(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
      fn(req, res, next).catch(next);
    };
  }
}

export default ApiRoutes;