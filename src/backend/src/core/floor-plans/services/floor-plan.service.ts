// @package inversify v6.0.1
// @package winston v3.8.0
// @package redis v4.0.0
import { injectable, inject } from 'inversify';
import { Logger } from 'winston';
import { Redis as CacheService } from 'redis';
import { MetricsService } from '@common/services';

import {
  IFloorPlan,
  IFloorPlanService,
  IValidationResult,
  FloorPlanStatus,
  IVersionInfo
} from '../interfaces/floor-plan.interface';
import { FloorPlanRepository } from '../repositories/floor-plan.repository';
import { TYPES } from '../../../common/constants/types';
import { ValidationError } from '../../../common/errors/validation.error';
import { CacheKeys } from '../../../common/constants/cache-keys';

@injectable()
export class FloorPlanService implements IFloorPlanService {
  private readonly CACHE_TTL = 3600; // 1 hour cache TTL
  private readonly BULK_OPERATION_LIMIT = 100;

  constructor(
    @inject(TYPES.FloorPlanRepository) private readonly floorPlanRepository: FloorPlanRepository,
    @inject(TYPES.CacheService) private readonly cacheService: CacheService,
    @inject(TYPES.MetricsService) private readonly metricsService: MetricsService,
    @inject(TYPES.Logger) private readonly logger: Logger
  ) {}

  /**
   * Creates a new floor plan with validation and caching
   * @param data Floor plan data to create
   * @returns Promise<IFloorPlan>
   * @throws ValidationError if data is invalid
   */
  public async createFloorPlan(data: IFloorPlan): Promise<IFloorPlan> {
    const startTime = Date.now();
    try {
      // Validate floor plan data
      const validationResult = await this.validateFloorPlan(data);
      if (!validationResult.isValid) {
        throw new ValidationError('Invalid floor plan data', validationResult.errors);
      }

      // Enhance data with audit information
      const enhancedData = this.enhanceWithAuditInfo(data);

      // Create floor plan
      const createdFloorPlan = await this.floorPlanRepository.create(enhancedData);

      // Update cache
      await this.updateCache(createdFloorPlan);

      // Record metrics
      this.recordMetrics('createFloorPlan', startTime);

      return createdFloorPlan;
    } catch (error) {
      this.logger.error('Error creating floor plan:', { error, data });
      throw error;
    }
  }

  /**
   * Creates multiple floor plans in a transaction
   * @param dataArray Array of floor plan data
   * @returns Promise<IFloorPlan[]>
   * @throws ValidationError if any data is invalid
   */
  public async bulkCreateFloorPlans(dataArray: IFloorPlan[]): Promise<IFloorPlan[]> {
    const startTime = Date.now();
    try {
      // Validate bulk operation limit
      if (dataArray.length > this.BULK_OPERATION_LIMIT) {
        throw new ValidationError(`Bulk operation limit exceeded. Maximum ${this.BULK_OPERATION_LIMIT} items allowed.`);
      }

      // Validate all floor plans
      const validationPromises = dataArray.map(data => this.validateFloorPlan(data));
      const validationResults = await Promise.all(validationPromises);
      
      const invalidResults = validationResults.filter(result => !result.isValid);
      if (invalidResults.length > 0) {
        throw new ValidationError('Invalid floor plans in bulk operation', invalidResults);
      }

      // Enhance all data with audit information
      const enhancedDataArray = dataArray.map(data => this.enhanceWithAuditInfo(data));

      // Perform bulk creation in transaction
      const createdFloorPlans = await this.floorPlanRepository.bulkCreate(enhancedDataArray);

      // Update cache for all created floor plans
      await Promise.all(createdFloorPlans.map(plan => this.updateCache(plan)));

      // Record metrics
      this.recordMetrics('bulkCreateFloorPlans', startTime, dataArray.length);

      return createdFloorPlans;
    } catch (error) {
      this.logger.error('Error in bulk floor plan creation:', { error, count: dataArray.length });
      throw error;
    }
  }

  /**
   * Validates floor plan data against defined rules
   * @param data Floor plan data to validate
   * @returns Promise<IValidationResult>
   */
  public async validateFloorPlan(data: IFloorPlan): Promise<IValidationResult> {
    const errors = [];
    const warnings = [];

    try {
      // Validate required fields
      if (!data.propertyId) {
        errors.push({ field: 'propertyId', message: 'Property ID is required', code: 'REQUIRED_FIELD' });
      }

      if (!data.metadata?.name) {
        errors.push({ field: 'metadata.name', message: 'Floor plan name is required', code: 'REQUIRED_FIELD' });
      }

      // Validate dimensions
      if (data.metadata?.dimensions) {
        const { width, height, scale } = data.metadata.dimensions;
        if (width <= 0 || height <= 0) {
          errors.push({ field: 'metadata.dimensions', message: 'Invalid dimensions', code: 'INVALID_DIMENSIONS' });
        }
        if (scale <= 0) {
          errors.push({ field: 'metadata.dimensions.scale', message: 'Invalid scale factor', code: 'INVALID_SCALE' });
        }
      }

      // Validate BMS integration if enabled
      if (data.metadata?.bmsConfig?.enabled) {
        const { systemId, endpoint } = data.metadata.bmsConfig;
        if (!systemId || !endpoint) {
          errors.push({ field: 'metadata.bmsConfig', message: 'Invalid BMS configuration', code: 'INVALID_BMS_CONFIG' });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      this.logger.error('Error validating floor plan:', { error, data });
      throw error;
    }
  }

  /**
   * Updates cache with floor plan data
   * @param floorPlan Floor plan to cache
   */
  private async updateCache(floorPlan: IFloorPlan): Promise<void> {
    try {
      const cacheKey = `${CacheKeys.FLOOR_PLAN}:${floorPlan.id}`;
      await this.cacheService.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(floorPlan));
    } catch (error) {
      this.logger.warn('Cache update failed:', { error, floorPlanId: floorPlan.id });
    }
  }

  /**
   * Enhances floor plan data with audit information
   * @param data Original floor plan data
   * @returns Enhanced floor plan data
   */
  private enhanceWithAuditInfo(data: IFloorPlan): IFloorPlan {
    const now = new Date();
    const versionInfo: IVersionInfo = {
      major: 1,
      minor: 0,
      revision: 0,
      changelog: 'Initial version',
      isLatest: true
    };

    return {
      ...data,
      status: data.status || FloorPlanStatus.DRAFT,
      createdAt: now,
      updatedAt: now,
      versionInfo,
      auditInfo: {
        createdAt: now,
        createdBy: data.createdBy,
        updatedAt: now,
        updatedBy: data.updatedBy,
        comments: []
      }
    };
  }

  /**
   * Records operation metrics
   * @param operation Operation name
   * @param startTime Operation start time
   * @param itemCount Optional item count for bulk operations
   */
  private recordMetrics(operation: string, startTime: number, itemCount?: number): void {
    const duration = Date.now() - startTime;
    this.metricsService.recordOperationMetrics('floorPlanService', {
      operation,
      duration,
      itemCount: itemCount || 1
    });
  }
}