/**
 * @fileoverview Error constants and utilities for the IWMS web application
 * Provides comprehensive error handling support for floor plans, leases, and occupancy management
 * @package @iwms/web v1.0.0
 */

import { ApiErrorResponse } from '../types/api.types';

/**
 * HTTP status codes used throughout the application
 * Aligned with RFC 7231 standards
 */
export enum HTTP_STATUS_CODES {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504
}

/**
 * Domain-specific error types for IWMS functionality
 * Used for categorizing and handling errors appropriately
 */
export enum ERROR_TYPES {
  // Authentication & Authorization
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',

  // API & Network
  API = 'API',
  NETWORK = 'NETWORK',

  // Domain-specific
  FLOOR_PLAN = 'FLOOR_PLAN',
  LEASE = 'LEASE',
  OCCUPANCY = 'OCCUPANCY',
  INTEGRATION = 'INTEGRATION',

  // General
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  DATABASE = 'DATABASE',
  UNKNOWN = 'UNKNOWN'
}

/**
 * User-friendly error messages for all error scenarios
 * Supports i18n through message keys
 */
export const ERROR_MESSAGES = {
  // General System Errors
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  AUTH_ERROR: 'Your session has expired. Please log in again.',
  PERMISSION_ERROR: "You don't have permission to perform this action.",
  NOT_FOUND_ERROR: 'The requested resource could not be found.',
  DUPLICATE_ERROR: 'This resource already exists.',
  NETWORK_ERROR: 'Network connection error. Please check your connection.',
  API_ERROR: 'Unable to complete request. Please try again.',

  // Floor Plan Specific Errors
  FLOOR_PLAN_UPLOAD_ERROR: 'Failed to upload floor plan. Please check file format and try again.',
  FLOOR_PLAN_VALIDATION_ERROR: 'Floor plan validation failed. Please check dimensions and format.',
  FLOOR_PLAN_NOT_FOUND: 'The requested floor plan could not be found.',
  FLOOR_PLAN_VERSION_ERROR: 'Floor plan version conflict detected.',
  FLOOR_PLAN_PROCESSING_ERROR: 'Error processing floor plan data.',

  // Lease Management Errors
  LEASE_DOCUMENT_ERROR: 'Error processing lease document. Please verify the document format.',
  LEASE_RENEWAL_ERROR: 'Unable to process lease renewal. Please check lease terms.',
  LEASE_VALIDATION_ERROR: 'Lease validation failed. Please verify all required fields.',
  LEASE_TERM_ERROR: 'Invalid lease terms specified.',
  LEASE_PAYMENT_ERROR: 'Error processing lease payment information.',

  // Occupancy Management Errors
  OCCUPANCY_DATA_ERROR: 'Error retrieving occupancy data. Please try again.',
  OCCUPANCY_SENSOR_ERROR: 'Unable to connect to occupancy sensors.',
  OCCUPANCY_THRESHOLD_ERROR: 'Occupancy threshold exceeded.',
  OCCUPANCY_SYNC_ERROR: 'Error synchronizing occupancy data.',

  // Integration Errors
  INTEGRATION_ERROR: 'Error connecting to external system. Please try again later.',
  BMS_CONNECTION_ERROR: 'Unable to connect to Building Management System.',
  HR_SYNC_ERROR: 'Error synchronizing with HR system.',
  FINANCIAL_SYSTEM_ERROR: 'Unable to process financial transaction.'
} as const;

/**
 * Maps HTTP status codes to appropriate error types and messages
 * @param statusCode - HTTP status code from response
 * @param errorType - Specific error type from ERROR_TYPES
 * @param defaultMessage - Optional default message if specific mapping not found
 * @returns Localized error message appropriate for the status and type
 */
export function getErrorMessage(
  statusCode: number,
  errorType: ERROR_TYPES,
  defaultMessage?: string
): string {
  // Handle authentication/authorization errors
  if (statusCode === HTTP_STATUS_CODES.UNAUTHORIZED) {
    return ERROR_MESSAGES.AUTH_ERROR;
  }
  if (statusCode === HTTP_STATUS_CODES.FORBIDDEN) {
    return ERROR_MESSAGES.PERMISSION_ERROR;
  }

  // Handle specific error types
  switch (errorType) {
    case ERROR_TYPES.FLOOR_PLAN:
      return ERROR_MESSAGES.FLOOR_PLAN_VALIDATION_ERROR;
    case ERROR_TYPES.LEASE:
      return ERROR_MESSAGES.LEASE_VALIDATION_ERROR;
    case ERROR_TYPES.OCCUPANCY:
      return ERROR_MESSAGES.OCCUPANCY_DATA_ERROR;
    case ERROR_TYPES.INTEGRATION:
      return ERROR_MESSAGES.INTEGRATION_ERROR;
    case ERROR_TYPES.VALIDATION:
      return ERROR_MESSAGES.VALIDATION_ERROR;
    case ERROR_TYPES.NETWORK:
      return ERROR_MESSAGES.NETWORK_ERROR;
    case ERROR_TYPES.API:
      return ERROR_MESSAGES.API_ERROR;
    default:
      return defaultMessage || ERROR_MESSAGES.INTERNAL_ERROR;
  }
}

/**
 * Determines the specific error type based on HTTP status code and context
 * @param statusCode - HTTP status code from response
 * @param context - Optional context string for better error categorization
 * @returns Appropriate ERROR_TYPES enum value
 */
export function getErrorType(statusCode: number, context?: string): ERROR_TYPES {
  // Handle authentication/authorization status codes
  if (statusCode === HTTP_STATUS_CODES.UNAUTHORIZED) {
    return ERROR_TYPES.AUTHENTICATION;
  }
  if (statusCode === HTTP_STATUS_CODES.FORBIDDEN) {
    return ERROR_TYPES.AUTHORIZATION;
  }

  // Handle validation and business logic errors
  if (statusCode === HTTP_STATUS_CODES.BAD_REQUEST || 
      statusCode === HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY) {
    return ERROR_TYPES.VALIDATION;
  }

  // Handle specific contexts
  if (context) {
    if (context.includes('floor-plan')) return ERROR_TYPES.FLOOR_PLAN;
    if (context.includes('lease')) return ERROR_TYPES.LEASE;
    if (context.includes('occupancy')) return ERROR_TYPES.OCCUPANCY;
    if (context.includes('integration')) return ERROR_TYPES.INTEGRATION;
  }

  // Handle server errors
  if (statusCode >= 500) {
    return ERROR_TYPES.API;
  }

  return ERROR_TYPES.UNKNOWN;
}