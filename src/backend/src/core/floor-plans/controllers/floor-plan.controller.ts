// @package inversify v6.0.1
// @package inversify-express-utils v6.4.3
// @package @core/auth v1.0.0
// @package @core/rate-limiting v1.0.0
// @package @core/validation v1.0.0
// @package @core/telemetry v1.0.0

import { injectable, inject } from 'inversify';
import { Request, Response } from 'express';
import { 
  controller, 
  httpGet, 
  httpPost, 
  httpPut, 
  httpDelete,
  request,
  response
} from 'inversify-express-utils';
import { authorize } from '@core/auth';
import { rateLimit } from '@core/rate-limiting';
import { validate } from '@core/validation';
import { metrics } from '@core/telemetry';
import { Logger } from 'winston';

import { IFloorPlan } from '../interfaces/floor-plan.interface';
import { FloorPlanService } from '../services/floor-plan.service';
import { floorPlanSchema } from '../validation/floor-plan.schema';
import { TYPES } from '../../../common/constants/types';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';

@injectable()
@controller('/api/v1/floor-plans')
@metrics('floor-plans')
export class FloorPlanController {
  constructor(
    @inject(TYPES.FloorPlanService) private readonly floorPlanService: FloorPlanService,
    @inject(TYPES.Logger) private readonly logger: Logger
  ) {}

  /**
   * Create a new floor plan
   * @param req Request containing floor plan data
   * @param res Response object
   * @returns Created floor plan with 201 status
   */
  @httpPost('/')
  @authorize('floor-plans:create')
  @validate(floorPlanSchema)
  @rateLimit({ points: 10, duration: 60 })
  @metrics('create-floor-plan')
  public async createFloorPlan(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      this.logger.info('Creating floor plan', { requestId: req.id });
      
      const floorPlan = await this.floorPlanService.createFloorPlan(req.body);
      
      // Set cache control headers
      res.setHeader('Cache-Control', 'private, max-age=0, no-cache');
      
      return res.status(201).json({
        success: true,
        data: floorPlan,
        timestamp: new Date()
      } as ApiResponse<IFloorPlan>);
    } catch (error) {
      this.logger.error('Error creating floor plan', { error, requestId: req.id });
      throw error;
    }
  }

  /**
   * Get floor plan by ID
   * @param req Request with floor plan ID
   * @param res Response object
   * @returns Floor plan data with 200 status
   */
  @httpGet('/:id')
  @authorize('floor-plans:read')
  @rateLimit({ points: 100, duration: 60 })
  @metrics('get-floor-plan')
  public async getFloorPlan(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      const { id } = req.params;
      this.logger.info('Retrieving floor plan', { id, requestId: req.id });

      const floorPlan = await this.floorPlanService.getFloorPlan(id);

      // Set cache control headers for GET requests
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('ETag', `"${floorPlan.version}"`);

      return res.status(200).json({
        success: true,
        data: floorPlan,
        timestamp: new Date()
      } as ApiResponse<IFloorPlan>);
    } catch (error) {
      this.logger.error('Error retrieving floor plan', { 
        error, 
        requestId: req.id,
        floorPlanId: req.params.id 
      });
      throw error;
    }
  }

  /**
   * Get floor plans by property ID
   * @param req Request with property ID
   * @param res Response object
   * @returns Array of floor plans with 200 status
   */
  @httpGet('/property/:propertyId')
  @authorize('floor-plans:read')
  @rateLimit({ points: 50, duration: 60 })
  @metrics('get-property-floor-plans')
  public async getFloorPlansByProperty(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      const { propertyId } = req.params;
      this.logger.info('Retrieving property floor plans', { 
        propertyId, 
        requestId: req.id 
      });

      const floorPlans = await this.floorPlanService.getFloorPlansByProperty(propertyId);

      // Set cache control headers
      res.setHeader('Cache-Control', 'private, max-age=3600');

      return res.status(200).json({
        success: true,
        data: floorPlans,
        timestamp: new Date()
      } as ApiResponse<IFloorPlan[]>);
    } catch (error) {
      this.logger.error('Error retrieving property floor plans', {
        error,
        requestId: req.id,
        propertyId: req.params.propertyId
      });
      throw error;
    }
  }

  /**
   * Update existing floor plan
   * @param req Request with floor plan ID and update data
   * @param res Response object
   * @returns Updated floor plan with 200 status
   */
  @httpPut('/:id')
  @authorize('floor-plans:update')
  @validate(floorPlanSchema)
  @rateLimit({ points: 20, duration: 60 })
  @metrics('update-floor-plan')
  public async updateFloorPlan(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      const { id } = req.params;
      this.logger.info('Updating floor plan', { id, requestId: req.id });

      const floorPlan = await this.floorPlanService.updateFloorPlan(id, req.body);

      // Invalidate cache for updated resource
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      return res.status(200).json({
        success: true,
        data: floorPlan,
        timestamp: new Date()
      } as ApiResponse<IFloorPlan>);
    } catch (error) {
      this.logger.error('Error updating floor plan', {
        error,
        requestId: req.id,
        floorPlanId: req.params.id
      });
      throw error;
    }
  }

  /**
   * Delete floor plan
   * @param req Request with floor plan ID
   * @param res Response object
   * @returns Success response with 204 status
   */
  @httpDelete('/:id')
  @authorize('floor-plans:delete')
  @rateLimit({ points: 10, duration: 60 })
  @metrics('delete-floor-plan')
  public async deleteFloorPlan(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      const { id } = req.params;
      this.logger.info('Deleting floor plan', { id, requestId: req.id });

      await this.floorPlanService.deleteFloorPlan(id);

      // Ensure cache is invalidated for deleted resource
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      return res.status(204).send();
    } catch (error) {
      this.logger.error('Error deleting floor plan', {
        error,
        requestId: req.id,
        floorPlanId: req.params.id
      });
      throw error;
    }
  }

  /**
   * Bulk update floor plans
   * @param req Request containing array of floor plan updates
   * @param res Response object
   * @returns Array of updated floor plans with 200 status
   */
  @httpPut('/bulk')
  @authorize('floor-plans:update')
  @validate(Joi.array().items(floorPlanSchema))
  @rateLimit({ points: 5, duration: 60 })
  @metrics('bulk-update-floor-plans')
  public async bulkUpdateFloorPlans(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      this.logger.info('Bulk updating floor plans', { 
        count: req.body.length,
        requestId: req.id 
      });

      const floorPlans = await this.floorPlanService.bulkUpdateFloorPlans(req.body);

      // Invalidate cache for bulk updates
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      return res.status(200).json({
        success: true,
        data: floorPlans,
        timestamp: new Date()
      } as ApiResponse<IFloorPlan[]>);
    } catch (error) {
      this.logger.error('Error in bulk floor plan update', {
        error,
        requestId: req.id,
        count: req.body.length
      });
      throw error;
    }
  }
}