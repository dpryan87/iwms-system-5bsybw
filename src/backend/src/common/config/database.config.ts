// @package dotenv v16.0.0
import { config } from 'dotenv';
import { DatabaseConfig } from '../interfaces/config.interface';
import { Environment } from '../types';

// Load environment variables
config();

// Default configuration constants
const DEFAULT_PORT = 5432;
const DEFAULT_SCHEMA = 'public';
const DEFAULT_SSL = true;
const MIN_POOL_SIZE = 5;
const MAX_POOL_SIZE = 20;
const CONNECTION_TIMEOUT = 10000;

/**
 * Validates database configuration completeness and security requirements
 * @param config Database configuration to validate
 * @returns boolean indicating if configuration is valid
 */
const validateDatabaseConfig = (config: DatabaseConfig): boolean => {
  // Required fields validation
  if (!config.host || !config.username || !config.password || !config.database) {
    throw new Error('Missing required database configuration parameters');
  }

  // SSL validation for non-development environments
  if (process.env.NODE_ENV !== Environment.DEVELOPMENT && !config.ssl.enabled) {
    throw new Error('SSL must be enabled in non-development environments');
  }

  // Pool configuration validation
  if (config.pool.min < 1 || config.pool.max < config.pool.min) {
    throw new Error('Invalid connection pool configuration');
  }

  // Replication validation for production
  if (process.env.NODE_ENV === Environment.PRODUCTION && !config.replication) {
    throw new Error('Replication configuration required in production environment');
  }

  return true;
};

/**
 * Retrieves environment-specific database configuration with enhanced security and performance settings
 * @param environment Current deployment environment
 * @returns DatabaseConfig object with complete configuration
 */
const getDatabaseConfig = (environment: Environment): DatabaseConfig => {
  const config: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || DEFAULT_PORT.toString(), 10),
    username: process.env.DB_USERNAME || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    schema: process.env.DB_SCHEMA || DEFAULT_SCHEMA,
    ssl: {
      enabled: process.env.DB_SSL === 'true' || DEFAULT_SSL,
      rejectUnauthorized: environment !== Environment.DEVELOPMENT,
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY
    },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || MIN_POOL_SIZE.toString(), 10),
      max: parseInt(process.env.DB_POOL_MAX || MAX_POOL_SIZE.toString(), 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: CONNECTION_TIMEOUT
    }
  };

  // Add replication configuration for production environment
  if (environment === Environment.PRODUCTION) {
    config.replication = {
      master: {
        host: process.env.DB_MASTER_HOST || config.host,
        port: parseInt(process.env.DB_MASTER_PORT || config.port.toString(), 10)
      },
      slaves: [
        {
          host: process.env.DB_SLAVE_HOST_1 || '',
          port: parseInt(process.env.DB_SLAVE_PORT_1 || DEFAULT_PORT.toString(), 10)
        }
      ],
      selector: 'RR' // Round-robin load balancing
    };
  }

  // Environment-specific configurations
  switch (environment) {
    case Environment.PRODUCTION:
      config.pool.min = Math.max(config.pool.min, 10);
      config.pool.max = Math.max(config.pool.max, 50);
      config.ssl.rejectUnauthorized = true;
      break;
    case Environment.STAGING:
      config.pool.min = Math.max(config.pool.min, 5);
      config.pool.max = Math.max(config.pool.max, 30);
      config.ssl.rejectUnauthorized = true;
      break;
    case Environment.DEVELOPMENT:
      config.pool.min = 2;
      config.pool.max = 10;
      config.ssl.rejectUnauthorized = false;
      break;
  }

  // Validate the configuration
  validateDatabaseConfig(config);

  return config;
};

// Get current environment
const environment = (process.env.NODE_ENV as Environment) || Environment.DEVELOPMENT;

// Export the database configuration
export const databaseConfig = getDatabaseConfig(environment);

// Export utility functions for testing and configuration management
export { getDatabaseConfig, validateDatabaseConfig };