/**
 * API Constants
 * Defines comprehensive API-related constants including version, configuration,
 * security headers, error codes, and HTTP methods for the IWMS frontend application
 * with enhanced security and monitoring capabilities.
 * @version 1.0.0
 */

/**
 * Current API version identifier
 * Used for versioning API endpoints
 */
export const API_VERSION = 'v1';

/**
 * HTTP method constants for API requests
 * Defines standard HTTP methods used for REST API communication
 */
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH'
} as const;

/**
 * Default API configuration values with security parameters
 * Defines timeouts, retry logic, and request limits
 */
export const DEFAULT_API_CONFIG = {
  /** Request timeout in milliseconds */
  TIMEOUT: 30000,
  /** Number of retry attempts for failed requests */
  RETRY_ATTEMPTS: 3,
  /** Delay between retry attempts in milliseconds */
  RETRY_DELAY: 1000,
  /** Maximum allowed payload size in bytes (10MB) */
  MAX_PAYLOAD_SIZE: 10485760,
  /** Maximum requests per hour per client */
  RATE_LIMIT: 1000
} as const;

/**
 * HTTP status codes including standard and custom responses
 * Extended to include rate limiting and common error scenarios
 */
export const HTTP_STATUS = {
  /** Successful response */
  OK: 200,
  /** Resource created successfully */
  CREATED: 201,
  /** Invalid request parameters */
  BAD_REQUEST: 400,
  /** Authentication required */
  UNAUTHORIZED: 401,
  /** Insufficient permissions */
  FORBIDDEN: 403,
  /** Resource not found */
  NOT_FOUND: 404,
  /** Rate limit exceeded */
  TOO_MANY_REQUESTS: 429,
  /** Server error */
  INTERNAL_SERVER_ERROR: 500
} as const;

/**
 * API headers including security and monitoring headers
 * Implements security best practices and OWASP recommendations
 */
export const API_HEADERS = {
  /** Content type header */
  CONTENT_TYPE: 'Content-Type',
  /** Authorization header for JWT tokens */
  AUTHORIZATION: 'Authorization',
  /** Accept header for content negotiation */
  ACCEPT: 'Accept',
  /** API key header for service authentication */
  X_API_KEY: 'X-Api-Key',
  /** Request ID header for request tracking */
  X_REQUEST_ID: 'X-Request-ID',
  /** Rate limit quota header */
  X_RATE_LIMIT: 'X-RateLimit-Limit',
  /** Remaining rate limit header */
  X_RATE_LIMIT_REMAINING: 'X-RateLimit-Remaining',
  /** HTTP Strict Transport Security header */
  STRICT_TRANSPORT_SECURITY: 'Strict-Transport-Security',
  /** Prevent MIME type sniffing */
  X_CONTENT_TYPE_OPTIONS: 'X-Content-Type-Options',
  /** Clickjacking protection */
  X_FRAME_OPTIONS: 'X-Frame-Options',
  /** Cross-site scripting protection */
  X_XSS_PROTECTION: 'X-XSS-Protection'
} as const;

/**
 * Type definitions for API constants to ensure type safety
 */
export type HttpMethod = typeof HTTP_METHODS[keyof typeof HTTP_METHODS];
export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];
export type ApiHeader = typeof API_HEADERS[keyof typeof API_HEADERS];