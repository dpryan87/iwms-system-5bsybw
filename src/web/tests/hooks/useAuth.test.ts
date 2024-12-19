/**
 * Test Suite for useAuth Hook
 * Validates authentication flows, security protocols, session management,
 * and role-based access control following OWASP security standards.
 * @version 1.0.0
 */

// External imports
// @package @testing-library/react-hooks v8.0.1
import { renderHook, act } from '@testing-library/react-hooks';
// @package @testing-library/react v14.0.0
import { waitFor } from '@testing-library/react';
// @package jest-mock-axios v4.7.2
import mockAxios from 'jest-mock-axios';

// Internal imports
import { useAuth } from '../../src/hooks/useAuth';
import { AuthContext } from '../../src/contexts/AuthContext';
import { 
  AuthErrorType, 
  AuthenticationError,
  SecurityValidationResult,
  UserRole
} from '../../src/types/auth.types';

// Test constants
const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: UserRole.FACILITY_MANAGER,
  permissions: ['read:spaces', 'write:spaces'],
  lastLogin: new Date(),
  lastPasswordChange: new Date(),
  isActive: true,
  isMfaEnabled: true,
  preferredLanguage: 'en',
  allowedIpAddresses: ['127.0.0.1'],
  sessionExpiry: new Date(Date.now() + 3600000),
  lastLoginIp: '127.0.0.1',
  featureFlags: { beta: true }
};

const TEST_CREDENTIALS = {
  email: 'test@example.com',
  password: 'Test123!@#',
  mfaToken: '123456',
  deviceId: 'test-device',
  ipAddress: '127.0.0.1'
};

/**
 * Sets up test environment with mocked security context
 */
const setupTestEnvironment = () => {
  // Mock Auth0 client
  const mockAuth0Client = {
    loginWithCredentials: jest.fn(),
    logout: jest.fn(),
    getTokenSilently: jest.fn()
  };

  // Mock security logging
  const mockLogSecurityEvent = jest.fn();

  // Mock rate limiter
  const mockRateLimiter = {
    checkLimit: jest.fn().mockResolvedValue({ allowed: true }),
    incrementAttempts: jest.fn()
  };

  // Create context wrapper
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider
      value={{
        state: {
          isAuthenticated: false,
          user: null,
          loading: false,
          error: null,
          isTokenRefreshing: false,
          isMfaRequired: false,
          sessionTimeout: 3600000,
          lastActivity: null,
          securityContext: {}
        },
        login: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        validateSession: jest.fn(),
        verifyMfa: jest.fn(),
        revokeSession: jest.fn(),
        changePassword: jest.fn(),
        getUserPermissions: jest.fn(),
        hasFeatureAccess: jest.fn(),
        validateSecurityContext: jest.fn(),
        updateSessionOptions: jest.fn()
      }}
    >
      {children}
    </AuthContext.Provider>
  );

  return {
    wrapper,
    mockAuth0Client,
    mockLogSecurityEvent,
    mockRateLimiter
  };
};

describe('Authentication Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.reset();
  });

  it('should handle SSO login successfully', async () => {
    const { wrapper } = setupTestEnvironment();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    expect(result.current.state.isAuthenticated).toBe(true);
    expect(result.current.state.user).toEqual(TEST_USER);
  });

  it('should validate MFA tokens correctly', async () => {
    const { wrapper } = setupTestEnvironment();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login({ ...TEST_CREDENTIALS, mfaToken: undefined });
    });

    expect(result.current.state.isMfaRequired).toBe(true);

    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    expect(result.current.state.isMfaRequired).toBe(false);
    expect(result.current.state.isAuthenticated).toBe(true);
  });

  it('should enforce rate limiting on login attempts', async () => {
    const { wrapper, mockRateLimiter } = setupTestEnvironment();
    const { result } = renderHook(() => useAuth(), { wrapper });

    mockRateLimiter.checkLimit.mockResolvedValueOnce({ allowed: false });

    await expect(result.current.login(TEST_CREDENTIALS)).rejects.toThrow(
      new AuthenticationError(
        AuthErrorType.SUSPICIOUS_ACTIVITY,
        'Too many login attempts'
      )
    );
  });

  it('should log security events properly', async () => {
    const { wrapper, mockLogSecurityEvent } = setupTestEnvironment();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      'login_successful',
      expect.objectContaining({
        userId: TEST_USER.id,
        timestamp: expect.any(String)
      })
    );
  });
});

describe('Session Management', () => {
  it('should validate session tokens securely', async () => {
    const { wrapper } = setupTestEnvironment();
    const { result } = renderHook(() => useAuth(), { wrapper });

    const validationResult: SecurityValidationResult = await result.current.validateSecurityContext();

    expect(validationResult.isValid).toBe(true);
    expect(validationResult.timestamp).toBeInstanceOf(Date);
  });

  it('should handle session timeouts correctly', async () => {
    const { wrapper } = setupTestEnvironment();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Simulate session timeout
    jest.advanceTimersByTime(3600000 + 1000);

    await waitFor(() => {
      expect(result.current.state.isAuthenticated).toBe(false);
    });
  });

  it('should enforce token encryption standards', async () => {
    const { wrapper } = setupTestEnvironment();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    expect(localStorage.getItem('iwms_access_token')).toMatch(/^[a-zA-Z0-9+/=]+$/);
  });

  it('should manage concurrent sessions properly', async () => {
    const { wrapper } = setupTestEnvironment();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
      await result.current.login(TEST_CREDENTIALS); // Second login
    });

    expect(result.current.state.securityContext.activeSessions).toBe(1);
  });
});

describe('Security Protocols', () => {
  it('should enforce OWASP security standards', async () => {
    const { wrapper } = setupTestEnvironment();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    // Verify secure headers
    expect(mockAxios.defaults.headers).toEqual(
      expect.objectContaining({
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      })
    );
  });

  it('should handle security violations correctly', async () => {
    const { wrapper } = setupTestEnvironment();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Simulate security violation
    const suspiciousIP = '1.2.3.4';
    await expect(
      result.current.login({ ...TEST_CREDENTIALS, ipAddress: suspiciousIP })
    ).rejects.toThrow(
      new AuthenticationError(
        AuthErrorType.SUSPICIOUS_ACTIVITY,
        'Suspicious IP address detected'
      )
    );
  });

  it('should implement proper RBAC checks', async () => {
    const { wrapper } = setupTestEnvironment();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    expect(result.current.state.user?.permissions).toContain('read:spaces');
    expect(result.current.hasFeatureAccess('beta')).toBe(true);
  });

  it('should maintain security audit logs', async () => {
    const { wrapper, mockLogSecurityEvent } = setupTestEnvironment();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
      await result.current.logout();
    });

    expect(mockLogSecurityEvent).toHaveBeenCalledTimes(2);
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      'logout_successful',
      expect.any(Object)
    );
  });
});