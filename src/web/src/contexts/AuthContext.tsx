/**
 * Authentication Context Provider
 * Implements secure authentication state management with comprehensive security features
 * including SSO integration, MFA support, and session monitoring.
 * @version 1.0.0
 */

import React, { createContext, useContext, useEffect, useCallback } from 'react';
import CryptoJS from 'crypto-js';

// Internal imports with security enhancements
import { AuthService } from '../services/auth.service';
import { 
  AuthState, 
  AuthContextType, 
  LoginCredentials, 
  SecurityValidationResult,
  AuthErrorType,
  AuthenticationError,
  MfaVerificationOptions
} from '../types/auth.types';

// Security constants
const SESSION_CHECK_INTERVAL = 60000; // 1 minute
const ACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const SECURITY_NAMESPACE = 'auth_context';

// Initialize AuthContext with comprehensive security features
const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Enhanced AuthProvider props interface with security configuration
 */
interface AuthProviderProps {
  children: React.ReactNode;
  securityConfig?: {
    sessionTimeout?: number;
    mfaRequired?: boolean;
    ipValidation?: boolean;
    deviceFingerprinting?: boolean;
  };
}

/**
 * Enhanced Authentication Provider Component
 * Implements comprehensive security features and session management
 */
export class AuthProvider extends React.Component<AuthProviderProps, AuthState> {
  private sessionCheckInterval: NodeJS.Timeout | null = null;
  private lastActivity: Date | null = null;
  private readonly authService: AuthService;
  private readonly securityConfig: Required<NonNullable<AuthProviderProps['securityConfig']>>;

  constructor(props: AuthProviderProps) {
    super(props);

    // Initialize state with security context
    this.state = {
      isAuthenticated: false,
      user: null,
      loading: true,
      error: null,
      isTokenRefreshing: false,
      isMfaRequired: false,
      sessionTimeout: props.securityConfig?.sessionTimeout || ACTIVITY_TIMEOUT,
      lastActivity: null,
      securityContext: {}
    };

    // Initialize security configuration
    this.securityConfig = {
      sessionTimeout: ACTIVITY_TIMEOUT,
      mfaRequired: true,
      ipValidation: true,
      deviceFingerprinting: true,
      ...props.securityConfig
    };

    this.authService = new AuthService();

    // Bind security-enhanced methods
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.validateSession = this.validateSession.bind(this);
    this.handleActivityTimeout = this.handleActivityTimeout.bind(this);
  }

  /**
   * Initializes security monitoring and session validation
   */
  componentDidMount(): void {
    this.initializeSecurityMonitoring();
    this.validateInitialSession();
  }

  /**
   * Cleans up security monitoring on unmount
   */
  componentWillUnmount(): void {
    this.clearSecurityMonitoring();
  }

  /**
   * Initializes security monitoring and session checks
   * @private
   */
  private initializeSecurityMonitoring(): void {
    // Set up session validation interval
    this.sessionCheckInterval = setInterval(
      this.validateSession,
      SESSION_CHECK_INTERVAL
    );

    // Set up activity monitoring
    document.addEventListener('mousemove', this.updateLastActivity);
    document.addEventListener('keypress', this.updateLastActivity);
  }

