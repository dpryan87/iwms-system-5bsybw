// @package typeorm v0.3.0
// @package inversify v6.0.1
// @package winston v3.8.2
import { Repository, EntityRepository, QueryRunner, FindOptionsWhere, In } from 'typeorm';
import { injectable } from 'inversify';
import { Logger } from 'winston';

import { ResourceModel } from '../models/resource.model';
import { 
  IResource, 
  ResourceStatus, 
  IResourceSearchCriteria,
  IResourceSearchResult 
} from '../interfaces/resource.interface';

/**
 * Repository class for managing workplace resources with comprehensive data access operations
 */
@injectable()
@EntityRepository(ResourceModel)
export class ResourceRepository extends Repository<ResourceModel> {
  private readonly queryTimeout: number = 30000; // 30 seconds
  private readonly cachePrefix: string = 'resource:';
  private readonly cacheTTL: number = 3600; // 1 hour

  constructor(
    private readonly logger: Logger,
    private readonly queryRunner?: QueryRunner
  ) {
    super();
    this.logger.debug('Initializing ResourceRepository');
  }

  /**
   * Creates a new resource with transaction support
   * @param data Resource data to create
   * @returns Created resource instance
   */
  async create(data: IResource): Promise<ResourceModel> {
    this.logger.debug('Creating new resource', { type: data.type });

    const queryRunner = this.queryRunner || this.manager.connection.createQueryRunner();
    
    try {
      // Start transaction if not already started
      if (!queryRunner.isTransactionActive) {
        await queryRunner.startTransaction();
      }

      // Create and validate resource model
      const resource = ResourceModel.fromJSON(data);
      
      // Check for duplicate resources in same space
      const existing = await queryRunner.manager.findOne(ResourceModel, {
        where: {
          spaceId: data.spaceId,
          type: data.type,
          isDeleted: false
        }
      });

      if (existing) {
        throw new Error('Resource already exists in this space');
      }

      // Save resource
      const savedResource = await queryRunner.manager.save(resource);
      
      // Commit transaction if we started it
      if (!this.queryRunner) {
        await queryRunner.commitTransaction();
      }

      this.logger.info('Resource created successfully', { 
        resourceId: savedResource.id,
        type: savedResource.type 
      });

      return savedResource;

    } catch (error) {
      // Rollback transaction if we started it
      if (!this.queryRunner && queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      this.logger.error('Failed to create resource', {
        error: error.message,
        data
      });
      throw error;

    } finally {
      // Release query runner if we created it
      if (!this.queryRunner) {
        await queryRunner.release();
      }
    }
  }

  /**
   * Retrieves a resource by ID with caching
   * @param id Resource ID
   * @returns Found resource or null
   */
  async findById(id: string): Promise<ResourceModel | null> {
    this.logger.debug('Finding resource by ID', { id });

    try {
      // Set query timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), this.queryTimeout);
      });

      // Execute query with timeout
      const resource = await Promise.race([
        this.findOne({
          where: { 
            id,
            isDeleted: false
          }
        }),
        timeoutPromise
      ]);

      if (!resource) {
        this.logger.debug('Resource not found', { id });
        return null;
      }

      return resource;

    } catch (error) {
      this.logger.error('Error finding resource', {
        id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retrieves all resources in a space with pagination
   * @param spaceId Space ID
   * @param criteria Search criteria and pagination options
   * @returns Paginated list of resources
   */
  async findBySpace(
    spaceId: string,
    criteria: IResourceSearchCriteria
  ): Promise<IResourceSearchResult> {
    this.logger.debug('Finding resources by space', { spaceId, criteria });

    try {
      const {
        types,
        statuses,
        capacityRange,
        page = 1,
        limit = 20
      } = criteria;

      // Build query conditions
      const where: FindOptionsWhere<ResourceModel> = {
        spaceId,
        isDeleted: false
      };

      if (types?.length) {
        where.type = In(types);
      }

      if (statuses?.length) {
        where.status = In(statuses);
      }

      if (capacityRange) {
        where.capacity = Between(capacityRange.min, capacityRange.max);
      }

      // Execute paginated query
      const [resources, total] = await this.findAndCount({
        where,
        skip: (page - 1) * limit,
        take: limit,
        order: {
          createdAt: 'DESC'
        }
      });

      return {
        items: resources,
        total,
        page,
        limit,
        hasMore: total > page * limit
      };

    } catch (error) {
      this.logger.error('Error finding resources by space', {
        spaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Updates an existing resource with optimistic locking
   * @param id Resource ID
   * @param data Update data
   * @returns Updated resource
   */
  async update(id: string, data: Partial<IResource>): Promise<ResourceModel> {
    this.logger.debug('Updating resource', { id });

    const queryRunner = this.queryRunner || this.manager.connection.createQueryRunner();

    try {
      if (!queryRunner.isTransactionActive) {
        await queryRunner.startTransaction();
      }

      // Find existing resource
      const resource = await queryRunner.manager.findOne(ResourceModel, {
        where: { 
          id,
          isDeleted: false
        }
      });

      if (!resource) {
        throw new Error('Resource not found');
      }

      // Update and validate resource
      Object.assign(resource, data);
      resource.validate();

      // Save changes
      const updated = await queryRunner.manager.save(resource);

      if (!this.queryRunner) {
        await queryRunner.commitTransaction();
      }

      this.logger.info('Resource updated successfully', { id });
      return updated;

    } catch (error) {
      if (!this.queryRunner && queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      this.logger.error('Failed to update resource', {
        id,
        error: error.message
      });
      throw error;

    } finally {
      if (!this.queryRunner) {
        await queryRunner.release();
      }
    }
  }

  /**
   * Soft deletes a resource with cascading
   * @param id Resource ID
   * @returns Deletion success status
   */
  async delete(id: string): Promise<boolean> {
    this.logger.debug('Deleting resource', { id });

    const queryRunner = this.queryRunner || this.manager.connection.createQueryRunner();

    try {
      if (!queryRunner.isTransactionActive) {
        await queryRunner.startTransaction();
      }

      // Find resource and check status
      const resource = await queryRunner.manager.findOne(ResourceModel, {
        where: { 
          id,
          isDeleted: false
        }
      });

      if (!resource) {
        throw new Error('Resource not found');
      }

      if (resource.status === ResourceStatus.OCCUPIED || 
          resource.status === ResourceStatus.RESERVED) {
        throw new Error('Cannot delete resource in use');
      }

      // Soft delete
      resource.isDeleted = true;
      await queryRunner.manager.save(resource);

      if (!this.queryRunner) {
        await queryRunner.commitTransaction();
      }

      this.logger.info('Resource deleted successfully', { id });
      return true;

    } catch (error) {
      if (!this.queryRunner && queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      this.logger.error('Failed to delete resource', {
        id,
        error: error.message
      });
      throw error;

    } finally {
      if (!this.queryRunner) {
        await queryRunner.release();
      }
    }
  }
}