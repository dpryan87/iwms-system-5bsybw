/**
 * @fileoverview Enhanced User Model implementation with comprehensive security features
 * Implements RBAC, audit trails, and security monitoring capabilities
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // v6.0.1
import { Model, Schema, Document } from 'mongoose'; // v7.0.0
import { Cache } from 'cache-manager'; // v5.0.0
import * as argon2 from 'argon2'; // v0.30.3
import { IUser, UserRole, UserStatus } from '../interfaces/user.interface';
import { createUserSchema } from '../validation/user.schema';
import { ValidationError } from '../../../common/utils/validation.util';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * Enhanced user schema with security and audit capabilities
 */
const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  passwordHash: {
    type: String,
    required: true,
    select: false // Exclude from queries by default
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.PENDING_ACTIVATION,
    index: true
  },
  permissions: [{
    type: String,
    required: true
  }],
  department: {
    type: String,
    trim: true,
    maxlength: 100
  },
  businessUnit: {
    type: String,
    trim: true,
    maxlength: 100
  },
  employeeId: {
    type: String,
    sparse: true,
    maxlength: 50
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isMFAEnabled: {
    type: Boolean,
    default: false
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lastLogin: Date,
  passwordLastChanged: {
    type: Date,
    required: true
  },
  lastPasswordReset: Date,
  preferredLanguage: {
    type: String,
    default: 'en',
    match: /^[a-z]{2}(-[A-Z]{2})?$/
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  securityPreferences: {
    mfaEnabled: { type: Boolean, default: false },
    mfaMethod: { type: String, enum: ['APP', 'SMS', 'EMAIL'] },
    passwordExpiryDays: { type: Number, default: 90 },
    loginNotifications: { type: Boolean, default: true },
    allowedIPs: [{ type: String }]
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  }
}, {
  timestamps: true,
  collection: 'users',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance and security
userSchema.index({ email: 1, isActive: 1 }, { unique: true });
userSchema.index({ role: 1, businessUnit: 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ lastLogin: 1 });

@injectable()
export class UserModel extends Model<IUser & Document> {
  private cache: Cache;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly PASSWORD_HISTORY_SIZE = 5;

  /**
   * Validates user data against schema and security requirements
   * @param userData - User data to validate
   * @returns Promise resolving to validation result
   */
  public async validateUser(userData: Partial<IUser>): Promise<boolean> {
    try {
      const validationResult = await createUserSchema.validateAsync(userData, {
        abortEarly: false
      });

      if (!validationResult) {
        throw new ValidationError(
          'User validation failed',
          ['Invalid user data'],
          {
            source: 'user_validation',
            timestamp: Date.now(),
            validationType: 'user',
            inputSize: JSON.stringify(userData).length
          }
        );
      }

      // Check email uniqueness
      const existingUser = await this.findOne({ 
        email: userData.email, 
        isActive: true 
      });

      if (existingUser) {
        throw new ValidationError(
          'Email already exists',
          ['Email must be unique'],
          {
            source: 'user_validation',
            timestamp: Date.now(),
            validationType: 'email',
            inputSize: userData.email.length
          }
        );
      }

      return true;
    } catch (error) {
      throw new ValidationError(
        'User validation failed',
        error.details?.map(detail => detail.message) || [error.message],
        {
          source: 'user_validation',
          timestamp: Date.now(),
          validationType: 'user',
          inputSize: JSON.stringify(userData).length
        }
      );
    }
  }

  /**
   * Securely hashes password using Argon2id
   * @param password - Plain text password
   * @returns Promise resolving to hashed password
   */
  public async hashPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        saltLength: 32
      });
    } catch (error) {
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Tracks and manages login attempts for security
   * @param success - Whether login attempt was successful
   * @param userId - User ID to track
   */
  public async trackLoginAttempt(success: boolean, userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;

    if (success) {
      user.failedLoginAttempts = 0;
      user.lastLogin = new Date();
    } else {
      user.failedLoginAttempts += 1;
      
      if (user.failedLoginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        user.status = UserStatus.LOCKED;
        // Trigger security alert
        this.emitSecurityAlert('ACCOUNT_LOCKED', {
          userId,
          attempts: user.failedLoginAttempts,
          timestamp: new Date()
        });
      }
    }

    await user.save();
    await this.invalidateCache(userId);
  }

  /**
   * Manages user cache invalidation
   * @param userId - User ID to invalidate
   */
  private async invalidateCache(userId: string): Promise<void> {
    const cacheKey = `user:${userId}`;
    await this.cache.del(cacheKey);
  }

  /**
   * Emits security alerts for monitoring
   * @param alertType - Type of security alert
   * @param data - Alert data
   */
  private emitSecurityAlert(alertType: string, data: Record<string, unknown>): void {
    // Implementation would connect to monitoring system
    console.log('Security Alert:', {
      type: alertType,
      data,
      timestamp: new Date(),
      severity: 'HIGH'
    });
  }
}

export default UserModel;