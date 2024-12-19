/**
 * Authentication Reducer Test Suite
 * Comprehensive tests for authentication state management with security features
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { authReducer } from '../../src/store/reducers/auth.reducer';
import {
  loginAction,
  logoutAction,
  refreshTokenAction,
  validateSessionAction,
  verifyMfaAction,
  validateDeviceAction
} from '../../src/store/actions/auth.actions';
import {
  AuthState,
  IUser,
  SecurityContext,
  MfaStatus,
  DeviceInfo
} from '../../src/types/auth.types';

describe('Authentication Reducer', () => {
  // Mock user data for testing
  const mockUser: IUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'FACILITY_MANAGER',
    permissions: ['read:floorplans', 'edit:spaces'],
    lastLogin: new Date('2023-01-01T00:00:00Z'),
    lastPasswordChange: new Date('2023-01-01T00:00:00Z'),
    isActive: true,
    isMfaEnabled: true,
    preferredLanguage: 'en',
    allowedIpAddresses: ['127.0.0.1'],
    sessionExpiry: new Date('2024-01-01T00:00:00Z'),
    lastLoginIp: '127.0.0.1',
    featureFlags: { beta: true }
  };

  // Mock security context
  const mockSecurityContext: SecurityContext = {
    lastActivity: new Date('2023-01-01T00:00:00Z').toISOString(),
    failedAttempts: 0,
    deviceFingerprint: 'mock-device-hash',
    securityEvents: []
  };

  // Initial state for each test
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

  beforeEach(() => {
    // Reset any mocks or test state
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should return the initial state', () => {
      expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });
  });

  describe('Login Flow', () => {
    it('should handle login pending state', () => {
      const nextState = authReducer(initialState, loginAction.pending);
      expect(nextState.loading).toBe(true);
      expect(nextState.error).toBeNull();
      expect(nextState.securityContext.failedAttempts).toBe(1);
    });

    it('should handle successful login with MFA required', () => {
      const action = {
        type: loginAction.fulfilled.type,
        payload: {
          user: mockUser,
          requiresMfa: true,
          sessionMetadata: {
            deviceId: 'test-device'
          }
        }
      };

      const nextState = authReducer(initialState, action);
      expect(nextState.isAuthenticated).toBe(true);
      expect(nextState.user).toEqual(mockUser);
      expect(nextState.isMfaRequired).toBe(true);
      expect(nextState.securityContext.failedAttempts).toBe(0);
      expect(nextState.securityContext.deviceFingerprint).toBe('test-device');
      expect(nextState.securityContext.securityEvents[0].type).toBe('LOGIN_SUCCESS');
    });

    it('should handle login failure with rate limiting', () => {
      const action = {
        type: loginAction.rejected.type,
        error: { message: 'Invalid credentials' }
      };

      const nextState = authReducer(initialState, action);
      expect(nextState.loading).toBe(false);
      expect(nextState.error).toBe('Invalid credentials');
      expect(nextState.securityContext.securityEvents[0].type).toBe('LOGIN_FAILURE');
    });
  });

  describe('MFA Verification', () => {
    it('should handle MFA verification pending state', () => {
      const nextState = authReducer(initialState, verifyMfaAction.pending);
      expect(nextState.loading).toBe(true);
      expect(nextState.error).toBeNull();
    });

    it('should handle successful MFA verification', () => {
      const nextState = authReducer(
        { ...initialState, isMfaRequired: true },
        verifyMfaAction.fulfilled
      );
      expect(nextState.mfaVerified).toBe(true);
      expect(nextState.isMfaRequired).toBe(false);
      expect(nextState.securityContext.securityEvents[0].type).toBe('MFA_VERIFIED');
    });

    it('should handle MFA verification failure', () => {
      const action = {
        type: verifyMfaAction.rejected.type,
        error: { message: 'Invalid MFA token' }
      };

      const nextState = authReducer(initialState, action);
      expect(nextState.error).toBe('Invalid MFA token');
      expect(nextState.securityContext.securityEvents[0].type).toBe('MFA_FAILURE');
    });
  });

  describe('Session Management', () => {
    it('should handle session validation success', () => {
      const action = {
        type: validateSessionAction.fulfilled.type,
        payload: { isValid: true }
      };

      const nextState = authReducer(initialState, action);
      expect(nextState.securityContext.lastActivity).toBeTruthy();
    });

    it('should handle invalid session', () => {
      const action = {
        type: validateSessionAction.fulfilled.type,
        payload: { isValid: false, reason: 'Session expired' }
      };

      const nextState = authReducer(initialState, action);
      expect(nextState.isAuthenticated).toBe(false);
      expect(nextState.securityContext.securityEvents[0].type).toBe('SESSION_INVALID');
    });

    it('should handle session timeout update', () => {
      const action = {
        type: refreshTokenAction.fulfilled.type,
        payload: { user: mockUser, expiresIn: 3600 }
      };

      const nextState = authReducer(initialState, action);
      expect(nextState.sessionTimeout).toBe(3600);
      expect(nextState.securityContext.securityEvents[0].type).toBe('TOKEN_REFRESHED');
    });
  });

  describe('Logout Flow', () => {
    it('should handle logout with security event logging', () => {
      const initialStateWithUser = {
        ...initialState,
        isAuthenticated: true,
        user: mockUser
      };

      const nextState = authReducer(initialStateWithUser, logoutAction.fulfilled);
      expect(nextState.isAuthenticated).toBe(false);
      expect(nextState.user).toBeNull();
      expect(nextState.securityContext.securityEvents[0].type).toBe('LOGOUT');
      expect(nextState.securityContext.securityEvents[0].userId).toBe(mockUser.id);
    });
  });

  describe('Security Features', () => {
    it('should track failed login attempts', () => {
      let state = initialState;
      for (let i = 0; i < 3; i++) {
        state = authReducer(state, loginAction.pending);
      }
      expect(state.securityContext.failedAttempts).toBe(3);
    });

    it('should reset security context on successful login', () => {
      const stateWithFailedAttempts = {
        ...initialState,
        securityContext: {
          ...initialState.securityContext,
          failedAttempts: 3
        }
      };

      const action = {
        type: loginAction.fulfilled.type,
        payload: {
          user: mockUser,
          requiresMfa: false,
          sessionMetadata: { deviceId: 'test-device' }
        }
      };

      const nextState = authReducer(stateWithFailedAttempts, action);
      expect(nextState.securityContext.failedAttempts).toBe(0);
    });

    it('should handle token refresh failure with forced logout', () => {
      const action = {
        type: refreshTokenAction.rejected.type,
        error: { message: 'Token refresh failed' }
      };

      const nextState = authReducer(initialState, action);
      expect(nextState.isAuthenticated).toBe(false);
      expect(nextState.error).toBe('Session expired. Please login again.');
    });
  });
});