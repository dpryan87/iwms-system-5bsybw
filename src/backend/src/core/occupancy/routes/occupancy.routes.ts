/**
 * @fileoverview Express router configuration for occupancy-related endpoints
 * Implements RESTful HTTP/2 API routes with security, caching, and monitoring
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import { container } from 'inversify'; // v6.0.x
import rateLimit from 'express-rate-limit'; // v6.x.x
import cache from 'express-cache-middleware'; // v1.0.x
import { OccupancyController } from '../controllers/occupancy.controller';
import errorHandler from '../../../common/middleware/error-handler.middleware';
import { loggerMiddleware } from '../../../common/middleware/logger.middleware';

// Rate limiting configurations for different endpoints
const RATE_LIMITS = {
  READ: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
  },
  WRITE: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 30, // Limit each IP to 30 write requests per windowMs
    message: 'Write operation rate limit exceeded'
  }
};

// Cache configurations for read endpoints
const CACHE_CONFIG = {
  CURRENT: {
    duration: 30, // 30 seconds
    key: (req: any) => `occupancy:current:${req.params.spaceId}`
  },
  TRENDS: {
    duration: 300, // 5 minutes
    key: (req: any) => `occupancy:trends:${req.params.spaceId}`
  }
};

/**
 * Configures and returns the Express router with occupancy endpoints
 * @returns Configured Express router instance
 */
export function configureOccupancyRoutes(): Router {
  const router = Router();
  const occupancyController = container.get<OccupancyController>(OccupancyController);

  // Apply common middleware
  router.use(loggerMiddleware);

  // Configure caching middleware
  const cacheMiddleware = cache({
    store: 'memory',
    expire: CACHE_CONFIG.CURRENT.duration
  });

  /**
   * GET /api/v1/occupancy/:spaceId
   * Retrieves current occupancy data for a specific space
   */
  router.get(
    '/:spaceId',
    rateLimit(RATE_LIMITS.READ),
    cacheMiddleware,
    async (req, res, next) => {
      try {
        const result = await occupancyController.getCurrentOccupancy(req, res);
        res.setHeader('Cache-Control', `public, max-age=${CACHE_CONFIG.CURRENT.duration}`);
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/occupancy/:spaceId/trends
   * Retrieves occupancy trends and analysis for a specific space
   */
  router.get(
    '/:spaceId/trends',
    rateLimit(RATE_LIMITS.READ),
    cacheMiddleware,
    async (req, res, next) => {
      try {
        const result = await occupancyController.getOccupancyTrends(req, res);
        res.setHeader('Cache-Control', `public, max-age=${CACHE_CONFIG.TRENDS.duration}`);
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/occupancy/update
   * Updates occupancy data from sensor readings
   */
  router.post(
    '/update',
    rateLimit(RATE_LIMITS.WRITE),
    async (req, res, next) => {
      try {
        const result = await occupancyController.updateOccupancyData(req, res);
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Health check endpoint for monitoring
   */
  router.get(
    '/health',
    async (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }
  );

  // Apply error handling middleware last
  router.use(errorHandler);

  return router;
}

// Export configured router factory
export default configureOccupancyRoutes;