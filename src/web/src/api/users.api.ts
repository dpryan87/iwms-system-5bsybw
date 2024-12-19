/**
 * User Management API Client
 * Implements secure API client functions for user management operations
 * with enhanced security features, MFA support, and RBAC
 * @version 1.0.0
 */

// @package axios ^1.4.0
// @package axios-rate-limit ^1.3.0
import { AxiosResponse } from 'axios';
import rateLimit from 'axios-rate-limit';

// Internal imports
import axiosInstance from './axios.config';
import { IUser } from '../types/auth.types';
import { ApiResponse, PaginatedResponse, ApiErrorCode } from '../types/api.types';

// Rate limiting configuration - 100 requests per minute
const rateLimitedAxios = rateLimit(axiosInstance, {
  maxRequests: 100,
  perMilliseconds: 60000,
  maxRPS: 2
});

/**
 * Enhanced error handling for user management operations
 */
class UserManagementError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'UserManagementError';
  }
}

/**
 * Interface for user query parameters
 */
interface UserQueryParams {
  page?: number;
  pageSize?: number;
  role?: string;
  status?: string;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for user profile update
 */
interface UserProfileUpdate {
  firstName?: string;
  lastName?: string;
  email?: string;
  mfaToken?: string;
  preferredLanguage?: string;
  timezone?: string;
}

/**
 * Retrieves a user by their ID with enhanced security validation
 * @param userId - User identifier
 * @returns Promise resolving to user data with comprehensive error handling
 */
export async function getUserById(userId: string): Promise<ApiResponse<IUser>> {
  try {
    // Validate userId format
    if (!userId || typeof userId !== 'string') {
      throw new UserManagementError(
        ApiErrorCode.VALIDATION_ERROR,
        'Invalid user ID format'
      );
    }

    // Make secure API request with rate limiting
    const response = await rateLimitedAxios.get<ApiResponse<IUser>>(
      `/users/${userId}`,
      {
        headers: {
          'X-Request-ID': crypto.randomUUID(),
          'X-Request-Source': 'web-client'
        }
      }
    );

    return response.data;
  } catch (error) {
    handleUserApiError(error);
    throw error;
  }
}

/**
 * Retrieves a paginated list of users with enhanced filtering and security
 * @param params - Query parameters for filtering and pagination
 * @returns Promise resolving to paginated user list
 */
export async function getUsers(
  params: UserQueryParams = {}
): Promise<PaginatedResponse<IUser>> {
  try {
    // Validate pagination parameters
    const validatedParams = {
      page: Math.max(1, params.page || 1),
      pageSize: Math.min(100, Math.max(1, params.pageSize || 20)),
      ...params
    };

    // Make secure API request with rate limiting
    const response = await rateLimitedAxios.get<PaginatedResponse<IUser>>(
      '/users',
      {
        params: validatedParams,
        headers: {
          'X-Request-ID': crypto.randomUUID(),
          'Cache-Control': 'no-store'
        }
      }
    );

    return response.data;
  } catch (error) {
    handleUserApiError(error);
    throw error;
  }
}

/**
 * Updates user profile with enhanced security and MFA support
 * @param profileData - User profile update data
 * @returns Promise resolving to updated user data
 */
export async function updateUserProfile(
  profileData: UserProfileUpdate
): Promise<ApiResponse<IUser>> {
  try {
    // Validate profile data
    validateProfileData(profileData);

    // Prepare request with security headers
    const headers: Record<string, string> = {
      'X-Request-ID': crypto.randomUUID(),
      'Content-Type': 'application/json'
    };

    // Add MFA verification if token provided
    if (profileData.mfaToken) {
      headers['X-MFA-Token'] = profileData.mfaToken;
    }

    // Make secure API request with rate limiting
    const response = await rateLimitedAxios.put<ApiResponse<IUser>>(
      '/users/profile',
      profileData,
      { headers }
    );

    return response.data;
  } catch (error) {
    handleUserApiError(error);
    throw error;
  }
}

/**
 * Validates user profile update data
 * @param profileData - Profile data to validate
 * @throws UserManagementError if validation fails
 */
function validateProfileData(profileData: UserProfileUpdate): void {
  const errors: string[] = [];

  if (profileData.email && !isValidEmail(profileData.email)) {
    errors.push('Invalid email format');
  }

  if (profileData.firstName && profileData.firstName.length < 2) {
    errors.push('First name must be at least 2 characters');
  }

  if (profileData.lastName && profileData.lastName.length < 2) {
    errors.push('Last name must be at least 2 characters');
  }

  if (errors.length > 0) {
    throw new UserManagementError(
      ApiErrorCode.VALIDATION_ERROR,
      'Profile validation failed',
      { errors }
    );
  }
}

/**
 * Validates email format
 * @param email - Email to validate
 * @returns boolean indicating if email is valid
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Handles API errors with enhanced error mapping
 * @param error - Error to handle
 * @throws UserManagementError with appropriate error code
 */
function handleUserApiError(error: any): never {
  const baseMessage = 'User management operation failed';

  if (error.response) {
    const status = error.response.status;
    const errorData = error.response.data;

    switch (status) {
      case 400:
        throw new UserManagementError(
          ApiErrorCode.VALIDATION_ERROR,
          errorData.message || 'Invalid request data',
          errorData
        );
      case 401:
        throw new UserManagementError(
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          errorData
        );
      case 403:
        throw new UserManagementError(
          ApiErrorCode.FORBIDDEN,
          'Insufficient permissions',
          errorData
        );
      case 404:
        throw new UserManagementError(
          ApiErrorCode.NOT_FOUND,
          'User not found',
          errorData
        );
      case 429:
        throw new UserManagementError(
          ApiErrorCode.SERVICE_UNAVAILABLE,
          'Rate limit exceeded',
          errorData
        );
      default:
        throw new UserManagementError(
          ApiErrorCode.INTERNAL_ERROR,
          `${baseMessage}: ${errorData.message || 'Unknown error'}`,
          errorData
        );
    }
  }

  throw new UserManagementError(
    ApiErrorCode.INTERNAL_ERROR,
    `${baseMessage}: Network error`,
    { originalError: error.message }
  );
}