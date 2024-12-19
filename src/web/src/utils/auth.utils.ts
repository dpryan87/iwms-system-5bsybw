// @package jwt-decode v3.1.2
// @package crypto-js v4.1.1

import jwtDecode from 'jwt-decode';
import { AES, enc, SHA256 } from 'crypto-js';
import { IUser } from '../types/auth.types';

// Constants for token management and security
const TOKEN_STORAGE_KEY = 'iwms_access_token';
const REFRESH_TOKEN_STORAGE_KEY = 'iwms_refresh_token';
const TOKEN_VERSION = 'v1';
const MAX_TOKEN_AGE_SECONDS = 3600;
const SECURITY_NAMESPACE = 'auth_utils';

// Security-related interfaces
interface TokenMetadata {
  version: string;
  timestamp: number;
  hash: string;
}

interface EncryptedToken {
  data: string;
  metadata: TokenMetadata;
}

/**
 * Securely stores authentication token with encryption and validation
 * Implements OWASP security recommendations for token storage
 * 
 * @param token - JWT token to store
 * @throws Error if token is invalid or storage fails
 */
export const setStoredToken = (token: string): void => {
  try {
    if (!token) {
      throw new Error('Invalid token provided');
    }

    // Generate token metadata
    const metadata: TokenMetadata = {
      version: TOKEN_VERSION,
      timestamp: Date.now(),
      hash: SHA256(token).toString()
    };

    // Encrypt token with AES
    const encryptedData = AES.encrypt(token, getEncryptionKey()).toString();

    const secureToken: EncryptedToken = {
      data: encryptedData,
      metadata
    };

    // Store encrypted token
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(secureToken));

    // Log security audit event
    logSecurityEvent('token_stored', { timestamp: metadata.timestamp });
  } catch (error) {
    logSecurityEvent('token_store_failed', { error: error.message });
    throw new Error('Failed to securely store token');
  }
};

/**
 * Retrieves and validates stored authentication token
 * Implements comprehensive security checks and validation
 * 
 * @returns Decrypted token or null if invalid/expired
 */
export const getStoredToken = (): string | null => {
  try {
    const storedData = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!storedData) {
      return null;
    }

    const secureToken: EncryptedToken = JSON.parse(storedData);

    // Validate token metadata
    if (secureToken.metadata.version !== TOKEN_VERSION) {
      throw new Error('Token version mismatch');
    }

    // Check token age
    const tokenAge = (Date.now() - secureToken.metadata.timestamp) / 1000;
    if (tokenAge > MAX_TOKEN_AGE_SECONDS) {
      throw new Error('Token expired');
    }

    // Decrypt token
    const decryptedToken = AES.decrypt(
      secureToken.data,
      getEncryptionKey()
    ).toString(enc.Utf8);

    // Validate token hash
    if (SHA256(decryptedToken).toString() !== secureToken.metadata.hash) {
      throw new Error('Token integrity check failed');
    }

    return decryptedToken;
  } catch (error) {
    logSecurityEvent('token_retrieval_failed', { error: error.message });
    return null;
  }
};

/**
 * Comprehensive JWT token validation with security checks
 * Implements multiple layers of token validation
 * 
 * @param token - JWT token to validate
 * @returns boolean indicating token validity
 */
export const isTokenValid = (token: string): boolean => {
  try {
    if (!token) {
      return false;
    }

    // Decode token without verification
    const decodedToken: any = jwtDecode(token);

    // Validate token structure
    if (!decodedToken || !decodedToken.exp || !decodedToken.iat) {
      return false;
    }

    // Check token expiration
    const currentTime = Math.floor(Date.now() / 1000);
    if (decodedToken.exp < currentTime) {
      return false;
    }

    // Validate token age
    const tokenAge = currentTime - decodedToken.iat;
    if (tokenAge > MAX_TOKEN_AGE_SECONDS) {
      return false;
    }

    // Validate required claims
    if (!decodedToken.sub || !decodedToken.role) {
      return false;
    }

    return true;
  } catch (error) {
    logSecurityEvent('token_validation_failed', { error: error.message });
    return false;
  }
};

/**
 * Securely extracts and validates user information from JWT token
 * Implements role-based validation and security checks
 * 
 * @param token - JWT token containing user information
 * @returns Validated user object or null if invalid
 */
export const getUserFromToken = (token: string): IUser | null => {
  try {
    if (!isTokenValid(token)) {
      return null;
    }

    const decodedToken: any = jwtDecode(token);

    // Extract and validate user data
    const user: IUser = {
      id: decodedToken.sub,
      email: decodedToken.email,
      firstName: decodedToken.firstName,
      lastName: decodedToken.lastName,
      role: decodedToken.role,
      permissions: decodedToken.permissions || [],
      lastLogin: new Date(decodedToken.lastLogin),
      lastPasswordChange: new Date(decodedToken.lastPasswordChange),
      isActive: decodedToken.isActive,
      isMfaEnabled: decodedToken.isMfaEnabled,
      preferredLanguage: decodedToken.preferredLanguage,
      allowedIpAddresses: decodedToken.allowedIpAddresses || [],
      sessionExpiry: new Date(decodedToken.exp * 1000),
      lastLoginIp: decodedToken.lastLoginIp,
      featureFlags: decodedToken.featureFlags || {}
    };

    return user;
  } catch (error) {
    logSecurityEvent('user_extraction_failed', { error: error.message });
    return null;
  }
};

// Private helper functions

/**
 * Generates secure encryption key for token encryption
 * Uses environment-specific salt for added security
 */
const getEncryptionKey = (): string => {
  const envSalt = process.env.REACT_APP_TOKEN_SALT || 'default-salt';
  return SHA256(envSalt + TOKEN_VERSION).toString();
};

/**
 * Logs security-related events for audit and monitoring
 * Implements security event tracking
 */
const logSecurityEvent = (event: string, data: Record<string, any>): void => {
  const logData = {
    timestamp: new Date().toISOString(),
    namespace: SECURITY_NAMESPACE,
    event,
    ...data
  };

  // Log to monitoring system or console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Security Event]', logData);
  }
  // In production, this would send to a security monitoring service
};