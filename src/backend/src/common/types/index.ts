// @package express v4.18.0
import { Request, Response } from 'express';
import { DatabaseConfig } from '../interfaces/config.interface';
import { IBaseService } from '../interfaces/service.interface';

/**
 * Environment enumeration for deployment configuration
 * Maps to supported deployment environments
 */
export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production'
}

/**
 * Service health status enumeration
 * Provides granular health state tracking with degraded state support
 */
export enum ServiceStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

/**
 * HTTP method enumeration for API endpoints
 * Defines supported HTTP methods for REST API
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

/**
 * User role enumeration for access control
 * Defines available user roles in the system
 */
export enum UserRole {
  ADMIN = 'admin',
  FACILITY_MANAGER = 'facility_manager',
  SPACE_PLANNER = 'space_planner',
  BU_ADMIN = 'bu_admin'
}

/**
 * Extended Express Request interface with authenticated user information
 */
export interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    permissions: string[];
    businessUnitId?: string;
  };
}

/**
 * Standardized error response structure
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: {
    timestamp: string;
    path: string;
    method: string;
    [key: string]: unknown;
  };
}

/**
 * Service configuration type with health monitoring
 */
export type ServiceConfig = DatabaseConfig & {
  serviceName: string;
  healthCheck: {
    interval: number;
    timeout: number;
    retries: number;
    thresholds: {
      cpu: number;
      memory: number;
      errorRate: number;
    };
  };
};

/**
 * Async request handler type with error handling
 */
export type Handler = (
  req: RequestWithUser,
  res: Response
) => Promise<void>;

/**
 * Service health metrics type
 */
export type HealthMetrics = {
  uptime: number;
  responseTime: number;
  activeConnections: number;
  cpuUsage: number;
  memoryUsage: number;
  errorRate: number;
};

/**
 * Floor plan resource type
 */
export type FloorPlanResource = {
  id: string;
  type: 'desk' | 'room' | 'area';
  status: 'available' | 'occupied' | 'maintenance';
  capacity: number;
  coordinates: {
    x: number;
    y: number;
  };
  metadata?: Record<string, unknown>;
};

/**
 * Occupancy data type
 */
export type OccupancyData = {
  spaceId: string;
  timestamp: Date;
  count: number;
  capacity: number;
  utilizationRate: number;
  source: 'sensor' | 'manual' | 'calculated';
};

/**
 * Service dependency type
 */
export type ServiceDependency = {
  name: string;
  required: boolean;
  healthEndpoint: string;
  timeout: number;
  retryPolicy: {
    attempts: number;
    backoff: number;
  };
};

/**
 * Cache configuration type
 */
export type CacheConfig = {
  ttl: number;
  namespace: string;
  invalidationEvents: string[];
  strategy: 'lru' | 'fifo';
};

/**
 * Validation result type
 */
export type ValidationResult = {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
};

/**
 * Audit log entry type
 */
export type AuditLogEntry = {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

/**
 * Service initialization options
 */
export type InitializationOptions = {
  validateDependencies?: boolean;
  startupTimeout?: number;
  gracefulShutdown?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
};

/**
 * Re-export essential interfaces and types from service interface
 */
export {
  IBaseService,
  ServiceConfig,
  ErrorResponse,
  RequestWithUser,
  Handler
};