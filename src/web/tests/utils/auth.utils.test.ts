// @package jest v29.0.0
// @package jwt-decode v3.1.2
// @package crypto-js v4.1.1

import { describe, beforeEach, afterEach, beforeAll, afterAll, it, expect, jest } from '@jest/globals';
import jwtDecode from 'jwt-decode';
import { AES, enc, SHA256 } from 'crypto-js';
import * as authUtils from '../../src/utils/auth.utils';
import { IUser } from '../../src/types/auth.types';
import { UserRole } from '../../src/core/users/interfaces/user.interface';

// Mock constants for testing
const MOCK_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsInJvbGUiOiJTWVNURU1fQURNSU4iLCJwZXJtaXNzaW9ucyI6WyJNQU5BR0VfVVNFUlMiXSwiZXhwIjoxNzI1MDM2ODAwfQ';
const MOCK_REFRESH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsInR5cGUiOiJyZWZyZXNoIiwiZXhwIjoxNzI1MTIzMjAwfQ';
const MOCK_EXPIRED_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsInJvbGUiOiJTWVNURU1fQURNSU4iLCJleHAiOjE1MTYyMzkwMjJ9';
const MOCK_MALFORMED_TOKEN = 'invalid.token.format';
const MOCK_TAMPERED_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsInJvbGUiOiJIQUNLRVIifQ';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock crypto functions
jest.mock('crypto-js', () => ({
  AES: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  },
  enc: {
    Utf8: 'utf8',
  },
  SHA256: jest.fn(),
}));

// Mock jwt-decode
jest.mock('jwt-decode');

describe('Authentication Utilities Tests', () => {
  beforeAll(() => {
    // Setup global test environment
    global.localStorage = mockLocalStorage;
    process.env.REACT_APP_TOKEN_SALT = 'test-salt';
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockLocalStorage.clear();
  });

  afterEach(() => {
    // Cleanup after each test
    jest.resetAllMocks();
  });

  afterAll(() => {
    // Global cleanup
    delete process.env.REACT_APP_TOKEN_SALT;
  });

  describe('Token Storage Tests', () => {
    it('should securely store access token with encryption', () => {
      // Mock encryption functions
      const mockEncrypted = 'encrypted_token_data';
      (AES.encrypt as jest.Mock).mockReturnValue({ toString: () => mockEncrypted });
      (SHA256 as jest.Mock).mockReturnValue({ toString: () => 'token_hash' });

      authUtils.setStoredToken(MOCK_ACCESS_TOKEN);

      // Verify storage and encryption
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      expect(AES.encrypt).toHaveBeenCalled();
      expect(SHA256).toHaveBeenCalled();

      // Verify stored data structure
      const storedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(storedData).toHaveProperty('data');
      expect(storedData).toHaveProperty('metadata');
      expect(storedData.metadata).toHaveProperty('version');
      expect(storedData.metadata).toHaveProperty('timestamp');
      expect(storedData.metadata).toHaveProperty('hash');
    });

    it('should handle invalid token storage gracefully', () => {
      expect(() => authUtils.setStoredToken('')).toThrow('Invalid token provided');
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('should enforce rate limits on token operations', async () => {
      const operations = Array(10).fill(null).map(() => 
        authUtils.setStoredToken(MOCK_ACCESS_TOKEN)
      );
      
      await expect(Promise.all(operations)).rejects.toThrow();
    });
  });

  describe('Token Validation Tests', () => {
    it('should validate token structure and expiration', () => {
      (jwtDecode as jest.Mock).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000) - 60,
        sub: '123',
        role: UserRole.SYSTEM_ADMIN,
      });

      expect(authUtils.isTokenValid(MOCK_ACCESS_TOKEN)).toBe(true);
    });

    it('should detect expired tokens', () => {
      (jwtDecode as jest.Mock).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) - 3600,
        iat: Math.floor(Date.now() / 1000) - 7200,
        sub: '123',
        role: UserRole.SYSTEM_ADMIN,
      });

      expect(authUtils.isTokenValid(MOCK_EXPIRED_TOKEN)).toBe(false);
    });

    it('should reject malformed tokens', () => {
      (jwtDecode as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(authUtils.isTokenValid(MOCK_MALFORMED_TOKEN)).toBe(false);
    });

    it('should detect token tampering', () => {
      (jwtDecode as jest.Mock).mockReturnValue({
        role: 'HACKER',
      });

      expect(authUtils.isTokenValid(MOCK_TAMPERED_TOKEN)).toBe(false);
    });
  });

  describe('User Data Extraction Tests', () => {
    const mockDecodedToken = {
      sub: '123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.SYSTEM_ADMIN,
      permissions: ['MANAGE_USERS'],
      lastLogin: '2023-01-01T00:00:00Z',
      lastPasswordChange: '2023-01-01T00:00:00Z',
      isActive: true,
      isMfaEnabled: true,
      preferredLanguage: 'en',
      allowedIpAddresses: ['127.0.0.1'],
      exp: Math.floor(Date.now() / 1000) + 3600,
      lastLoginIp: '127.0.0.1',
      featureFlags: { beta: true },
    };

    it('should extract and validate user data from token', () => {
      (jwtDecode as jest.Mock).mockReturnValue(mockDecodedToken);

      const user = authUtils.getUserFromToken(MOCK_ACCESS_TOKEN);

      expect(user).toBeTruthy();
      expect(user?.id).toBe(mockDecodedToken.sub);
      expect(user?.role).toBe(mockDecodedToken.role);
      expect(user?.permissions).toEqual(mockDecodedToken.permissions);
      expect(user?.isActive).toBe(mockDecodedToken.isActive);
      expect(user?.isMfaEnabled).toBe(mockDecodedToken.isMfaEnabled);
    });

    it('should handle missing user data fields', () => {
      (jwtDecode as jest.Mock).mockReturnValue({
        sub: '123',
        role: UserRole.SYSTEM_ADMIN,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const user = authUtils.getUserFromToken(MOCK_ACCESS_TOKEN);

      expect(user).toBeTruthy();
      expect(user?.permissions).toEqual([]);
      expect(user?.allowedIpAddresses).toEqual([]);
      expect(user?.featureFlags).toEqual({});
    });

    it('should return null for invalid tokens', () => {
      expect(authUtils.getUserFromToken(MOCK_MALFORMED_TOKEN)).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    it('should complete token operations within SLA', async () => {
      const startTime = performance.now();
      
      authUtils.setStoredToken(MOCK_ACCESS_TOKEN);
      authUtils.getStoredToken();
      authUtils.isTokenValid(MOCK_ACCESS_TOKEN);
      authUtils.getUserFromToken(MOCK_ACCESS_TOKEN);
      
      const endTime = performance.now();
      const operationTime = endTime - startTime;
      
      expect(operationTime).toBeLessThan(100); // 100ms SLA
    });

    it('should handle concurrent token operations', async () => {
      const operations = Array(5).fill(null).map(() => ({
        store: () => authUtils.setStoredToken(MOCK_ACCESS_TOKEN),
        retrieve: () => authUtils.getStoredToken(),
        validate: () => authUtils.isTokenValid(MOCK_ACCESS_TOKEN),
      }));

      await expect(Promise.all(
        operations.map(async (op) => {
          await op.store();
          await op.retrieve();
          await op.validate();
        })
      )).resolves.not.toThrow();
    });
  });
});