/**
 * @fileoverview API endpoint definitions for the Lightweight IWMS system
 * Defines standardized RESTful API endpoints for core system features including
 * floor plans, leases, occupancy tracking, and resource management.
 * @version 1.0.0
 */

// Base API URL with environment variable support and localhost fallback
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// API version prefix for URI-based versioning
const API_VERSION = '/api/v1';

/**
 * Floor plan management endpoint URLs
 * Supports floor plan CRUD operations, versioning, and CAD file handling
 */
export const FLOOR_PLAN_ENDPOINTS = {
  CREATE: `${API_VERSION}/floor-plans`,
  GET_BY_ID: `${API_VERSION}/floor-plans/:id`,
  UPDATE: `${API_VERSION}/floor-plans/:id`,
  DELETE: `${API_VERSION}/floor-plans/:id`,
  PUBLISH: `${API_VERSION}/floor-plans/:id/publish`,
  ARCHIVE: `${API_VERSION}/floor-plans/:id/archive`,
  GET_BY_PROPERTY: `${API_VERSION}/properties/:propertyId/floor-plans`,
  GET_VERSIONS: `${API_VERSION}/floor-plans/:id/versions`,
  UPLOAD_CAD: `${API_VERSION}/floor-plans/upload-cad`
} as const;

/**
 * Lease management endpoint URLs
 * Supports lease document management, financial tracking, and renewal monitoring
 */
export const LEASE_ENDPOINTS = {
  CREATE: `${API_VERSION}/leases`,
  UPDATE: `${API_VERSION}/leases/:id`,
  GET_BY_ID: `${API_VERSION}/leases/:id`,
  DELETE: `${API_VERSION}/leases/:id`,
  UPLOAD_DOCUMENT: `${API_VERSION}/leases/:id/documents`,
  GET_DOCUMENTS: `${API_VERSION}/leases/:id/documents`,
  GET_RENEWALS: `${API_VERSION}/leases/renewals`,
  GET_FINANCIAL_SUMMARY: `${API_VERSION}/leases/financial-summary`
} as const;

/**
 * Occupancy tracking endpoint URLs
 * Supports real-time monitoring, historical data, and utilization analytics
 */
export const OCCUPANCY_ENDPOINTS = {
  GET_CURRENT: `${API_VERSION}/occupancy/current`,
  GET_TRENDS: `${API_VERSION}/occupancy/trends`,
  UPDATE: `${API_VERSION}/occupancy/:spaceId`,
  GET_HISTORICAL: `${API_VERSION}/occupancy/historical`,
  GET_ALERTS: `${API_VERSION}/occupancy/alerts`,
  GET_UTILIZATION: `${API_VERSION}/occupancy/utilization`
} as const;

/**
 * Resource management endpoint URLs
 * Supports resource tracking, availability management, and bulk operations
 */
export const RESOURCE_ENDPOINTS = {
  CREATE: `${API_VERSION}/resources`,
  UPDATE: `${API_VERSION}/resources/:id`,
  GET_BY_ID: `${API_VERSION}/resources/:id`,
  DELETE: `${API_VERSION}/resources/:id`,
  GET_BY_SPACE: `${API_VERSION}/spaces/:spaceId/resources`,
  GET_AVAILABILITY: `${API_VERSION}/resources/:id/availability`,
  BULK_UPDATE: `${API_VERSION}/resources/bulk-update`
} as const;