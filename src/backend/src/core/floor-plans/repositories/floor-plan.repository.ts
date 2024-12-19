// @package typeorm v0.3.0
// @package inversify v6.0.1
// @package ioredis v5.0.0
// @package winston v3.8.0
import { Repository, EntityRepository, FindOptionsWhere, In } from 'typeorm';
import { injectable } from 'inversify';
import Redis from 'ioredis';
import { Logger } from 'winston';

import { FloorPlanModel } from '../models/floor-plan.model';
import { IFloorPlan, FloorPlanStatus } from '../interfaces/floor-plan.interface';

/**
 * Interface for pagination options
 */
interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * Interface for paginated results
 */
interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Enhanced repository class for floor plan data management with caching and performance optimizations
 */
@injectable()
@EntityRepository(FloorPlanModel)
export class FloorPlanRepository extends Repository<FloorPlanModel> {
  private readonly CACHE_TTL = 3600; // 1 hour cache TTL
  private readonly CACHE_PREFIX = 'floor_plan:';

  constructor(
    private readonly cacheClient: Redis,
    private readonly logger: Logger
  ) {
    super();
  }

  /**
   * Retrieves a floor plan by ID with caching
   * @param id Floor plan identifier
   * @returns Promise resolving to floor plan or null
   */
  async findById(id: string): Promise<FloorPlanModel | null> {
    try {
      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}${id}`;
      const cached = await this.cacheClient.get(cacheKey);
      
      if (cached) {
        this.logger.debug(`Cache hit for floor plan ${id}`);
        return JSON.parse(cached);
      }

      // Cache miss - query database
      const floorPlan = await this.findOne({
        where: { id },
        cache: true // Enable query cache
      });

      if (floorPlan) {
        // Update cache
        await this.cacheClient.setex(
          cacheKey,
          this.CACHE_TTL,
          JSON.stringify(floorPlan)
        );
      }

      return floorPlan;
    } catch (error) {
      this.logger.error(`Error retrieving floor plan ${id}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves paginated floor plans for a property
   * @param propertyId Property identifier
   * @param options Pagination options
   * @returns Promise resolving to paginated floor plans
   */
  async findByPropertyId(
    propertyId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<FloorPlanModel>> {
    try {
      const { page = 1, limit = 10, orderBy = 'createdAt', orderDirection = 'DESC' } = options;
      const skip = (page - 1) * limit;

      const [items, total] = await this.findAndCount({
        where: { propertyId },
        order: { [orderBy]: orderDirection },
        skip,
        take: limit,
        cache: true // Enable query cache
      });

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      this.logger.error(`Error retrieving floor plans for property ${propertyId}:`, error);
      throw error;
    }
  }

  /**
   * Creates a new floor plan with validation
   * @param data Floor plan data
   * @returns Promise resolving to created floor plan
   */
  async create(data: IFloorPlan): Promise<FloorPlanModel> {
    const queryRunner = this.manager.connection.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const floorPlan = this.create(data);
      
      // Validate required fields
      if (!floorPlan.propertyId || !floorPlan.metadata) {
        throw new Error('Invalid floor plan data');
      }

      // Set initial status if not provided
      if (!floorPlan.status) {
        floorPlan.status = FloorPlanStatus.DRAFT;
      }

      const savedFloorPlan = await queryRunner.manager.save(FloorPlanModel, floorPlan);
      await queryRunner.commitTransaction();

      // Invalidate property cache
      await this.cacheClient.del(`${this.CACHE_PREFIX}property:${data.propertyId}`);

      return savedFloorPlan;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error creating floor plan:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Updates floor plan with optimistic locking
   * @param id Floor plan identifier
   * @param data Updated floor plan data
   * @returns Promise resolving to updated floor plan
   */
  async update(id: string, data: Partial<IFloorPlan>): Promise<FloorPlanModel> {
    const queryRunner = this.manager.connection.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const floorPlan = await queryRunner.manager.findOne(FloorPlanModel, {
        where: { id },
        lock: { mode: 'optimistic', version: data.versionInfo?.revision }
      });

      if (!floorPlan) {
        throw new Error('Floor plan not found');
      }

      const updatedFloorPlan = await queryRunner.manager.save(FloorPlanModel, {
        ...floorPlan,
        ...data,
        updatedAt: new Date()
      });

      await queryRunner.commitTransaction();

      // Invalidate caches
      await Promise.all([
        this.cacheClient.del(`${this.CACHE_PREFIX}${id}`),
        this.cacheClient.del(`${this.CACHE_PREFIX}property:${floorPlan.propertyId}`)
      ]);

      return updatedFloorPlan;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error updating floor plan ${id}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Soft deletes a floor plan
   * @param id Floor plan identifier
   * @returns Promise resolving to deletion success status
   */
  async delete(id: string): Promise<boolean> {
    const queryRunner = this.manager.connection.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const floorPlan = await queryRunner.manager.findOne(FloorPlanModel, {
        where: { id }
      });

      if (!floorPlan) {
        throw new Error('Floor plan not found');
      }

      // Soft delete by updating status
      await queryRunner.manager.update(FloorPlanModel, id, {
        status: FloorPlanStatus.ARCHIVED,
        updatedAt: new Date()
      });

      await queryRunner.commitTransaction();

      // Invalidate caches
      await Promise.all([
        this.cacheClient.del(`${this.CACHE_PREFIX}${id}`),
        this.cacheClient.del(`${this.CACHE_PREFIX}property:${floorPlan.propertyId}`)
      ]);

      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error deleting floor plan ${id}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}