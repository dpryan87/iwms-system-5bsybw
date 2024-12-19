/**
 * Authentication Reducer
 * Implements secure state management for authentication with enhanced security features,
 * MFA support, and comprehensive session management.
 * @version 1.0.0
 */

// @package @reduxjs/toolkit v1.9.5
import { createSlice } from '@reduxjs/toolkit';

// Internal imports
import { AuthState } from '../../types/auth.types';
import {
  loginAction,
  logoutAction,
  refreshTokenAction,
  validateSessionAction,
  verifyMfaAction,
  updateSessionAction
} from '../actions/auth.actions';

/**
 * Initial authentication state with security context
 */
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
  isMfaRequired: false,
  mfaVerified: false,
  securityContext: {
    lastActivity: null,
    failedAttempts: 0,
    deviceFingerprint: null,
    securityEvents: []
  },
  sessionTimeout: null
};

/**
 * Enhanced authentication slice with comprehensive security features
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Updates security context with new events and monitoring data
     */
    updateSecurityContext: (state, action) => {
      state.securityContext = {
        ...state.securityContext,
        ...action.payload,
        lastActivity: new Date().toISOString()
      };
    },

    /**
     * Resets failed login attempts counter
     */
    resetFailedAttempts: (state) => {
      state.securityContext.failedAttempts = 0;
    },

    /**
     * Updates session timeout settings
     */
    setSessionTimeout: (state, action) => {
      state.sessionTimeout = action.payload;
    },

    /**
     * Clears authentication state and security context
     */
    clearAuthState: (state) => {
      return { ...initialState };
    }
  },
  extraReducers: (builder) => {
    // Login action handlers
    builder
      .addCase(loginAction.pending, (state) => {
        state.loading = true;
        state.error = null;
        // Track login attempt
        state.securityContext.failedAttempts += 1;
      })
      .addCase(loginAction.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.isMfaRequired = action.payload.requiresMfa;
        state.error = null;
        // Reset security context on successful login
        state.securityContext = {
          ...state.securityContext,
          failedAttempts: 0,
          lastActivity: new Date().toISOString(),
          deviceFingerprint: action.payload.sessionMetadata?.deviceId,
          securityEvents: [
            ...state.securityContext.securityEvents,
            {
              type: 'LOGIN_SUCCESS',
              timestamp: new Date().toISOString(),
              metadata: action.payload.sessionMetadata
            }
          ]
        };
      })
      .addCase(loginAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Authentication failed';
        // Track failed attempt and implement rate limiting
        state.securityContext.securityEvents.push({
          type: 'LOGIN_FAILURE',
          timestamp: new Date().toISOString(),
          reason: action.error.message
        });
      });

    // MFA verification handlers
    builder
      .addCase(verifyMfaAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyMfaAction.fulfilled, (state) => {
        state.loading = false;
        state.mfaVerified = true;
        state.isMfaRequired = false;
        // Log successful MFA verification
        state.securityContext.securityEvents.push({
          type: 'MFA_VERIFIED',
          timestamp: new Date().toISOString()
        });
      })
      .addCase(verifyMfaAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'MFA verification failed';
        // Track failed MFA attempt
        state.securityContext.securityEvents.push({
          type: 'MFA_FAILURE',
          timestamp: new Date().toISOString(),
          reason: action.error.message
        });
      });

    // Logout handler
    builder
      .addCase(logoutAction.fulfilled, (state) => {
        // Log logout event before clearing state
        const logoutEvent = {
          type: 'LOGOUT',
          timestamp: new Date().toISOString(),
          userId: state.user?.id
        };
        return {
          ...initialState,
          securityContext: {
            ...initialState.securityContext,
            securityEvents: [logoutEvent]
          }
        };
      });

    // Token refresh handlers
    builder
      .addCase(refreshTokenAction.pending, (state) => {
        state.loading = true;
      })
      .addCase(refreshTokenAction.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.sessionTimeout = action.payload.expiresIn;
        // Log token refresh
        state.securityContext.securityEvents.push({
          type: 'TOKEN_REFRESHED',
          timestamp: new Date().toISOString()
        });
      })
      .addCase(refreshTokenAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        // Force logout on token refresh failure
        return {
          ...initialState,
          error: 'Session expired. Please login again.'
        };
      });

    // Session validation handlers
    builder
      .addCase(validateSessionAction.fulfilled, (state, action) => {
        if (!action.payload.isValid) {
          // Log invalid session and clear state
          const invalidSessionEvent = {
            type: 'SESSION_INVALID',
            timestamp: new Date().toISOString(),
            reason: action.payload.reason
          };
          return {
            ...initialState,
            securityContext: {
              ...initialState.securityContext,
              securityEvents: [invalidSessionEvent]
            }
          };
        }
        // Update last activity
        state.securityContext.lastActivity = new Date().toISOString();
      })
      .addCase(validateSessionAction.rejected, (state) => {
        // Log validation failure and clear state
        return {
          ...initialState,
          error: 'Session validation failed'
        };
      });

    // Session update handlers
    builder
      .addCase(updateSessionAction.fulfilled, (state, action) => {
        state.sessionTimeout = action.payload?.timeoutMinutes * 60 * 1000;
        // Log session update
        state.securityContext.securityEvents.push({
          type: 'SESSION_UPDATED',
          timestamp: new Date().toISOString(),
          metadata: action.payload
        });
      });
  }
});

// Export actions and reducer
export const {
  updateSecurityContext,
  resetFailedAttempts,
  setSessionTimeout,
  clearAuthState
} = authSlice.actions;

export const authReducer = authSlice.reducer;