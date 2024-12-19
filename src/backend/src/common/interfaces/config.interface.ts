// @package dotenv v16.0.0
import { config } from 'dotenv';

/**
 * Application environment type
 */
export type AppEnvironment = 'development' | 'staging' | 'production';

/**
 * Database SSL configuration interface
 * Handles secure database connections with certificate management
 */
export interface DatabaseSSLConfig {
  enabled: boolean;
  ca?: string;
  key?: string;
  cert?: string;
  rejectUnauthorized: boolean;
}

/**
 * Database connection pool configuration
 * Manages database connection lifecycle and performance
 */
export interface ConnectionPoolConfig {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

/**
 * Database replication configuration
 * Handles read-write splitting and high availability
 */
export interface ReplicationConfig {
  master: {
    host: string;
    port: number;
  };
  slaves: Array<{
    host: string;
    port: number;
  }>;
  selector?: 'RR' | 'RANDOM';
}

/**
 * Enhanced database configuration interface
 * Comprehensive database settings with security and performance options
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema: string;
  ssl: DatabaseSSLConfig;
  poolConfig: ConnectionPoolConfig;
  replication?: ReplicationConfig;
}

/**
 * Redis TLS configuration interface
 */
export interface RedisTLSConfig {
  enabled: boolean;
  ca?: string;
  key?: string;
  cert?: string;
  rejectUnauthorized: boolean;
}

/**
 * Redis Sentinel configuration
 */
export interface RedisSentinelConfig {
  enabled: boolean;
  masterName: string;
  sentinels: Array<{
    host: string;
    port: number;
  }>;
}

/**
 * Redis cluster configuration
 */
export interface RedisClusterConfig {
  enabled: boolean;
  nodes: Array<{
    host: string;
    port: number;
  }>;
  retryDelay: number;
  retryAttempts: number;
}

/**
 * Enhanced Redis configuration interface
 */
export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  cluster: RedisClusterConfig;
  sentinel: RedisSentinelConfig;
  tls: RedisTLSConfig;
}

/**
 * Monitoring configuration interface
 */
export interface MonitoringConfig {
  enabled: boolean;
  provider: 'datadog' | 'newrelic' | 'cloudwatch';
  sampleRate: number;
  endpoints: string[];
  alertThresholds?: {
    cpu: number;
    memory: number;
    errorRate: number;
  };
}

/**
 * Security configuration interface
 */
export interface SecurityConfig {
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    max: number;
  };
  helmet: {
    enabled: boolean;
    config: Record<string, unknown>;
  };
  cors: {
    enabled: boolean;
    credentials: boolean;
  };
}

/**
 * SSO configuration interface
 */
export interface SSOConfig {
  provider: 'auth0' | 'okta' | 'azure';
  clientId: string;
  clientSecret: string;
  domain: string;
  callbackUrl: string;
  audience?: string;
}

/**
 * BMS (Building Management System) configuration interface
 */
export interface BMSConfig {
  endpoint: string;
  apiKey: string;
  protocol: 'mqtt' | 'http';
  refreshInterval: number;
  sensors: {
    occupancy: boolean;
    temperature: boolean;
    humidity: boolean;
  };
}

/**
 * HR system integration configuration interface
 */
export interface HRConfig {
  endpoint: string;
  apiKey: string;
  syncInterval: number;
  features: {
    employees: boolean;
    departments: boolean;
    locations: boolean;
  };
}

/**
 * Financial system integration configuration interface
 */
export interface FinancialConfig {
  endpoint: string;
  apiKey: string;
  features: {
    leasePayments: boolean;
    costCenters: boolean;
    budgets: boolean;
  };
}

/**
 * Main application configuration interface
 */
export interface AppConfig {
  port: number;
  environment: AppEnvironment;
  apiVersion: string;
  corsOrigins: string[];
  monitoring: MonitoringConfig;
  security: SecurityConfig;
}

/**
 * External system integration configuration interface
 */
export interface IntegrationConfig {
  sso: SSOConfig;
  bms: BMSConfig;
  hr: HRConfig;
  financial: FinancialConfig;
}

/**
 * Complete system configuration interface
 */
export interface SystemConfig {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  integrations: IntegrationConfig;
}