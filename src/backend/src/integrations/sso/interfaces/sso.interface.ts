// @package auth0 v3.5.0
// @package jsonwebtoken v9.0.0
// @package openid-client v5.4.0

import { IBaseService } from '../../../common/interfaces/service.interface';

/**
 * Supported SSO protocols
 */
export enum SSOProtocol {
  AUTH0 = 'auth0',
  SAML = 'saml2',
  OIDC = 'oidc'
}

/**
 * MFA types supported by the SSO integration
 */
export enum MFAType {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email',
  HARDWARE_KEY = 'hardware_key'
}

/**
 * Rate limiting configuration for SSO authentication
 */
export interface IRateLimit {
  enabled: boolean;
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

/**
 * Audit configuration for SSO events
 */
export interface IAuditConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  storageRetentionDays: number;
  sensitiveFields: string[];
}

/**
 * Enhanced security options for SSO configuration
 */
export interface ISecurityOptions {
  passwordPolicy: {
    minLength: number;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    requireUppercase: boolean;
    maxAge: number;
  };
  sessionConfig: {
    absoluteTimeout: number;
    inactivityTimeout: number;
    persistentSession: boolean;
  };
  ipWhitelist?: string[];
  forceMFAForRoles?: string[];
}

/**
 * Comprehensive SSO configuration interface with enhanced security features
 */
export interface ISSOConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  allowedOrigins: string[];
  protocol: SSOProtocol;
  enableMFA: boolean;
  tokenExpiryMinutes: number;
  maxLoginAttempts: number;
  rateLimit: IRateLimit;
  auditConfig: IAuditConfig;
  securityOptions: ISecurityOptions;
}

/**
 * Security preferences for SSO users
 */
export interface ISecurityPreferences {
  preferredMFAType: MFAType;
  backupEmailVerified: boolean;
  passwordLastChanged: Date;
  trustedDevices: Array<{
    deviceId: string;
    lastUsed: Date;
    userAgent: string;
  }>;
}

/**
 * Audit trail entry for user security events
 */
export interface IAuditTrailEntry {
  eventType: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
  location?: {
    country: string;
    city: string;
  };
}

/**
 * Enhanced SSO user interface with comprehensive security features
 */
export interface ISSOUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
  mfaType: MFAType;
  lastLogin: Date;
  lastPasswordChange: Date;
  loginAttempts: number;
  isLocked: boolean;
  securityPreferences: ISecurityPreferences;
  auditTrail: IAuditTrailEntry[];
}

/**
 * Authentication options for SSO login
 */
export interface IAuthOptions {
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  maxAge?: number;
  loginHint?: string;
  acrValues?: string[];
  scope?: string[];
  state?: string;
  nonce?: string;
}

/**
 * Token validation options
 */
export interface IValidationOptions {
  audience?: string;
  issuer?: string;
  algorithms?: string[];
  clockTolerance?: number;
  ignoreExpiration?: boolean;
}

/**
 * MFA configuration options
 */
export interface IMFAOptions {
  type: MFAType;
  phoneNumber?: string;
  email?: string;
  backupCodes?: number;
  validityWindow?: number;
}

/**
 * Enhanced SSO service interface with comprehensive security features
 */
export interface ISSOService extends IBaseService {
  /**
   * Generates secure authentication URL for SSO login
   * @param redirectUri - Post-authentication redirect URI
   * @param authOptions - Additional authentication options
   * @returns Promise resolving to secure authentication URL
   */
  authenticate(redirectUri: string, authOptions?: IAuthOptions): Promise<string>;

  /**
   * Validates and verifies JWT token from SSO provider
   * @param token - JWT token to validate
   * @param validationOptions - Token validation options
   * @returns Promise resolving to token validity status
   */
  validateToken(token: string, validationOptions?: IValidationOptions): Promise<boolean>;

  /**
   * Securely retrieves user information from SSO provider
   * @param token - Valid JWT token
   * @param options - Additional options for user info retrieval
   * @returns Promise resolving to user information with security details
   */
  getUserInfo(token: string, options?: Record<string, unknown>): Promise<ISSOUser>;

  /**
   * Configures multi-factor authentication for user
   * @param userId - User identifier
   * @param mfaOptions - MFA configuration options
   * @returns Promise resolving on successful MFA setup
   */
  setupMFA(userId: string, mfaOptions: IMFAOptions): Promise<void>;

  /**
   * Revokes active JWT token
   * @param token - Token to revoke
   * @returns Promise resolving on successful token revocation
   */
  revokeToken(token: string): Promise<void>;
}

export {
  SSOProtocol,
  MFAType,
  ISSOConfig,
  ISSOUser,
  ISSOService,
  IAuthOptions,
  IValidationOptions,
  IMFAOptions,
  ISecurityOptions,
  IAuditConfig,
  IRateLimit
};