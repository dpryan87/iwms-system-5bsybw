/**
 * @fileoverview Centralized error code constants for the IWMS backend application.
 * Provides standardized error codes that map to HTTP status codes for consistent
 * error handling across the system.
 * 
 * @version 1.0.0
 * @license MIT
 */

/**
 * Standardized error codes enum for the IWMS system.
 * Maps application errors to appropriate HTTP status codes for consistent
 * error handling and response formatting across all services.
 * 
 * @readonly
 * @enum {number}
 * 
 * @example
 * ```typescript
 * import { ErrorCodes } from '@common/constants/error-codes';
 * 
 * // Throwing an error with standard code
 * throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid floor plan data');
 * 
 * // Checking response status
 * if (response.status === ErrorCodes.SUCCESS) {
 *   // Handle success case
 * }
 * ```
 */
export enum ErrorCodes {
  /**
   * Operation completed successfully
   * Maps to HTTP 200 OK
   */
  SUCCESS = 200,

  /**
   * Request validation failed due to invalid input parameters
   * Maps to HTTP 400 Bad Request
   */
  VALIDATION_ERROR = 400,

  /**
   * Authentication credentials are invalid or missing
   * Maps to HTTP 401 Unauthorized
   */
  AUTHENTICATION_ERROR = 401,

  /**
   * User lacks required permissions for the requested operation
   * Maps to HTTP 403 Forbidden
   */
  AUTHORIZATION_ERROR = 403,

  /**
   * Requested resource does not exist in the system
   * Maps to HTTP 404 Not Found
   */
  RESOURCE_NOT_FOUND = 404,

  /**
   * Resource already exists when attempting to create
   * Maps to HTTP 409 Conflict
   */
  DUPLICATE_RESOURCE = 409,

  /**
   * Database operation failed
   * Maps to HTTP 500 Internal Server Error
   */
  DATABASE_ERROR = 500,

  /**
   * External service or integration point failed
   * Maps to HTTP 502 Bad Gateway
   */
  INTEGRATION_ERROR = 502,

  /**
   * Unexpected server error occurred
   * Maps to HTTP 500 Internal Server Error
   */
  INTERNAL_SERVER_ERROR = 500,
}

/**
 * Error categories for documentation and filtering purposes
 * @internal
 */
export const ERROR_CATEGORIES = {
  SUCCESS_CODES: [
    ErrorCodes.SUCCESS,
  ],
  CLIENT_ERRORS: [
    ErrorCodes.VALIDATION_ERROR,
    ErrorCodes.AUTHENTICATION_ERROR,
    ErrorCodes.AUTHORIZATION_ERROR,
    ErrorCodes.RESOURCE_NOT_FOUND,
    ErrorCodes.DUPLICATE_RESOURCE,
  ],
  SERVER_ERRORS: [
    ErrorCodes.DATABASE_ERROR,
    ErrorCodes.INTEGRATION_ERROR,
    ErrorCodes.INTERNAL_SERVER_ERROR,
  ],
} as const;

/**
 * Error code descriptions for logging and documentation
 * @internal
 */
export const ERROR_DESCRIPTIONS = {
  [ErrorCodes.SUCCESS]: 'Operation completed successfully',
  [ErrorCodes.VALIDATION_ERROR]: 'Request validation failed',
  [ErrorCodes.AUTHENTICATION_ERROR]: 'Authentication credentials invalid or missing',
  [ErrorCodes.AUTHORIZATION_ERROR]: 'User lacks required permissions',
  [ErrorCodes.RESOURCE_NOT_FOUND]: 'Requested resource does not exist',
  [ErrorCodes.DUPLICATE_RESOURCE]: 'Resource already exists',
  [ErrorCodes.DATABASE_ERROR]: 'Database operation failed',
  [ErrorCodes.INTEGRATION_ERROR]: 'External service integration failed',
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 'Unexpected server error occurred',
} as const;

/**
 * Maintenance and usage guidelines for the error codes system
 * @internal
 */
export const ERROR_CODE_GUIDELINES = {
  MAINTENANCE_NOTES: [
    'Add new error codes only after team review',
    'Maintain HTTP status code alignment',
    'Update documentation when adding codes',
    'Consider security implications',
  ],
  USAGE_EXAMPLES: [
    "import { ErrorCodes } from '@common/constants/error-codes'",
    "throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid floor plan data')",
    'if (response.status === ErrorCodes.SUCCESS)',
  ],
} as const;

// Prevent modifications to error codes at runtime
Object.freeze(ErrorCodes);
Object.freeze(ERROR_CATEGORIES);
Object.freeze(ERROR_DESCRIPTIONS);
Object.freeze(ERROR_CODE_GUIDELINES);