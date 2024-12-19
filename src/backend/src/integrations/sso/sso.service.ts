// @package inversify v6.0.1
// @package @auth0/auth0-spa-js v2.1.0
// @package jsonwebtoken v9.0.0
// @package winston v3.8.2
// @package rate-limiter-flexible v2.4.1

import { injectable } from 'inversify';
import { Auth0Client } from '@auth0/auth0-spa-js';
import * as jwt from 'jsonwebtoken';
import { Logger } from 'winston';
import { RateLimiter } from 'rate-limiter-flexible';

import { IBaseService } from '../../../common/interfaces/service.interface';
import { 
  ISSOService, 
  ISSOConfig, 
  ISSOUser, 
  IAuthOptions,
  IValidationOptions,
  IMFAOptions,
  MFAType,
  SSOProtocol 
} from './interfaces/sso.interface';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * Enterprise-grade SSO service implementation using Auth0
 * Provides secure authentication, MFA support, and comprehensive audit logging
 */
@injectable()
export class SSOService implements ISSOService, IBaseService {
  private auth0Client: Auth0Client | null = null;
  private readonly logger: Logger;
  private config: ISSOConfig | null = null;
  private rateLimiter: RateLimiter | null = null;
  private userInfoCache: Map<string, { data: ISSOUser; expires: number }>;
  private initialized = false;
  private readonly USER_CACHE_TTL = 300000; // 5 minutes
  private readonly TOKEN_BLACKLIST = new Set<string>();

  constructor(logger: Logger) {
    this.logger = logger;
    this.userInfoCache = new Map();
  }

  /**
   * Initializes the SSO service with enhanced security configuration
   * @param config - SSO configuration with security settings
   */
  public async initialize(config: ISSOConfig): Promise<void> {
    try {
      this.validateConfig(config);
      
      this.config = config;
      
      // Initialize Auth0 client with connection pooling
      this.auth0Client = new Auth0Client({
        domain: config.domain,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        useRefreshTokens: true,
        cacheLocation: 'memory'
      });

      // Configure rate limiter
      if (config.rateLimit.enabled) {
        this.rateLimiter = new RateLimiter({
          points: config.rateLimit.maxAttempts,
          duration: config.rateLimit.windowMs,
          blockDuration: config.rateLimit.blockDurationMs
        });
      }

      this.initialized = true;
      this.logger.info('SSO Service initialized successfully', {
        service: 'SSOService',
        protocol: config.protocol,
        mfaEnabled: config.enableMFA
      });
    } catch (error) {
      this.logger.error('Failed to initialize SSO service', {
        error,
        service: 'SSOService'
      });
      throw error;
    }
  }

  /**
   * Validates service configuration and dependencies
   */
  public async validate(): Promise<boolean> {
    if (!this.initialized || !this.config || !this.auth0Client) {
      return false;
    }

    try {
      // Verify Auth0 connection
      await this.auth0Client.checkSession();
      
      // Verify rate limiter if enabled
      if (this.config.rateLimit.enabled && !this.rateLimiter) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('SSO service validation failed', {
        error,
        service: 'SSOService'
      });
      return false;
    }
  }

  /**
   * Generates secure authentication URL with MFA support
   */
  public async authenticate(redirectUri: string, options?: IAuthOptions): Promise<string> {
    this.ensureInitialized();

    try {
      if (this.rateLimiter) {
        await this.checkRateLimit(redirectUri);
      }

      const authOptions = {
        redirect_uri: redirectUri,
        ...options,
        scope: 'openid profile email',
        response_type: 'code',
        audience: this.config!.domain
      };

      if (this.config!.enableMFA) {
        authOptions.acr_values = 'http://schemas.openid.net/pape/policies/2007/06/multi-factor';
      }

      const authUrl = await this.auth0Client!.buildAuthorizeUrl(authOptions);

      this.logger.info('Generated authentication URL', {
        service: 'SSOService',
        redirectUri,
        mfaEnabled: this.config!.enableMFA
      });

      return authUrl;
    } catch (error) {
      this.logger.error('Failed to generate authentication URL', {
        error,
        service: 'SSOService',
        redirectUri
      });
      throw error;
    }
  }

  /**
   * Validates JWT token with comprehensive security checks
   */
  public async validateToken(token: string, options?: IValidationOptions): Promise<boolean> {
    this.ensureInitialized();

    try {
      if (this.TOKEN_BLACKLIST.has(token)) {
        return false;
      }

      const validationOptions = {
        algorithms: ['RS256'],
        audience: this.config!.domain,
        issuer: `https://${this.config!.domain}/`,
        ...options
      };

      const decodedToken = jwt.verify(token, this.config!.clientSecret, validationOptions);

      if (!decodedToken) {
        return false;
      }

      this.logger.debug('Token validated successfully', {
        service: 'SSOService',
        tokenId: decodedToken.sub
      });

      return true;
    } catch (error) {
      this.logger.error('Token validation failed', {
        error,
        service: 'SSOService'
      });
      return false;
    }
  }

