// @package auth0-spa-js v2.1.0
// @package jwt-decode v3.1.2

import { UserRole } from '../../backend/src/core/users/interfaces/user.interface';

/**
 * Enhanced user interface with comprehensive security and audit fields
 * Implements ISO 27001 compliance requirements
 */
export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: string[];
  lastLogin: Date;
  lastPasswordChange: Date;
  isActive: boolean;
  isMfaEnabled: boolean;
  preferredLanguage: string;
  allowedIpAddresses: string[];
  sessionExpiry: Date;
  lastLoginIp: string;
  featureFlags: Record<string, boolean>;
}

/**
 * Login credentials interface with enhanced security features
 * Supports MFA and device fingerprinting
 */
export interface LoginCredentials {
  email: string;
  password: string;
  mfaToken?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Enhanced authentication response interface
 * Includes comprehensive security metadata and permissions
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: IUser;
  tokenType: string;
  requiresMfa: boolean;
  grantedPermissions: string[];
  sessionMetadata: Record<string, any>;
}

/**
 * Comprehensive authentication state interface
 * Manages authentication lifecycle and security context
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: IUser | null;
  loading: boolean;
  error: string | null;
  isTokenRefreshing: boolean;
  isMfaRequired: boolean;
  sessionTimeout: number;
  lastActivity: Date | null;
  securityContext: Record<string, any>;
}

/**
 * Security validation result interface
 * Used for access control and permission checks
 */
export interface SecurityValidationResult {
  isValid: boolean;
  reason?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * MFA verification options interface
 * Supports multiple MFA methods
 */
export interface MfaVerificationOptions {
  method: 'APP' | 'SMS' | 'EMAIL';
  token: string;
  deviceTrust?: boolean;
  rememberDevice?: boolean;
}

/**
 * Session management options interface
 * Controls session behavior and security settings
 */
export interface SessionOptions {
  timeoutMinutes: number;
  extendOnActivity: boolean;
  enforceIpLock: boolean;
  requireMfaOnSuspicious: boolean;
}

/**
 * Enhanced authentication context interface
 * Provides comprehensive auth functionality with security features
 */
export interface AuthContextType {
  state: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: (options?: { everywhere?: boolean }) => Promise<void>;
  refreshToken: () => Promise<void>;
  validateSession: () => Promise<boolean>;
  verifyMfa: (token: string, options?: MfaVerificationOptions) => Promise<void>;
  revokeSession: (sessionId?: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  getUserPermissions: () => Promise<string[]>;
  hasFeatureAccess: (feature: string) => boolean;
  validateSecurityContext: () => Promise<SecurityValidationResult>;
  updateSessionOptions: (options: Partial<SessionOptions>) => void;
}

/**
 * Error types specific to authentication
 * Provides detailed error categorization for security events
 */
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  MFA_REQUIRED = 'MFA_REQUIRED',
  MFA_INVALID = 'MFA_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

/**
 * Custom error class for authentication failures
 * Implements detailed security error handling
 */
export class AuthenticationError extends Error {
  constructor(
    public type: AuthErrorType,
    public message: string,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Type guard for auth response validation
 * Ensures type safety for authentication responses
 */
export function isValidAuthResponse(response: any): response is AuthResponse {
  return (
    response &&
    typeof response.accessToken === 'string' &&
    typeof response.refreshToken === 'string' &&
    typeof response.expiresIn === 'number' &&
    response.user &&
    typeof response.user.id === 'string'
  );
}

/**
 * Type guard for security validation
 * Ensures proper security context validation
 */
export function isSecurityValidationResult(
  result: any
): result is SecurityValidationResult {
  return (
    result &&
    typeof result.isValid === 'boolean' &&
    result.timestamp instanceof Date
  );
}