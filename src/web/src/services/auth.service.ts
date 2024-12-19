/**
 * Authentication Service
 * Implements secure user authentication, token management, session validation,
 * and multi-factor authentication for the IWMS web application.
 * Follows OWASP security standards and GDPR compliance requirements.
 * @version 1.0.0
 */

// External imports
// @package auth0-spa-js v2.1.0
import { Auth0Client, Auth0ClientOptions } from '@auth0/auth0-spa-js';
// @package jwt-decode v3.1.2
import jwtDecode from 'jwt-decode';

// Internal imports
import axiosInstance from '../api/axios.config';
import { 
  IUser, 
  LoginCredentials, 
  AuthResponse, 
  AuthErrorType, 
  AuthenticationError,
  MfaVerificationOptions,
  SecurityValidationResult,
  SessionOptions
} from '../types/auth.types';
import { setStoredToken, getStoredToken, isTokenValid, getUserFromToken } from '../utils/auth.utils';

/**
 * Authentication configuration with enhanced security settings
 */
const AUTH_CONFIG: Auth0ClientOptions = {
  domain: process.env.VITE_AUTH0_DOMAIN!,
  clientId: process.env.VITE_AUTH0_CLIENT_ID!,
  audience: process.env.VITE_AUTH0_AUDIENCE,
  redirectUri: window.location.origin,
  cacheLocation: 'memory',
  useRefreshTokens: true,
  scope: 'openid profile email offline_access',
};

/**
 * Enhanced AuthService class implementing comprehensive authentication functionality
 * with security best practices and monitoring capabilities
 */
export class AuthService {
  private auth0Client: Auth0Client;
  private loginAttempts: Map<string, number>;
  private readonly MAX_LOGIN_ATTEMPTS = 3;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private sessionTimeouts: Map<string, NodeJS.Timeout>;

  constructor() {
    this.auth0Client = new Auth0Client(AUTH_CONFIG);
    this.loginAttempts = new Map();
    this.sessionTimeouts = new Map();
    this.initializeSecurityMonitoring();
  }