  /**
   * Retrieves user information with caching support
   */
  public async getUserInfo(token: string): Promise<ISSOUser> {
    this.ensureInitialized();

    try {
      // Check cache first
      const cachedUser = this.userInfoCache.get(token);
      if (cachedUser && cachedUser.expires > Date.now()) {
        return cachedUser.data;
      }

      const isValid = await this.validateToken(token);
      if (!isValid) {
        throw new Error('Invalid token');
      }

      const userInfo = await this.auth0Client!.getUser(token);
      
      const ssoUser: ISSOUser = {
        id: userInfo.sub!,
        email: userInfo.email!,
        name: userInfo.name!,
        roles: userInfo.roles || [],
        permissions: userInfo.permissions || [],
        mfaEnabled: userInfo.mfa_enabled || false,
        mfaType: userInfo.mfa_type as MFAType || MFAType.TOTP,
        lastLogin: new Date(userInfo.last_login!),
        lastPasswordChange: new Date(userInfo.last_password_reset!),
        loginAttempts: userInfo.login_attempts || 0,
        isLocked: userInfo.is_locked || false,
        securityPreferences: {
          preferredMFAType: userInfo.preferred_mfa_type as MFAType || MFAType.TOTP,
          backupEmailVerified: userInfo.backup_email_verified || false,
          passwordLastChanged: new Date(userInfo.last_password_reset!),
          trustedDevices: userInfo.trusted_devices || []
        },
        auditTrail: userInfo.audit_trail || []
      };

      // Cache user info
      this.userInfoCache.set(token, {
        data: ssoUser,
        expires: Date.now() + this.USER_CACHE_TTL
      });

      return ssoUser;
    } catch (error) {
      this.logger.error('Failed to retrieve user info', {
        error,
        service: 'SSOService'
      });
      throw error;
    }
  }

  /**
   * Configures multi-factor authentication for user
   */
  public async setupMFA(userId: string, mfaOptions: IMFAOptions): Promise<void> {
    this.ensureInitialized();

    try {
      if (!this.config!.enableMFA) {
        throw new Error('MFA is not enabled in service configuration');
      }

      // Configure MFA settings in Auth0
      await this.auth0Client!.updateUser(userId, {
        mfa_enabled: true,
        mfa_type: mfaOptions.type,
        phone_number: mfaOptions.phoneNumber,
        email: mfaOptions.email
      });

      this.logger.info('MFA configured successfully', {
        service: 'SSOService',
        userId,
        mfaType: mfaOptions.type
      });
    } catch (error) {
      this.logger.error('Failed to configure MFA', {
        error,
        service: 'SSOService',
        userId
      });
      throw error;
    }
  }

  /**
   * Revokes JWT token and adds to blacklist
   */
  public async revokeToken(token: string): Promise<void> {
    this.ensureInitialized();

    try {
      const isValid = await this.validateToken(token);
      if (!isValid) {
        throw new Error('Invalid token');
      }

      // Add to blacklist
      this.TOKEN_BLACKLIST.add(token);
      
      // Remove from cache
      this.userInfoCache.delete(token);

      this.logger.info('Token revoked successfully', {
        service: 'SSOService',
        tokenId: jwt.decode(token)?.sub
      });
    } catch (error) {
      this.logger.error('Failed to revoke token', {
        error,
        service: 'SSOService'
      });
      throw error;
    }
  }

  /**
   * Performs comprehensive service health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.initialized) {
        return false;
      }

      // Verify Auth0 connection
      await this.auth0Client!.checkSession();

      // Verify rate limiter if enabled
      if (this.config!.rateLimit.enabled && !this.rateLimiter) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Health check failed', {
        error,
        service: 'SSOService'
      });
      return false;
    }
  }

  /**
   * Validates rate limit for authentication requests
   */
  private async checkRateLimit(key: string): Promise<void> {
    if (!this.rateLimiter) {
      return;
    }

    try {
      await this.rateLimiter.consume(key);
    } catch (error) {
      this.logger.warn('Rate limit exceeded', {
        service: 'SSOService',
        key
      });
      throw new Error('Rate limit exceeded');
    }
  }

  /**
   * Validates SSO configuration
   */
  private validateConfig(config: ISSOConfig): void {
    if (!config.domain || !config.clientId || !config.clientSecret) {
      throw new Error('Invalid SSO configuration: missing required fields');
    }

    if (!Object.values(SSOProtocol).includes(config.protocol)) {
      throw new Error('Invalid SSO protocol specified');
    }
  }

  /**
   * Ensures service is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.config || !this.auth0Client) {
      throw new Error('SSO service not initialized');
    }
  }
}