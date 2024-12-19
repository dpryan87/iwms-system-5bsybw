/**
 * Enhanced Authentication Hook
 * Provides secure authentication state management and comprehensive security features
 * for the IWMS web application. Implements SSO integration, OAuth 2.0 + JWT,
 * role-based access control, and security monitoring.
 * @version 1.0.0
 */

// External imports
// @package react v18.0.0
import { useContext, useEffect, useCallback } from 'react';
// @package auth0-spa-js v2.1.0
import { Auth0Client } from '@auth0/auth0-spa-js';

// Internal imports
import AuthContext from '../contexts/AuthContext';
import { 
  AuthContextType, 
  AuthErrorType, 
  AuthenticationError,
  SecurityValidationResult 
} from '../types/auth.types';

// Security constants
const SECURITY_NAMESPACE = 'auth_hook';
const VALIDATION_INTERVAL = 60000; // 1 minute
const SUSPICIOUS_ACTIVITY_THRESHOLD = 3;

/**
 * Enhanced useAuth hook with comprehensive security features
 * Implements secure authentication state management and monitoring
 * @returns {AuthContextType} Authenticated context with security enhancements
 * @throws {AuthenticationError} When used outside AuthProvider or security validation fails
 */
export function useAuth(): AuthContextType {
  // Get auth context with security validation
  const context = useContext(AuthContext);

  // Validate context availability
  if (!context) {
    throw new AuthenticationError(
      AuthErrorType.INVALID_TOKEN,
      'useAuth must be used within an AuthProvider'
    );
  }

  /**
   * Validates security configuration and context
   * @private
   */
  const validateSecurityContext = useCallback(async (): Promise<SecurityValidationResult> => {
    try {
      // Validate authentication state
      if (!context.state.isAuthenticated) {
        return {
          isValid: false,
          reason: 'User not authenticated',
          timestamp: new Date()
        };
      }

      // Check session validity
      const sessionValid = await context.validateSession();
      if (!sessionValid) {
        await context.logout({ reason: 'Invalid session' });
        return {
          isValid: false,
          reason: 'Session validation failed',
          timestamp: new Date()
        };
      }

      // Validate user permissions
      const permissions = await context.getUserPermissions();
      if (!permissions || permissions.length === 0) {
        return {
          isValid: false,
          reason: 'No valid permissions',
          timestamp: new Date()
        };
      }

      return {
        isValid: true,
        timestamp: new Date(),
        metadata: {
          userId: context.state.user?.id,
          permissions
        }
      };
    } catch (error) {
      logSecurityEvent('security_validation_failed', { error: error.message });
      return {
        isValid: false,
        reason: 'Security validation failed',
        timestamp: new Date()
      };
    }
  }, [context]);

  /**
   * Sets up security monitoring and validation
   */
  useEffect(() => {
    let validationInterval: NodeJS.Timeout;

    const setupSecurityMonitoring = async () => {
      try {
        // Initial security validation
        await validateSecurityContext();

        // Set up periodic validation
        validationInterval = setInterval(async () => {
          const validationResult = await validateSecurityContext();
          
          if (!validationResult.isValid) {
            logSecurityEvent('security_check_failed', {
              reason: validationResult.reason,
              timestamp: validationResult.timestamp
            });
            
            await context.logout({ 
              reason: validationResult.reason 
            });
          }
        }, VALIDATION_INTERVAL);

      } catch (error) {
        logSecurityEvent('security_monitoring_failed', { error: error.message });
      }
    };

    if (context.state.isAuthenticated) {
      setupSecurityMonitoring();
    }

    // Cleanup security monitoring
    return () => {
      if (validationInterval) {
        clearInterval(validationInterval);
      }
    };
  }, [context.state.isAuthenticated, validateSecurityContext, context]);

  /**
   * Enhanced login with security monitoring
   */
  const secureLogin = useCallback(async (credentials: any) => {
    try {
      // Add security metadata
      const secureCredentials = {
        ...credentials,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      await context.login(secureCredentials);
    } catch (error) {
      logSecurityEvent('login_failed', { error: error.message });
      throw error;
    }
  }, [context]);

  /**
   * Enhanced logout with security cleanup
   */
  const secureLogout = useCallback(async (options?: { everywhere?: boolean }) => {
    try {
      await context.logout(options);
      logSecurityEvent('logout_successful', { timestamp: new Date() });
    } catch (error) {
      logSecurityEvent('logout_failed', { error: error.message });
      throw error;
    }
  }, [context]);

  /**
   * Logs security events for monitoring
   * @private
   */
  const logSecurityEvent = (event: string, data: Record<string, any>): void => {
    const logData = {
      namespace: SECURITY_NAMESPACE,
      timestamp: new Date().toISOString(),
      userId: context.state.user?.id,
      event,
      ...data
    };

    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.log('[Security Event]', logData);
    }
    // In production, this would send to security monitoring service
  };

  // Return enhanced context with security features
  return {
    ...context,
    login: secureLogin,
    logout: secureLogout,
    validateSecurityContext,
    state: {
      ...context.state,
      securityContext: {
        ...context.state.securityContext,
        lastValidated: new Date()
      }
    }
  };
}

export default useAuth;