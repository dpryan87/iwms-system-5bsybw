/**
 * @fileoverview Centralized message constants repository for the IWMS backend application.
 * Provides standardized message templates for system-wide communication.
 * @version 1.0.0
 */

/**
 * Error message templates for system-wide error handling
 * Follows RFC 7807 Problem Details specification for API error responses
 */
export const ERROR_MESSAGES = {
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred. Please try again later. Reference: {errorId}',
  VALIDATION_ERROR: 'Invalid input data provided. Details: {details}',
  AUTHENTICATION_ERROR: 'Authentication failed. Please log in again. Reason: {reason}',
  AUTHORIZATION_ERROR: 'You do not have permission to perform this action. Required role: {requiredRole}',
  RESOURCE_NOT_FOUND: 'The requested {resourceType} was not found. ID: {resourceId}',
  DUPLICATE_RESOURCE: 'A {resourceType} with identifier {identifier} already exists.',
  DATABASE_ERROR: 'Database operation failed. Operation: {operation}',
  INTEGRATION_ERROR: 'External service integration failed. Service: {service}, Status: {status}',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again in {retryAfter} seconds.',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Estimated recovery: {estimatedRecovery}'
} as const;

/**
 * Success message templates for operation confirmations
 * Used across all system components to provide consistent success feedback
 */
export const SUCCESS_MESSAGES = {
  RESOURCE_CREATED: '{resourceType} created successfully. ID: {resourceId}',
  RESOURCE_UPDATED: '{resourceType} updated successfully. Changes applied: {changeCount}',
  RESOURCE_DELETED: '{resourceType} deleted successfully.',
  OPERATION_SUCCESSFUL: 'Operation completed successfully. Details: {details}',
  CHANGES_SAVED: 'All changes have been saved successfully.'
} as const;

/**
 * Validation message templates for form inputs and data validation
 * Supports dynamic field names and validation parameters
 */
export const VALIDATION_MESSAGES = {
  REQUIRED_FIELD: 'The {fieldName} field is required.',
  INVALID_FORMAT: 'Invalid {fieldName} format. Expected format: {expectedFormat}',
  INVALID_LENGTH: '{fieldName} must be between {minLength} and {maxLength} characters.',
  INVALID_DATE_RANGE: 'Invalid date range. {startDate} must be before {endDate}',
  INVALID_CAPACITY: 'Space capacity must be between {minCapacity} and {maxCapacity}'
} as const;

/**
 * Notification message templates for system alerts and updates
 * Used for real-time notifications and system status updates
 */
export const NOTIFICATION_MESSAGES = {
  LEASE_EXPIRING: 'Lease for {spaceName} will expire in {days} days. Action required by: {actionDate}',
  OCCUPANCY_THRESHOLD: 'Space {spaceName} occupancy has reached {percentage}% of capacity. Current count: {currentCount}',
  MAINTENANCE_REQUIRED: 'Scheduled maintenance required for {resourceName}. Due date: {dueDate}',
  SPACE_UTILIZATION_ALERT: 'Space utilization for {floorName} is {utilizationRate}% below target. Review recommended.',
  SYSTEM_MAINTENANCE: 'System maintenance scheduled for {maintenanceDate}. Estimated duration: {duration}'
} as const;

// Type definitions for message constants to ensure type safety
type MessageConstant<T> = {
  readonly [K in keyof T]: string;
};

// Export type definitions for use in other modules
export type ErrorMessages = MessageConstant<typeof ERROR_MESSAGES>;
export type SuccessMessages = MessageConstant<typeof SUCCESS_MESSAGES>;
export type ValidationMessages = MessageConstant<typeof VALIDATION_MESSAGES>;
export type NotificationMessages = MessageConstant<typeof NOTIFICATION_MESSAGES>;