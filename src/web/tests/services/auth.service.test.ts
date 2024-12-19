/**
 * Authentication Service Test Suite
 * Comprehensive tests for authentication flows, security features, and token management
 * @version 1.0.0
 */

// External imports
// @version jest v29.0.0
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
// @version axios-mock-adapter v1.21.0
import MockAdapter from 'axios-mock-adapter';
// @version @auth0/auth0-spa-js v2.1.0
import { Auth0Client } from '@auth0/auth0-spa-js';
// @version crypto-js v4.1.1
import { AES, enc } from 'crypto-js';

// Internal imports
import AuthService from '../../src/services/auth.service';
import { Types } from '../../src/types/auth.types';
import axiosInstance from '../../src/api/axios.config';

// Mock data
const mockValidCredentials: Types.LoginCredentials = {
  email: 'test@example.com',
  password: 'SecurePass123!',
  mfaToken: '123456',
  deviceId: 'test-device-001',
  ipAddress: '127.0.0.1',
  userAgent: 'jest-test-suite'
};

const mockAuthResponse: Types.AuthResponse = {
  accessToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
  refreshToken: 'refresh.token.mock',
  expiresIn: 3600,
  user: {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'FACILITY_MANAGER',
    permissions: ['read:spaces', 'manage:resources'],
    lastLogin: new Date(),
    lastPasswordChange: new Date(),
    isActive: true,
    isMfaEnabled: true,
    preferredLanguage: 'en',
    allowedIpAddresses: ['127.0.0.1'],
    sessionExpiry: new Date(Date.now() + 3600000),
    lastLoginIp: '127.0.0.1',
    featureFlags: { beta: true }
  },
  tokenType: 'Bearer',
  requiresMfa: false,
  grantedPermissions: ['read:spaces', 'manage:resources'],
  sessionMetadata: {
    deviceId: 'test-device-001',
    loginTimestamp: new Date().toISOString(),
    ipAddress: '127.0.0.1'
  }
};

const mockSecurityEvent: Types.SecurityEvent = {
  type: 'AUTH_ATTEMPT',
  userId: 'user-123',
  timestamp: new Date().toISOString(),
  success: true,
  metadata: {
    ipAddress: '127.0.0.1',
    deviceId: 'test-device-001',
    userAgent: 'jest-test-suite'
  }
};

describe('AuthService - Core Authentication', () => {
  let authService: AuthService;
  let mockAxios: MockAdapter;
  let mockAuth0Client: jest.Mocked<Auth0Client>;

  beforeEach(() => {
    // Initialize mocks
    mockAxios = new MockAdapter(axiosInstance);
    mockAuth0Client = {
      loginWithCredentials: jest.fn(),
      getTokenSilently: jest.fn(),
      logout: jest.fn()
    } as unknown as jest.Mocked<Auth0Client>;

    // Initialize service
    authService = new AuthService();
    (authService as any).auth0Client = mockAuth0Client;

    // Clear storage
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    mockAxios.reset();
    jest.clearAllMocks();
  });

  describe('login()', () => {
    test('should successfully authenticate with valid credentials and MFA', async () => {
      // Mock Auth0 response
      mockAuth0Client.loginWithCredentials.mockResolvedValueOnce({
        ...mockAuthResponse,
        requiresMfa: true
      });

      // Mock MFA verification
      mockAxios.onPost('/auth/mfa/verify').reply(200, { verified: true });

      const result = await authService.login(mockValidCredentials);

      expect(result).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: expect.objectContaining({
          id: expect.any(String),
          email: expect.any(String)
        })
      });

      expect(mockAuth0Client.loginWithCredentials).toHaveBeenCalledWith({
        username: mockValidCredentials.email,
        password: mockValidCredentials.password
      });
    });

    test('should handle failed login attempts and enforce rate limiting', async () => {
      mockAuth0Client.loginWithCredentials.mockRejectedValue(new Error('Invalid credentials'));

      const attempts = 4;
      const loginPromises = Array(attempts).fill(null).map(() => 
        authService.login({ ...mockValidCredentials, password: 'wrong' })
      );

      await Promise.all(loginPromises.map(p => expect(p).rejects.toThrow()));

      const finalAttempt = authService.login(mockValidCredentials);
      await expect(finalAttempt).rejects.toThrow('Account temporarily locked');
    });
  });

  describe('validateSession()', () => {
    test('should validate active session with security checks', async () => {
      // Setup valid token in storage
      localStorage.setItem('iwms_access_token', mockAuthResponse.accessToken);

      // Mock security check
      mockAxios.onPost('/auth/security/check').reply(200, { suspicious: false });

      const result = await authService.validateSession();

      expect(result).toEqual({
        isValid: true,
        timestamp: expect.any(Date),
        metadata: expect.objectContaining({
          userId: expect.any(String),
          lastValidated: expect.any(String)
        })
      });
    });

    test('should invalidate expired or tampered tokens', async () => {
      // Setup expired token
      const expiredToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...';
      localStorage.setItem('iwms_access_token', expiredToken);

      const result = await authService.validateSession();

      expect(result).toEqual({
        isValid: false,
        reason: 'Invalid or expired token',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('verifyMfa()', () => {
    test('should verify valid MFA token', async () => {
      mockAxios.onPost('/auth/mfa/verify').reply(200, { verified: true });

      await expect(authService.verifyMfa('123456', {
        method: 'APP',
        deviceTrust: true
      })).resolves.not.toThrow();
    });

    test('should reject invalid MFA token', async () => {
      mockAxios.onPost('/auth/mfa/verify').reply(400, { verified: false });

      await expect(authService.verifyMfa('000000', {
        method: 'APP',
        deviceTrust: true
      })).rejects.toThrow('Invalid MFA token');
    });
  });

  describe('logout()', () => {
    test('should perform complete logout with session cleanup', async () => {
      // Setup active session
      localStorage.setItem('iwms_access_token', mockAuthResponse.accessToken);
      localStorage.setItem('iwms_refresh_token', mockAuthResponse.refreshToken);

      mockAxios.onPost('/auth/logout/all').reply(200);
      mockAuth0Client.logout.mockResolvedValueOnce();

      await authService.logout({ everywhere: true });

      expect(localStorage.getItem('iwms_access_token')).toBeNull();
      expect(localStorage.getItem('iwms_refresh_token')).toBeNull();
      expect(mockAuth0Client.logout).toHaveBeenCalled();
    });
  });

  describe('Security Monitoring', () => {
    test('should detect suspicious activity', async () => {
      mockAxios.onPost('/auth/security/check').reply(200, { suspicious: true });

      const result = await authService.validateSession();

      expect(result).toEqual({
        isValid: false,
        reason: 'Suspicious activity detected',
        timestamp: expect.any(Date),
        metadata: expect.objectContaining({
          suspiciousActivity: true
        })
      });
    });

    test('should handle security events properly', async () => {
      const securityEventSpy = jest.spyOn(console, 'warn');
      
      // Trigger security event
      mockAuth0Client.loginWithCredentials.mockRejectedValue(new Error('Suspicious IP'));
      
      await expect(authService.login(mockValidCredentials)).rejects.toThrow();
      
      expect(securityEventSpy).toHaveBeenCalled();
    });
  });
});