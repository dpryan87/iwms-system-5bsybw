// @package typeorm v0.3.0
// @package inversify v6.0.1
// @package winston v3.8.2
// @package ioredis v5.3.0
// @package @company/audit-service v1.0.0
// @package @company/notification-service v1.0.0

import { Repository, EntityRepository, FindOptionsWhere, QueryRunner, SelectQueryBuilder } from 'typeorm';
import { injectable } from 'inversify';
import { Logger } from 'winston';
import Redis from 'ioredis';
import { AuditService } from '@company/audit-service';
import { NotificationService } from '@company/notification-service';

import { Lease } from '../models/lease.model';
import { ILease, LeaseStatus } from '../interfaces/lease.interface';

const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = 'lease:';
const QUERY_TIMEOUT = 30000; // 30 seconds

/**
 * Enhanced repository class for secure lease data operations
 * Implements caching, audit logging, and automated notifications
 */
@injectable()
@EntityRepository(Lease)
export class LeaseRepository extends Repository<Lease> {
  constructor(
    private readonly logger: Logger,
    private readonly cache: Redis,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService
  ) {
    super();
    this.setupEventListeners();
  }

  /**
   * Retrieves leases for a specific property with caching
   * @param propertyId - Property identifier
   * @returns Promise resolving to array of lease entities
   */
  async findByPropertyId(propertyId: string): Promise<Lease[]> {
    try {
      // Check cache first
      const cacheKey = `${CACHE_PREFIX}property:${propertyId}`;
      const cachedLeases = await this.cache.get(cacheKey);
      
      if (cachedLeases) {
        this.logger.debug(`Cache hit for property leases: ${propertyId}`);
        return JSON.parse(cachedLeases);
      }

      // Build optimized query with security filters
      const queryBuilder = this.createQueryBuilder('lease')
        .where('lease.propertyId = :propertyId', { propertyId })
        .leftJoinAndSelect('lease.documents', 'documents')
        .leftJoinAndSelect('lease.terms', 'terms')
        .cache(true)
        .timeout(QUERY_TIMEOUT);

      // Execute query with security context
      const leases = await queryBuilder.getMany();

      // Cache results
      await this.cache.setex(
        cacheKey,
        CACHE_TTL,
        JSON.stringify(leases)
      );

      // Audit access
      await this.auditService.logAccess({
        entityType: 'lease',
        action: 'query',
        propertyId,
        count: leases.length
      });

      return leases;
    } catch (error) {
      this.logger.error('Error retrieving property leases:', {
        propertyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retrieves all active leases with optimized performance
   * @returns Promise resolving to array of active lease entities
   */
  async findActiveLeases(): Promise<Lease[]> {
    try {
      const cacheKey = `${CACHE_PREFIX}active`;
      const cachedLeases = await this.cache.get(cacheKey);

      if (cachedLeases) {
        return JSON.parse(cachedLeases);
      }

      const queryBuilder = this.createQueryBuilder('lease')
        .where('lease.status = :status', { status: LeaseStatus.ACTIVE })
        .leftJoinAndSelect('lease.documents', 'documents')
        .leftJoinAndSelect('lease.terms', 'terms')
        .orderBy('lease.endDate', 'ASC')
        .cache(true)
        .timeout(QUERY_TIMEOUT);

      const activeLeases = await queryBuilder.getMany();

      await this.cache.setex(
        cacheKey,
        CACHE_TTL,
        JSON.stringify(activeLeases)
      );

      return activeLeases;
    } catch (error) {
      this.logger.error('Error retrieving active leases:', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Creates a new lease with validation and notifications
   * @param lease - Lease entity to create
   * @returns Promise resolving to created lease
   */
  async createLease(lease: Partial<ILease>): Promise<Lease> {
    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate lease data
      const newLease = this.create(lease);
      const isValid = await newLease.validate();

      if (!isValid) {
        throw new Error('Invalid lease data');
      }

      // Save with transaction
      const savedLease = await queryRunner.manager.save(newLease);
      await queryRunner.commitTransaction();

      // Clear relevant caches
      await this.clearLeaseCache(savedLease.propertyId);

      // Audit trail
      await this.auditService.logCreate({
        entityType: 'lease',
        entityId: savedLease.id,
        data: lease
      });

      // Send notifications
      await this.notificationService.sendLeaseCreated({
        leaseId: savedLease.id,
        propertyId: savedLease.propertyId,
        tenantId: savedLease.tenantId
      });

      return savedLease;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error creating lease:', {
        error: error.message,
        lease
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Updates an existing lease with validation and notifications
   * @param id - Lease identifier
   * @param updates - Partial lease updates
   * @returns Promise resolving to updated lease
   */
  async updateLease(id: string, updates: Partial<ILease>): Promise<Lease> {
    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingLease = await this.findOneOrFail(id);
      const updatedLease = this.merge(existingLease, updates);
      
      const isValid = await updatedLease.validate();
      if (!isValid) {
        throw new Error('Invalid lease updates');
      }

      const savedLease = await queryRunner.manager.save(updatedLease);
      await queryRunner.commitTransaction();

      // Clear caches
      await this.clearLeaseCache(savedLease.propertyId);

      // Audit trail
      await this.auditService.logUpdate({
        entityType: 'lease',
        entityId: id,
        changes: updates
      });

      // Check for status changes requiring notifications
      if (updates.status && updates.status !== existingLease.status) {
        await this.notificationService.sendLeaseStatusChanged({
          leaseId: id,
          oldStatus: existingLease.status,
          newStatus: updates.status
        });
      }

      return savedLease;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error updating lease:', {
        id,
        updates,
        error: error.message
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Clears lease-related cache entries
   * @param propertyId - Property identifier
   */
  private async clearLeaseCache(propertyId: string): Promise<void> {
    try {
      await Promise.all([
        this.cache.del(`${CACHE_PREFIX}property:${propertyId}`),
        this.cache.del(`${CACHE_PREFIX}active`)
      ]);
    } catch (error) {
      this.logger.warn('Error clearing lease cache:', {
        propertyId,
        error: error.message
      });
    }
  }

  /**
   * Sets up repository event listeners
   */
  private setupEventListeners(): void {
    this.manager.connection.subscribers.push({
      beforeUpdate: async (event) => {
        if (event.entity instanceof Lease) {
          await event.entity.validate();
        }
      },
      beforeInsert: async (event) => {
        if (event.entity instanceof Lease) {
          await event.entity.validate();
        }
      }
    });
  }
}

export { LeaseRepository };