  /**
   * Initializes security monitoring and rate limiting
   * @private
   */
  private initializeSecurityMonitoring(): void {
    // Clear login attempts periodically
    setInterval(() => {
      const now = Date.now();
      for (const [email, timestamp] of this.loginAttempts.entries()) {
        if (now - timestamp > this.LOCKOUT_DURATION) {
          this.loginAttempts.delete(email);
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Performs secure user authentication with MFA support
   * @param credentials User login credentials
   * @returns Promise resolving to authentication response
   * @throws AuthenticationError for various authentication failures
   */
  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Check for account lockout
      const attempts = this.loginAttempts.get(credentials.email) || 0;
      if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
        throw new AuthenticationError(
          AuthErrorType.ACCOUNT_LOCKED,
          'Account temporarily locked due to multiple failed attempts'
        );
      }

      // Authenticate with Auth0
      const authResult = await this.auth0Client.loginWithCredentials({
        username: credentials.email,
        password: credentials.password,
      });

      // Validate MFA if enabled
      if (authResult.requiresMfa && !credentials.mfaToken) {
        throw new AuthenticationError(
          AuthErrorType.MFA_REQUIRED,
          'Multi-factor authentication required'
        );
      }

      // Verify MFA token if provided
      if (credentials.mfaToken) {
        await this.verifyMfa(credentials.mfaToken, {
          method: 'APP',
          deviceTrust: true,
        });
      }

      // Process successful authentication
      const user = await this.processAuthResult(authResult);
      
      // Clear failed login attempts
      this.loginAttempts.delete(credentials.email);

      // Set up session management
      this.initializeSession(user.id);

      return {
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken!,
        expiresIn: authResult.expiresIn,
        user,
        tokenType: 'Bearer',
        requiresMfa: false,
        grantedPermissions: user.permissions,
        sessionMetadata: {
          deviceId: credentials.deviceId,
          loginTimestamp: new Date().toISOString(),
          ipAddress: credentials.ipAddress,
        },
      };

    } catch (error) {
      // Handle failed login attempt
      const currentAttempts = (this.loginAttempts.get(credentials.email) || 0) + 1;
      this.loginAttempts.set(credentials.email, currentAttempts);

      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new AuthenticationError(
        AuthErrorType.INVALID_CREDENTIALS,
        'Invalid email or password'
      );
    }
  }

  /**
   * Validates current session with comprehensive security checks
   * @returns Promise resolving to session validity status
   */
  public async validateSession(): Promise<SecurityValidationResult> {
    try {
      const token = await getStoredToken();
      if (!token || !isTokenValid(token)) {
        return {
          isValid: false,
          reason: 'Invalid or expired token',
          timestamp: new Date(),
        };
      }

      const user = getUserFromToken(token);
      if (!user) {
        return {
          isValid: false,
          reason: 'Invalid user data in token',
          timestamp: new Date(),
        };
      }

      // Perform additional security checks
      const securityCheck = await this.performSecurityCheck(user);
      if (!securityCheck.isValid) {
        return securityCheck;
      }

      return {
        isValid: true,
        timestamp: new Date(),
        metadata: {
          userId: user.id,
          lastValidated: new Date().toISOString(),
        },
      };

    } catch (error) {
      return {
        isValid: false,
        reason: 'Session validation failed',
        timestamp: new Date(),
        metadata: { error: error.message },
      };
    }
  }

  /**
   * Verifies MFA token with enhanced security
   * @param token MFA verification token
   * @param options Additional MFA verification options
   */
  public async verifyMfa(
    token: string,
    options: MfaVerificationOptions
  ): Promise<void> {
    try {
      const response = await axiosInstance.post('/auth/mfa/verify', {
        token,
        method: options.method,
        deviceTrust: options.deviceTrust,
        rememberDevice: options.rememberDevice,
      });

      if (!response.verified) {
        throw new AuthenticationError(
          AuthErrorType.MFA_INVALID,
          'Invalid MFA token'
        );
      }
    } catch (error) {
      throw new AuthenticationError(
        AuthErrorType.MFA_INVALID,
        'MFA verification failed'
      );
    }
  }

  /**
   * Performs secure logout with session cleanup
   * @param options Logout options
   */
  public async logout(options?: { everywhere?: boolean }): Promise<void> {
    try {
      if (options?.everywhere) {
        await axiosInstance.post('/auth/logout/all');
      }

      await this.auth0Client.logout({
        returnTo: window.location.origin,
      });

      // Clear stored tokens and session data
      localStorage.removeItem('iwms_access_token');
      localStorage.removeItem('iwms_refresh_token');
      
      // Clear session timeout
      const user = getUserFromToken(await getStoredToken());
      if (user) {
        const timeout = this.sessionTimeouts.get(user.id);
        if (timeout) {
          clearTimeout(timeout);
          this.sessionTimeouts.delete(user.id);
        }
      }

    } catch (error) {
      console.error('Logout failed:', error);
      throw new AuthenticationError(
        AuthErrorType.NETWORK_ERROR,
        'Failed to complete logout'
      );
    }
  }

  /**
   * Processes authentication result and initializes user session
   * @private
   */
  private async processAuthResult(authResult: any): Promise<IUser> {
    const user = getUserFromToken(authResult.accessToken);
    if (!user) {
      throw new AuthenticationError(
        AuthErrorType.INVALID_TOKEN,
        'Invalid user data in token'
      );
    }

    await setStoredToken(authResult.accessToken);
    return user;
  }

  /**
   * Performs comprehensive security check for session validation
   * @private
   */
  private async performSecurityCheck(
    user: IUser
  ): Promise<SecurityValidationResult> {
    // Verify user status and permissions
    if (!user.isActive) {
      return {
        isValid: false,
        reason: 'User account is inactive',
        timestamp: new Date(),
      };
    }

    // Check for suspicious activity
    const suspiciousActivity = await this.detectSuspiciousActivity(user);
    if (suspiciousActivity) {
      return {
        isValid: false,
        reason: 'Suspicious activity detected',
        timestamp: new Date(),
        metadata: { suspiciousActivity },
      };
    }

    return {
      isValid: true,
      timestamp: new Date(),
    };
  }

  /**
   * Initializes session management for user
   * @private
   */
  private initializeSession(userId: string): void {
    const existingTimeout = this.sessionTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.handleSessionTimeout(userId);
    }, AUTH_CONFIG.sessionTimeout || 3600000);

    this.sessionTimeouts.set(userId, timeout);
  }

  /**
   * Handles session timeout with cleanup
   * @private
   */
  private async handleSessionTimeout(userId: string): Promise<void> {
    this.sessionTimeouts.delete(userId);
    await this.logout();
  }

  /**
   * Detects suspicious activity in user session
   * @private
   */
  private async detectSuspiciousActivity(user: IUser): Promise<boolean> {
    try {
      const response = await axiosInstance.post('/auth/security/check', {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return response.suspicious;
    } catch (error) {
      console.error('Security check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export default new AuthService();