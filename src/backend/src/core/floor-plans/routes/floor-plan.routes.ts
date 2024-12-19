// @package express v4.18.2
// @package express-oauth2-jwt-bearer v1.5.0
// @package compression v1.7.4
// @package express-rate-limit v6.7.0

import { Router } from 'express';
import { authenticate } from 'express-oauth2-jwt-bearer';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { FloorPlanController } from '../controllers/floor-plan.controller';
import errorHandler from '../../../common/middleware/error-handler.middleware';

/**
 * Configures and returns Express router with enhanced floor plan endpoints
 * Implements comprehensive security, caching, and monitoring features
 * 
 * @returns {Router} Configured Express router instance
 */
const configureFloorPlanRoutes = (): Router => {
  const router = Router();

  // Configure compression for response optimization
  router.use(compression({
    level: 6, // Balanced compression level
    threshold: 1024, // Only compress responses larger than 1KB
  }));

  // Base rate limiting configuration
  const baseRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again later'
  });

  // Enhanced rate limiting for write operations
  const writeOperationRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // More restrictive limit for write operations
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Write operation limit exceeded, please try again later'
  });

  // Authentication middleware
  const authMiddleware = authenticate({
    audience: 'floor-plans-api',
    issuerBaseURL: process.env.AUTH0_DOMAIN,
  });

  // Create new floor plan
  router.post('/',
    authMiddleware,
    writeOperationRateLimit,
    FloorPlanController.createFloorPlan,
    errorHandler
  );

  // Update existing floor plan
  router.put('/:id',
    authMiddleware,
    writeOperationRateLimit,
    FloorPlanController.updateFloorPlan,
    errorHandler
  );

  // Get floor plan by ID
  router.get('/:id',
    authMiddleware,
    baseRateLimit,
    compression(),
    FloorPlanController.getFloorPlan,
    errorHandler
  );

  // Get floor plans by property
  router.get('/property/:propertyId',
    authMiddleware,
    baseRateLimit,
    compression(),
    FloorPlanController.getFloorPlansByProperty,
    errorHandler
  );

  // Delete floor plan
  router.delete('/:id',
    authMiddleware,
    writeOperationRateLimit,
    FloorPlanController.deleteFloorPlan,
    errorHandler
  );

  // Apply global error handling
  router.use(errorHandler);

  return router;
};

// Create and configure the floor plan router
const floorPlanRouter = configureFloorPlanRoutes();

export { floorPlanRouter };