  /**
   * Clears security monitoring intervals and listeners
   * @private
   */
  private clearSecurityMonitoring(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }
    document.removeEventListener('mousemove', this.updateLastActivity);
    document.removeEventListener('keypress', this.updateLastActivity);
  }

  /**
   * Updates last activity timestamp
   * @private
   */
  private updateLastActivity = (): void => {
    this.lastActivity = new Date();
    this.setState({ lastActivity: this.lastActivity });
  };

  /**
   * Handles session timeout
   * @private
   */
  private handleActivityTimeout(): void {
    this.logout({ reason: 'Session timeout' });
  }

  /**
   * Validates initial session on component mount
   * @private
   */
  private async validateInitialSession(): Promise<void> {
    try {
      const validationResult = await this.authService.validateSession();
      if (!validationResult.isValid) {
        await this.logout({ reason: validationResult.reason });
      }
      this.setState({ loading: false });
    } catch (error) {
      this.setState({ loading: false, error: 'Session validation failed' });
    }
  }

  /**
   * Secure login implementation with MFA and security checks
   * @param credentials - Login credentials with security metadata
   */
  public async login(credentials: LoginCredentials): Promise<void> {
    try {
      this.setState({ loading: true, error: null });

      // Add security metadata
      const secureCredentials = {
        ...credentials,
        deviceId: this.generateDeviceFingerprint(),
        ipAddress: await this.getClientIp()
      };

      // Perform login with enhanced security
      const authResponse = await this.authService.login(secureCredentials);

      // Validate MFA if required
      if (this.securityConfig.mfaRequired && !credentials.mfaToken) {
        this.setState({ isMfaRequired: true });
        return;
      }

      // Update security context
      this.setState({
        isAuthenticated: true,
        user: authResponse.user,
        loading: false,
        isMfaRequired: false,
        securityContext: {
          lastLogin: new Date(),
          deviceId: secureCredentials.deviceId,
          ipAddress: secureCredentials.ipAddress
        }
      });

      this.initializeSecurityMonitoring();

    } catch (error) {
      this.handleAuthError(error);
    }
  }

  /**
   * Secure logout implementation with session cleanup
   * @param options - Logout options
   */
  public async logout(options?: { everywhere?: boolean; reason?: string }): Promise<void> {
    try {
      this.setState({ loading: true });

      // Perform secure logout
      await this.authService.logout(options);

      // Clear security context
      this.clearSecurityMonitoring();

      // Reset state securely
      this.setState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null,
        isMfaRequired: false,
        lastActivity: null,
        securityContext: {}
      });

    } catch (error) {
      this.handleAuthError(error);
    }
  }

  /**
   * Validates current session with security checks
   * @returns Promise resolving to validation result
   */
  public async validateSession(): Promise<SecurityValidationResult> {
    try {
      // Check activity timeout
      if (this.lastActivity && 
          Date.now() - this.lastActivity.getTime() > this.state.sessionTimeout) {
        await this.handleActivityTimeout();
        return { isValid: false, reason: 'Session timeout', timestamp: new Date() };
      }

      // Validate session security
      const validationResult = await this.authService.validateSession();
      
      if (!validationResult.isValid) {
        await this.logout({ reason: validationResult.reason });
      }

      return validationResult;

    } catch (error) {
      this.handleAuthError(error);
      return { isValid: false, reason: 'Validation failed', timestamp: new Date() };
    }
  }

  /**
   * Generates secure device fingerprint
   * @private
   */
  private generateDeviceFingerprint(): string {
    const userAgent = navigator.userAgent;
    const screenPrint = `${screen.width}x${screen.height}x${screen.colorDepth}`;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return CryptoJS.SHA256(
      `${userAgent}|${screenPrint}|${timeZone}|${navigator.language}`
    ).toString();
  }

  /**
   * Retrieves client IP address securely
   * @private
   */
  private async getClientIp(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get client IP:', error);
      return 'unknown';
    }
  }

  /**
   * Handles authentication errors securely
   * @private
   */
  private handleAuthError(error: any): void {
    const authError = error instanceof AuthenticationError
      ? error
      : new AuthenticationError(
          AuthErrorType.NETWORK_ERROR,
          'Authentication failed'
        );

    this.setState({
      loading: false,
      error: authError.message,
      securityContext: {
        ...this.state.securityContext,
        lastError: {
          type: authError.type,
          timestamp: new Date()
        }
      }
    });
  }

  render() {
    const contextValue: AuthContextType = {
      state: this.state,
      login: this.login,
      logout: this.logout,
      refreshToken: this.authService.refreshToken,
      validateSession: this.validateSession,
      verifyMfa: this.authService.verifyMfa,
      revokeSession: async (sessionId?: string) => {
        await this.logout({ everywhere: true });
      },
      changePassword: async () => {
        throw new Error('Not implemented');
      },
      getUserPermissions: async () => {
        return this.state.user?.permissions || [];
      },
      hasFeatureAccess: (feature: string) => {
        return this.state.user?.featureFlags?.[feature] || false;
      },
      validateSecurityContext: this.validateSession,
      updateSessionOptions: (options) => {
        this.setState({ sessionTimeout: options.timeoutMinutes * 60 * 1000 });
      }
    };

    return (
      <AuthContext.Provider value={contextValue}>
        {this.props.children}
      </AuthContext.Provider>
    );
  }
}

/**
 * Custom hook for accessing auth context with security validation
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;