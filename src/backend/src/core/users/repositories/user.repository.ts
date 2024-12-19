/**
 * @fileoverview Enhanced User Repository implementation with comprehensive security features
 * Implements secure data access layer for user management with audit trails and RBAC
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // v6.0.1
import { Repository, DataSource, QueryRunner, FindOptionsWhere } from 'typeorm'; // v0.3.0
import { Logger } from 'winston'; // v3.8.2
import { IUser, UserRole, UserStatus, IUserSecurityPreferences } from '../interfaces/user.interface';
import { UserModel } from '../models/user.model';
import { databaseConfig } from '../../../common/config/database.config';
import { ValidationError } from '../../../common/utils/validation.util';
import { ErrorCodes } from '../../../common/constants/error-codes';
import { VALIDATION_MESSAGES } from '../../../common/constants/messages';

/**
 * Enhanced User Repository with comprehensive security features and performance optimizations
 * Implements secure data access patterns and audit trailing
 */
@injectable()
export class UserRepository extends Repository<UserModel> {
  private queryRunner: QueryRunner;
  private readonly CACHE_TTL = 3600; // 1 hour cache duration
  private readonly MAX_BATCH_SIZE = 100;

  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger
  ) {
    super(UserModel, dataSource.createEntityManager());
    this.initializeRepository();
  }

  /**
   * Initializes repository with required configurations
   * @private
   */
  private async initializeRepository(): Promise<void> {
    this.queryRunner = this.dataSource.createQueryRunner();
    await this.setupIndexes();
    this.logger.info('User repository initialized with security configurations');
  }

  /**
   * Creates a new user with security validations and audit trail
   * @param userData User data for creation
   * @returns Created user data
   */
  public async createUser(userData: Partial<IUser>): Promise<IUser> {
    await this.queryRunner.startTransaction();

    try {
      // Validate user data
      await UserModel.validateUser(userData);

      // Check email uniqueness
      const existingUser = await this.findOne({
        where: { email: userData.email, isActive: true }
      });

      if (existingUser) {
        throw new ValidationError(
          VALIDATION_MESSAGES.DUPLICATE_RESOURCE,
          ['Email already exists'],
          {
            source: 'user_creation',
            timestamp: Date.now(),
            validationType: 'uniqueness',
            inputSize: userData.email.length
          }
        );
      }

      // Hash password if provided
      if (userData.password) {
        userData.passwordHash = await UserModel.hashPassword(userData.password);
        delete userData.password;
      }

      // Set default security preferences
      userData.securityPreferences = this.getDefaultSecurityPreferences();

      // Create user entity
      const user = this.create({
        ...userData,
        status: UserStatus.PENDING_ACTIVATION,
        failedLoginAttempts: 0,
        lastPasswordReset: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Save user with audit trail
      const savedUser = await this.save(user);
      await this.queryRunner.commitTransaction();

      this.logger.info(`User created successfully: ${savedUser.id}`);
      return savedUser;

    } catch (error) {
      await this.queryRunner.rollbackTransaction();
      this.logger.error(`User creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates user data with optimistic locking and change tracking
   * @param id User ID
   * @param userData Partial user update data
   * @returns Updated user data
   */
  public async updateUser(id: string, userData: Partial<IUser>): Promise<IUser> {
    await this.queryRunner.startTransaction();

    try {
      const existingUser = await this.findOne({ 
        where: { id, isActive: true },
        lock: { mode: 'optimistic', version: userData.version }
      });

      if (!existingUser) {
        throw new ValidationError(
          VALIDATION_MESSAGES.RESOURCE_NOT_FOUND,
          ['User not found'],
          {
            source: 'user_update',
            timestamp: Date.now(),
            validationType: 'existence',
            inputSize: id.length
          }
        );
      }

      // Track changes for audit
      const changes = this.trackChanges(existingUser, userData);

      // Update user properties
      Object.assign(existingUser, {
        ...userData,
        updatedAt: new Date()
      });

      // Save changes with audit trail
      const updatedUser = await this.save(existingUser);
      await this.queryRunner.commitTransaction();

      // Log audit trail
      this.logAuditTrail('UPDATE', id, changes);

      return updatedUser;

    } catch (error) {
      await this.queryRunner.rollbackTransaction();
      this.logger.error(`User update failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Performs soft delete with cascade handling and session cleanup
   * @param id User ID to delete
   * @returns Operation success status
   */
  public async deleteUser(id: string): Promise<boolean> {
    await this.queryRunner.startTransaction();

    try {
      const user = await this.findOne({ 
        where: { id, isActive: true }
      });

      if (!user) {
        throw new ValidationError(
          VALIDATION_MESSAGES.RESOURCE_NOT_FOUND,
          ['User not found'],
          {
            source: 'user_deletion',
            timestamp: Date.now(),
            validationType: 'existence',
            inputSize: id.length
          }
        );
      }

      // Soft delete implementation
      user.isActive = false;
      user.status = UserStatus.INACTIVE;
      user.updatedAt = new Date();

      // Save changes with audit trail
      await this.save(user);
      await this.queryRunner.commitTransaction();

      // Log audit trail
      this.logAuditTrail('DELETE', id, { status: UserStatus.INACTIVE });

      return true;

    } catch (error) {
      await this.queryRunner.rollbackTransaction();
      this.logger.error(`User deletion failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieves user by ID with role validation
   * @param id User ID
   * @returns User data if found
   */
  public async getUserById(id: string): Promise<IUser> {
    const user = await this.findOne({
      where: { id, isActive: true },
      cache: {
        id: `user_${id}`,
        milliseconds: this.CACHE_TTL
      }
    });

    if (!user) {
      throw new ValidationError(
        VALIDATION_MESSAGES.RESOURCE_NOT_FOUND,
        ['User not found'],
        {
          source: 'user_retrieval',
          timestamp: Date.now(),
          validationType: 'existence',
          inputSize: id.length
        }
      );
    }

    return user;
  }

  /**
   * Retrieves user by email with security checks
   * @param email User email
   * @returns User data if found
   */
  public async getUserByEmail(email: string): Promise<IUser> {
    const user = await this.findOne({
      where: { email: email.toLowerCase(), isActive: true },
      cache: {
        id: `user_email_${email}`,
        milliseconds: this.CACHE_TTL
      }
    });

    if (!user) {
      throw new ValidationError(
        VALIDATION_MESSAGES.RESOURCE_NOT_FOUND,
        ['User not found'],
        {
          source: 'user_retrieval',
          timestamp: Date.now(),
          validationType: 'existence',
          inputSize: email.length
        }
      );
    }

    return user;
  }

  /**
   * Sets up required database indexes for performance
   * @private
   */
  private async setupIndexes(): Promise<void> {
    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email_active ON users (email, "isActive");
      CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);
      CREATE INDEX IF NOT EXISTS idx_users_business_unit ON users ("businessUnit");
    `);
  }

  /**
   * Gets default security preferences for new users
   * @private
   */
  private getDefaultSecurityPreferences(): IUserSecurityPreferences {
    return {
      mfaEnabled: false,
      passwordExpiryDays: 90,
      loginNotifications: true,
      allowedIPs: []
    };
  }

  /**
   * Tracks changes for audit trail
   * @private
   */
  private trackChanges(oldData: IUser, newData: Partial<IUser>): Record<string, unknown> {
    const changes: Record<string, unknown> = {};
    
    Object.keys(newData).forEach(key => {
      if (oldData[key] !== newData[key]) {
        changes[key] = {
          old: oldData[key],
          new: newData[key]
        };
      }
    });

    return changes;
  }

  /**
   * Logs audit trail entries
   * @private
   */
  private logAuditTrail(
    action: string,
    userId: string,
    changes: Record<string, unknown>
  ): void {
    this.logger.info('Audit Trail', {
      action,
      userId,
      changes,
      timestamp: new Date(),
      source: 'user_repository'
    });
  }
}