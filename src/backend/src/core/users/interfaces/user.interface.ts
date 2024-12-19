// @package inversify v6.0.1
import { IBaseService } from '../../../common/interfaces/service.interface';

/**
 * Enhanced user role enumeration with role hierarchy
 * Aligned with RBAC security requirements
 */
export enum UserRole {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  FACILITY_MANAGER = 'FACILITY_MANAGER',
  SPACE_PLANNER = 'SPACE_PLANNER',
  BU_ADMIN = 'BU_ADMIN',
  TENANT_USER = 'TENANT_USER',
  READONLY_USER = 'READONLY_USER'
}

/**
 * User account status enumeration
 * Tracks various states of user accounts for security monitoring
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_ACTIVATION = 'PENDING_ACTIVATION',
  LOCKED = 'LOCKED'
}

/**
 * Security preferences interface
 * Manages user-specific security settings
 */
export interface IUserSecurityPreferences {
  mfaEnabled: boolean;
  mfaMethod?: 'APP' | 'SMS' | 'EMAIL';
  passwordExpiryDays: number;
  loginNotifications: boolean;
  allowedIPs?: string[];
}

/**
 * Audit information interface
 * Tracks all changes to user data for compliance
 */
export interface IAuditInfo {
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  lastModifiedFrom?: string;
}

/**
 * Comprehensive user interface with enhanced security and audit capabilities
 * Implements ISO 27001 and GDPR requirements
 */
export interface IUser extends IAuditInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  permissions: string[];
  department?: string;
  businessUnit?: string;
  employeeId?: string;
  lastLogin?: Date;
  isActive: boolean;
  isMFAEnabled: boolean;
  preferredLanguage: string;
  timezone: string;
  passwordLastChanged: Date;
  failedLoginAttempts: number;
  lastPasswordReset: Date;
  securityPreferences: IUserSecurityPreferences;
  metadata?: Record<string, unknown>;
}

/**
 * User creation interface
 * Defines required fields for user creation with security validation
 */
export interface IUserCreate {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department?: string;
  businessUnit?: string;
  employeeId?: string;
  preferredLanguage: string;
  timezone: string;
  securityPreferences?: Partial<IUserSecurityPreferences>;
}

/**
 * User update interface
 * Defines updatable user fields with security constraints
 */
export interface IUserUpdate {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  status?: UserStatus;
  permissions?: string[];
  department?: string;
  businessUnit?: string;
  preferredLanguage?: string;
  timezone?: string;
  securityPreferences?: Partial<IUserSecurityPreferences>;
  metadata?: Record<string, unknown>;
}

/**
 * User security update interface
 * Manages security-specific user updates
 */
export interface IUserSecurityUpdate {
  isMFAEnabled?: boolean;
  mfaMethod?: 'APP' | 'SMS' | 'EMAIL';
  passwordReset?: boolean;
  status?: UserStatus;
  allowedIPs?: string[];
}

/**
 * Enhanced user service interface with comprehensive operation support
 * Implements security-focused user management operations
 */
export interface IUserService extends IBaseService {
  /**
   * Creates a new user with security validations
   * @param userData - User creation data
   * @returns Promise resolving to created user data
   */
  createUser(userData: IUserCreate): Promise<IUser>;

  /**
   * Updates user data with security checks
   * @param id - User ID
   * @param userData - Partial user update data
   * @returns Promise resolving to updated user data
   */
  updateUser(id: string, userData: Partial<IUserUpdate>): Promise<IUser>;

  /**
   * Soft deletes user with audit trail
   * @param id - User ID
   * @returns Promise resolving to deletion success status
   */
  deleteUser(id: string): Promise<boolean>;

  /**
   * Retrieves user by ID with role validation
   * @param id - User ID
   * @returns Promise resolving to user data
   */
  getUserById(id: string): Promise<IUser>;

  /**
   * Retrieves user by email with security checks
   * @param email - User email
   * @returns Promise resolving to user data
   */
  getUserByEmail(email: string): Promise<IUser>;

  /**
   * Validates user access permissions
   * @param userId - User ID
   * @param resourceId - Resource ID
   * @param action - Requested action
   * @returns Promise resolving to access validation result
   */
  validateUserAccess(userId: string, resourceId: string, action: string): Promise<boolean>;

  /**
   * Updates user security settings
   * @param userId - User ID
   * @param securityData - Security update data
   */
  updateUserSecurity(userId: string, securityData: IUserSecurityUpdate): Promise<void>;

  /**
   * Handles failed login attempt
   * @param userId - User ID
   * @returns Promise resolving to updated user status
   */
  handleFailedLogin(userId: string): Promise<UserStatus>;

  /**
   * Resets user security status
   * @param userId - User ID
   * @returns Promise resolving to success status
   */
  resetSecurityStatus(userId: string): Promise<boolean>;
}

/**
 * User permission validation result interface
 * Provides detailed access control information
 */
export interface IPermissionValidationResult {
  granted: boolean;
  reason?: string;
  timestamp: Date;
  expiresAt?: Date;
}

// Export all interfaces and types for user management implementation
export {
  IUser,
  IUserService,
  IUserCreate,
  IUserUpdate,
  IUserSecurityUpdate,
  IUserSecurityPreferences,
  IAuditInfo,
  IPermissionValidationResult,
  UserRole,
  UserStatus
};