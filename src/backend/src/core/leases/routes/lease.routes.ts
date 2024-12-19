// @package express v4.18.2
// @package inversify v6.0.1
// @package compression v1.7.4
// @package express-rate-limit v6.7.0

import { Router } from 'express';
import { injectable, inject } from 'inversify';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { LeaseController } from '../controllers/lease.controller';
import { authenticate } from '../../../common/middleware/auth.middleware';
import { validateRequest } from '../../../common/middleware/validation.middleware';
import { errorHandler } from '../../../common/middleware/error-handler.middleware';
import { leaseSchema } from '../validation/lease.schema';
import { ERROR_MESSAGES } from '../../../common/constants/messages';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * Rate limiting configuration for lease endpoints
 * Implements tiered rate limiting based on endpoint sensitivity
 */
const rateLimitConfig = {
  standard: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  sensitive: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
    standardHeaders: true,
    legacyHeaders: false,
  })
};

/**
 * Configures and manages lease management routes with comprehensive security
 * and validation middleware chains.
 */
@injectable()
export class LeaseRoutes {
  private router: Router;

  constructor(
    @inject(LeaseController) private readonly leaseController: LeaseController
  ) {
    this.router = Router();
    this.initializeRoutes();
  }

  /**
   * Initializes all lease management routes with appropriate middleware chains
   * and security controls
   */
  private initializeRoutes(): void {
    // Apply global middleware
    this.router.use(compression());
    this.router.use(authenticate);

    // Create new lease
    this.router.post(
      '/',
      rateLimitConfig.sensitive,
      validateRequest(leaseSchema),
      this.leaseController.createLease.bind(this.leaseController)
    );

    // Get lease by ID
    this.router.get(
      '/:id',
      rateLimitConfig.standard,
      this.leaseController.getLease.bind(this.leaseController)
    );

    // Update lease status
    this.router.put(
      '/:id/status',
      rateLimitConfig.sensitive,
      validateRequest(leaseSchema.pick(['status'])),
      this.leaseController.updateLeaseStatus.bind(this.leaseController)
    );

    // Process lease payment
    this.router.post(
      '/:id/payments',
      rateLimitConfig.sensitive,
      validateRequest(leaseSchema.pick(['payment'])),
      this.leaseController.processPayment.bind(this.leaseController)
    );

    // Apply error handling middleware
    this.router.use(errorHandler);
  }

  /**
   * Returns the configured router instance with all lease management endpoints
   * @returns Express Router instance
   */
  public getRouter(): Router {
    return this.router;
  }
}

// Export configured router for use in main application
export const leaseRouter = new LeaseRoutes(new LeaseController()).getRouter();