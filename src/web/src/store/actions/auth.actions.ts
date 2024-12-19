/**
 * Authentication Action Creators
 * Implements secure Redux actions for authentication state management
 * with SSO integration, MFA support, and security monitoring.
 * @version 1.0.0
 */

// External imports
// @package @reduxjs/toolkit v1.9.5
import { createAsyncThunk } from '@reduxjs/toolkit';
// @package rate-limiter-flexible v2.4.1
import { RateLimiter } from 'rate-limiter-flexible';

// Internal imports
import AuthService from '../../services/auth.service';
import { 
  IUser, 
  LoginCredentials, 
  AuthResponse, 
  AuthErrorType, 
  AuthenticationError,
  MfaVerificationOptions,
  SecurityValidationResult,
  SessionOptions
} from '../../types/auth.types';

/**
 * Authentication action types
 */
export const AUTH_ACTIONS = {
  LOGIN: 'auth/login',
  LOGOUT: 'auth/logout',
  REFRESH_TOKEN: 'auth/refreshToken',
  VALIDATE_SESSION: 'auth/validateSession',
  VERIFY_MFA: 'auth/verifyMfa',
  UPDATE_SESSION: 'auth/updateSession'
} as const;

/**
 * Rate limiting configuration for security
 */
const RATE_LIMIT_CONFIG = {
  MAX_ATTEMPTS: 5,
  DURATION: 900, // 15 minutes
  BLOCK_DURATION: 3600 // 1 hour
} as const;

/**
 * Rate limiter instance for login attempts
 */
const loginRateLimiter = new RateLimiter({
  points: RATE_LIMIT_CONFIG.MAX_ATTEMPTS,
  duration: RATE_LIMIT_CONFIG.DURATION,
  blockDuration: RATE_LIMIT_CONFIG.BLOCK_DURATION
});

/**
 * Secure login action creator with rate limiting and MFA support
 */
export const loginAction = createAsyncThunk<AuthResponse, LoginCredentials>(
  AUTH_ACTIONS.LOGIN,
  async (credentials, { rejectWithValue }) => {
    try {
      // Check rate limiting
      const rateLimitKey = `login_${credentials.email}`;
      const rateLimitResult = await loginRateLimiter.get(rateLimitKey);
      
      if (rateLimitResult.remainingPoints === 0) {
        throw new AuthenticationError(
          AuthErrorType.ACCOUNT_LOCKED,
          'Too many login attempts. Please try again later.'
        );
      }

      // Attempt login
      const response = await AuthService.login(credentials);

      // Reset rate limiter on successful login
      await loginRateLimiter.delete(rateLimitKey);

      return response;
    } catch (error) {
      // Consume rate limit point on failure
      await loginRateLimiter.consume(credentials.email);

      if (error instanceof AuthenticationError) {
        return rejectWithValue(error);
      }
      throw error;
    }
  }
);

/**
 * Secure logout action creator with audit logging
 */
export const logoutAction = createAsyncThunk<void, { everywhere?: boolean }>(
  AUTH_ACTIONS.LOGOUT,
  async (options, { rejectWithValue }) => {
    try {
      await AuthService.logout(options);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return rejectWithValue(error);
      }
      throw error;
    }
  }
);

/**
 * Token refresh action creator with validation
 */
export const refreshTokenAction = createAsyncThunk<AuthResponse, void>(
  AUTH_ACTIONS.REFRESH_TOKEN,
  async (_, { rejectWithValue }) => {
    try {
      return await AuthService.refreshToken();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return rejectWithValue(error);
      }
      throw error;
    }
  }
);

/**
 * Session validation action creator with security checks
 */
export const validateSessionAction = createAsyncThunk<SecurityValidationResult, void>(
  AUTH_ACTIONS.VALIDATE_SESSION,
  async (_, { rejectWithValue }) => {
    try {
      return await AuthService.validateSession();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return rejectWithValue(error);
      }
      throw error;
    }
  }
);

/**
 * MFA verification action creator
 */
export const verifyMfaAction = createAsyncThunk<void, { token: string; options?: MfaVerificationOptions }>(
  AUTH_ACTIONS.VERIFY_MFA,
  async ({ token, options }, { rejectWithValue }) => {
    try {
      await AuthService.verifyMfa(token, options || { method: 'APP' });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return rejectWithValue(error);
      }
      throw error;
    }
  }
);

/**
 * Session update action creator for managing session options
 */
export const updateSessionAction = createAsyncThunk<void, Partial<SessionOptions>>(
  AUTH_ACTIONS.UPDATE_SESSION,
  async (options, { rejectWithValue }) => {
    try {
      // Implementation would update session settings
      // This would typically interact with AuthService
      console.log('Updating session options:', options);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return rejectWithValue(error);
      }
      throw error;
    }
  }
);

// Export action types for reducer consumption
export type AuthActionType = typeof AUTH_ACTIONS[keyof typeof AUTH_ACTIONS];