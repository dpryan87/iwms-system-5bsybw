// @package axios ^1.4.0
import { AxiosResponse } from 'axios';
import { FloorPlanStatus } from '../../../backend/src/core/floor-plans/interfaces/floor-plan.interface';
import { LeaseStatus } from '../../../backend/src/core/leases/interfaces/lease.interface';

/**
 * Standard API response wrapper for type-safe responses
 * Ensures consistent response structure across all endpoints
 */
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T;
  readonly message: string;
  readonly errors: readonly string[];
  readonly timestamp: number;
}

/**
 * Enhanced paginated response with improved navigation support
 * Provides comprehensive pagination metadata
 */
export interface PaginatedResponse<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

/**
 * Enhanced error response with detailed error tracking
 * Provides comprehensive error information for debugging
 */
export interface ApiErrorResponse {
  readonly success: false;
  readonly message: string;
  readonly errors: readonly string[];
  readonly statusCode: number;
  readonly errorCode: string;
  readonly stack?: string;
  readonly timestamp: number;
}

/**
 * Enhanced request configuration with improved type safety
 * Supports advanced request configuration including retries
 */
export type ApiRequestConfig = {
  readonly headers: Readonly<Record<string, string>>;
  readonly params: Readonly<Record<string, unknown>>;
  readonly timeout: number;
  readonly validateStatus: (status: number) => boolean;
  readonly retryConfig: {
    readonly maxRetries: number;
    readonly retryDelay: number;
    readonly retryCondition: (error: unknown) => boolean;
  };
};

/**
 * Strict HTTP method type definition
 * Ensures type safety for HTTP methods
 */
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Generic API response type with axios integration
 * Provides type safety for axios responses
 */
export type ApiResponseType<T> = Promise<AxiosResponse<ApiResponse<T>>>;

/**
 * Pagination parameters for list endpoints
 * Standardizes pagination request structure
 */
export interface PaginationParams {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Filter parameters for list endpoints
 * Provides flexible filtering capabilities
 */
export interface FilterParams {
  readonly search?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly status?: FloorPlanStatus | LeaseStatus;
  readonly [key: string]: unknown;
}

/**
 * Base query parameters interface
 * Combines pagination and filtering
 */
export interface QueryParams extends PaginationParams, FilterParams {}

/**
 * API error codes enumeration
 * Standardizes error codes across the application
 */
export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

/**
 * API response status codes
 * Maps standard HTTP status codes
 */
export enum ApiStatusCode {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_ERROR = 500,
  SERVICE_UNAVAILABLE = 503
}

/**
 * Base success response type
 * Provides standard success response structure
 */
export type SuccessResponse = ApiResponse<{
  readonly message: string;
  readonly timestamp: number;
}>;

/**
 * Bulk operation response type
 * Handles bulk operation results
 */
export interface BulkOperationResponse {
  readonly successful: number;
  readonly failed: number;
  readonly errors: Array<{
    readonly id: string;
    readonly error: string;
  }>;
}

/**
 * API endpoint configuration
 * Defines endpoint metadata
 */
export interface ApiEndpointConfig {
  readonly path: string;
  readonly method: ApiMethod;
  readonly requiresAuth: boolean;
  readonly rateLimit?: {
    readonly windowMs: number;
    readonly maxRequests: number;
  };
}

/**
 * WebSocket event types
 * Defines real-time event types
 */
export enum WebSocketEventType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  DATA_UPDATE = 'data_update',
  STATUS_CHANGE = 'status_change'
}

/**
 * WebSocket message interface
 * Defines structure for WebSocket messages
 */
export interface WebSocketMessage<T> {
  readonly type: WebSocketEventType;
  readonly payload: T;
  readonly timestamp: number;
}

/**
 * Export all types and interfaces for API communication
 */
export type {
  ApiResponse,
  PaginatedResponse,
  ApiErrorResponse,
  ApiRequestConfig,
  ApiMethod,
  ApiResponseType,
  PaginationParams,
  FilterParams,
  QueryParams,
  SuccessResponse,
  BulkOperationResponse,
  ApiEndpointConfig,
  WebSocketMessage
};

export {
  ApiErrorCode,
  ApiStatusCode,
  WebSocketEventType
};