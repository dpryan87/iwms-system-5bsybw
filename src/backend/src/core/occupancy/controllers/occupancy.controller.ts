/**
 * @fileoverview REST API controller for occupancy tracking and analysis
 * @version 1.0.0
 * @package @core/occupancy/controllers
 */

import { Request, Response } from 'express'; // v4.18.2
import { injectable } from 'inversify'; // v6.0.x
import { controller, httpGet, httpPost, middleware } from 'inversify-express-utils'; // v6.4.x
import rateLimit from 'express-rate-limit'; // v6.7.x

import { OccupancyService } from '../services/occupancy.service';
import { IOccupancyData } from '../interfaces/occupancy.interface';
import { occupancyDataSchema, occupancyTrendSchema, occupancyUpdateSchema } from '../validation/occupancy.schema';
import { logger } from '../../../common/utils/logger.util';

// Rate limiting configurations
const RATE_LIMITS = {
  DEFAULT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
  },
  UPDATES: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 300
  }
};

// Cache control configurations
const CACHE_CONTROL = {
  CURRENT: 'public, max-age=30', // 30 seconds
  TRENDS: 'public, max-age=300' // 5 minutes
};

/**
 * Controller implementing secure REST endpoints for occupancy management
 */
@injectable()
@controller('/api/v1/occupancy')
@middleware(rateLimit(RATE_LIMITS.DEFAULT))
export class OccupancyController {
  constructor(private readonly occupancyService: OccupancyService) {}

  /**
   * Retrieves current occupancy data for a specific space
   * @param req Express request object
   * @param res Express response object
   */
  @httpGet('/:spaceId')
  async getCurrentOccupancy(req: Request, res: Response): Promise<void> {
    const requestId = req.headers['x-request-id'] || '';
    
    try {
      logger.debug('Getting current occupancy', {
        spaceId: req.params.spaceId,
        requestId
      });

      // Validate spaceId parameter
      const { error } = occupancyDataSchema.validate({ spaceId: req.params.spaceId });
      if (error) {
        res.status(400).json({
          error: 'Invalid space ID',
          details: error.details[0].message
        });
        return;
      }

      // Get occupancy data with validation
      const result = await this.occupancyService.getCurrentOccupancy(
        req.params.spaceId,
        { validateData: true }
      );

      if (!result.success || !result.data) {
        res.status(404).json({
          error: 'Occupancy data not found',
          code: result.error?.code
        });
        return;
      }

      // Format HAL+JSON response
      const response = {
        ...result.data,
        _links: {
          self: { href: `/api/v1/occupancy/${req.params.spaceId}` },
          trends: { href: `/api/v1/occupancy/${req.params.spaceId}/trends` },
          space: { href: `/api/v1/spaces/${req.params.spaceId}` }
        }
      };

      // Set cache control headers
      res.setHeader('Cache-Control', CACHE_CONTROL.CURRENT);
      res.json(response);

    } catch (error) {
      logger.error('Error retrieving occupancy data', error, { requestId });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Retrieves occupancy trends with time-based analysis
   * @param req Express request object
   * @param res Express response object
   */
  @httpGet('/:spaceId/trends')
  async getOccupancyTrends(req: Request, res: Response): Promise<void> {
    const requestId = req.headers['x-request-id'] || '';

    try {
      const { spaceId } = req.params;
      const { start, end, interval } = req.query;

      logger.debug('Getting occupancy trends', {
        spaceId,
        timeRange: { start, end },
        interval,
        requestId
      });

      // Validate request parameters
      const { error } = occupancyTrendSchema.validate({
        spaceId,
        timeRange: {
          start,
          end: end || new Date()
        }
      });

      if (error) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: error.details[0].message
        });
        return;
      }

      // Get trend data with analysis options
      const result = await this.occupancyService.getOccupancyTrends(
        spaceId,
        {
          start: new Date(start as string),
          end: end ? new Date(end as string) : new Date()
        },
        {
          interval: (interval as 'hourly' | 'daily' | 'weekly' | 'monthly') || 'hourly',
          includeAnomalies: true,
          smoothing: true
        }
      );

      if (!result.success || !result.data) {
        res.status(404).json({
          error: 'Trend data not found',
          code: result.error?.code
        });
        return;
      }

      // Format HAL+JSON response with pagination
      const response = {
        ...result.data,
        _links: {
          self: { href: `/api/v1/occupancy/${spaceId}/trends` },
          current: { href: `/api/v1/occupancy/${spaceId}` },
          space: { href: `/api/v1/spaces/${spaceId}` }
        }
      };

      // Set cache control headers
      res.setHeader('Cache-Control', CACHE_CONTROL.TRENDS);
      res.json(response);

    } catch (error) {
      logger.error('Error retrieving occupancy trends', error, { requestId });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Updates occupancy data from sensor readings
   * @param req Express request object
   * @param res Express response object
   */
  @httpPost('/update')
  @middleware(rateLimit(RATE_LIMITS.UPDATES))
  async updateOccupancyData(req: Request, res: Response): Promise<void> {
    const requestId = req.headers['x-request-id'] || '';

    try {
      logger.debug('Updating occupancy data', {
        data: req.body,
        requestId
      });

      // Validate request body
      const { error } = occupancyUpdateSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          error: 'Invalid occupancy data',
          details: error.details[0].message
        });
        return;
      }

      // Update occupancy data with validation
      const result = await this.occupancyService.updateOccupancyData(
        req.body as IOccupancyData,
        { validateSensor: true }
      );

      if (!result.success) {
        res.status(400).json({
          error: 'Failed to update occupancy data',
          code: result.error?.code,
          details: result.error?.message
        });
        return;
      }

      // Return success response
      res.status(200).json({
        message: 'Occupancy data updated successfully',
        _links: {
          self: { href: `/api/v1/occupancy/${req.body.spaceId}` },
          trends: { href: `/api/v1/occupancy/${req.body.spaceId}/trends` }
        }
      });

    } catch (error) {
      logger.error('Error updating occupancy data', error, { requestId });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}