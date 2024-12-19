// @package express v4.18.2
// @package inversify v6.0.1
// @package express-rate-limit v6.7.0
// @package compression v1.7.4
// @package helmet v7.0.0
import { Router } from 'express';
import { injectable } from 'inversify';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import helmet from 'helmet';

import { ResourceController } from '../controllers/resource.controller';
import { container } from '../../../common/config/inversify.config';
import { authenticate } from '../../../common/middleware/auth.middleware';
import { authorize } from '../../../common/middleware/rbac.middleware';
import { validateRequest } from '../../../common/middleware/validation.middleware';
import { cache } from '../../../common/middleware/cache.middleware';
import { metrics } from '../../../common/middleware/metrics.middleware';
import { auditLog } from '../../../common/middleware/audit.middleware';
import { pagination } from '../../../common/middleware/pagination.middleware';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * Configures and returns the Express router for resource management endpoints
 * Implements secure, validated API routes with enhanced features
 */
@injectable()
export class ResourceRoutes {
  private readonly router: Router;
  private readonly resourceController: ResourceController;

  constructor() {
    this.router = Router();
    this.resourceController = container.get(ResourceController);
    this.configureMiddleware();
    this.configureRoutes();
  }

  /**
   * Configures global middleware for the resource routes
   * @private
   */
  private configureMiddleware(): void {
    // Security middleware
    this.router.use(helmet({
      contentSecurityPolicy: true,
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: true,
      dnsPrefetchControl: true,
      frameguard: true,
      hidePoweredBy: true,
      hsts: true,
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: true,
      referrerPolicy: true,
      xssFilter: true
    }));

    // Compression middleware
    this.router.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));
  }

  /**
   * Configures resource management routes with security and validation
   * @private
   */
  private configureRoutes(): void {
    // Create new resource
    this.router.post('/',
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        message: { 
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
          message: 'Too many resource creation attempts. Please try again later.'
        }
      }),
      authenticate,
      authorize(['admin', 'resource_manager']),
      validateRequest('resourceSchema'),
      metrics('resource.create'),
      auditLog('resource.create'),
      this.resourceController.createResource
    );

    // Update existing resource
    this.router.put('/:id',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100
      }),
      authenticate,
      authorize(['admin', 'resource_manager']),
      validateRequest('resourceUpdateSchema'),
      metrics('resource.update'),
      auditLog('resource.update'),
      this.resourceController.updateResource
    );

    // Get resource by ID
    this.router.get('/:id',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 1000
      }),
      authenticate,
      cache({
        ttl: 300, // 5 minutes
        key: (req) => `resource:${req.params.id}`
      }),
      metrics('resource.get'),
      this.resourceController.getResource
    );

    // Get resources by space
    this.router.get('/space/:spaceId',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 500
      }),
      authenticate,
      pagination({
        defaultLimit: 20,
        maxLimit: 100
      }),
      cache({
        ttl: 300,
        key: (req) => `resources:space:${req.params.spaceId}:${req.query.page}:${req.query.limit}`
      }),
      metrics('resource.getBySpace'),
      this.resourceController.getResourcesBySpace
    );

    // Delete resource
    this.router.delete('/:id',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 50
      }),
      authenticate,
      authorize(['admin']),
      metrics('resource.delete'),
      auditLog('resource.delete'),
      this.resourceController.deleteResource
    );
  }

  /**
   * Returns the configured router instance
   * @returns Express Router instance
   */
  public getRouter(): Router {
    return this.router;
  }
}

// Export configured router instance
export const resourceRouter = new ResourceRoutes().getRouter();