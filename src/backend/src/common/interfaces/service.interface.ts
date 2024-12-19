// @package inversify v6.0.1
// @package winston v3.8.2
import { injectable } from 'inversify';
import { Logger } from 'winston';
import { DatabaseConfig } from './config.interface';

/**
 * Service health status enumeration
 * Defines possible health states for service monitoring
 */
export enum ServiceHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

/**
 * Service health check result interface
 * Provides detailed health status information
 */
export interface IHealthCheckResult {
  status: ServiceHealthStatus;
  timestamp: Date;
  details: {
    database: boolean;
    cache: boolean;
    dependencies: boolean;
    message?: string;
  };
  metrics: {
    uptime: number;
    responseTime: number;
    activeConnections: number;
  };
}

/**
 * Service configuration options interface
 * Defines additional configuration options for service customization
 */
export interface IServiceOptions {
  retryAttempts?: number;
  timeoutMs?: number;
  enableMetrics?: boolean;
  cacheTTL?: number;
  [key: string]: unknown;
}

/**
 * Service configuration interface
 * Defines required configuration for service initialization
 */
export interface IServiceConfig {
  serviceName: string;
  databaseConfig: DatabaseConfig;
  options?: IServiceOptions;
}

/**
 * Base service interface
 * Defines standard contract that all IWMS services must implement
 */
export interface IBaseService {
  /**
   * Service logger instance
   */
  readonly logger: Logger;

  /**
   * Service initialization status
   */
  readonly initialized: boolean;

  /**
   * Initializes the service with provided configuration
   * Sets up database connections, caching, and required dependencies
   * 
   * @param config - Service configuration parameters
   * @throws Error if initialization fails
   */
  initialize(config: IServiceConfig): Promise<void>;

  /**
   * Validates service configuration and dependencies
   * Ensures all required resources are available and properly configured
   * 
   * @returns Promise resolving to validation result
   */
  validate(): Promise<boolean>;

  /**
   * Performs comprehensive service health check
   * Validates database connectivity, cache availability, and dependency status
   * 
   * @returns Promise resolving to detailed health check result
   */
  healthCheck(): Promise<IHealthCheckResult>;

  /**
   * Gracefully shuts down the service
   * Closes database connections and cleans up resources
   */
  shutdown(): Promise<void>;
}

/**
 * Service metadata interface
 * Provides additional service information for discovery and monitoring
 */
export interface IServiceMetadata {
  name: string;
  version: string;
  description?: string;
  dependencies: string[];
  endpoints: string[];
}

/**
 * Service registration interface
 * Used for service discovery and registration with API gateway
 */
export interface IServiceRegistration {
  metadata: IServiceMetadata;
  healthCheck: () => Promise<IHealthCheckResult>;
  deregister: () => Promise<void>;
}

/**
 * Service event types enumeration
 * Defines standard events that services can emit
 */
export enum ServiceEventType {
  INITIALIZED = 'service.initialized',
  HEALTH_CHANGED = 'service.health.changed',
  ERROR = 'service.error',
  SHUTDOWN = 'service.shutdown'
}

/**
 * Service event interface
 * Defines structure for events emitted by services
 */
export interface IServiceEvent {
  type: ServiceEventType;
  serviceName: string;
  timestamp: Date;
  payload?: unknown;
}

// Export all interfaces and types for service implementation
export {
  IBaseService,
  IServiceConfig,
  IServiceOptions,
  IHealthCheckResult,
  IServiceMetadata,
  IServiceRegistration,
  IServiceEvent,
  ServiceHealthStatus,
  ServiceEventType
};