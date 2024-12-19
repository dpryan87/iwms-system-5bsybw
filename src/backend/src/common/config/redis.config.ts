/**
 * @fileoverview Redis configuration module for the IWMS application
 * Provides secure, validated connection and cluster settings for Redis caching layer
 * with high availability support and performance optimization
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.0.0
import Joi from 'joi'; // v17.9.0
import { RedisConfig } from '../interfaces/config.interface';
import { validateSchema } from '../utils/validation.util';
import { VALIDATION_MESSAGES } from '../constants/messages';

// Initialize environment configuration
config();

/**
 * Enhanced Redis configuration schema with security and performance requirements
 */
const redisConfigSchema = Joi.object({
  host: Joi.string()
    .required()
    .hostname()
    .description('Redis server hostname'),

  port: Joi.number()
    .required()
    .port()
    .description('Redis server port'),

  password: Joi.string()
    .required()
    .min(12)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/)
    .description('Strong Redis password with special characters'),

  db: Joi.number()
    .default(0)
    .min(0)
    .max(15)
    .description('Redis database index'),

  cluster: Joi.object({
    enabled: Joi.boolean().default(false),
    nodes: Joi.array().items(
      Joi.object({
        host: Joi.string().required().hostname(),
        port: Joi.number().required().port()
      })
    ).when('enabled', {
      is: true,
      then: Joi.array().min(3).required()
    }),
    retryDelay: Joi.number().default(3000),
    retryAttempts: Joi.number().default(10)
  }).default(),

  sentinel: Joi.object({
    enabled: Joi.boolean().default(false),
    masterName: Joi.string().when('enabled', {
      is: true,
      then: Joi.required()
    }),
    sentinels: Joi.array().items(
      Joi.object({
        host: Joi.string().required().hostname(),
        port: Joi.number().required().port()
      })
    ).when('enabled', {
      is: true,
      then: Joi.array().min(3).required()
    })
  }).default(),

  tls: Joi.object({
    enabled: Joi.boolean().default(true),
    ca: Joi.string().when('enabled', {
      is: true,
      then: Joi.required()
    }),
    cert: Joi.string().when('enabled', {
      is: true,
      then: Joi.required()
    }),
    key: Joi.string().when('enabled', {
      is: true,
      then: Joi.required()
    }),
    rejectUnauthorized: Joi.boolean().default(true)
  }).default(),

  connectionPool: Joi.object({
    minConnections: Joi.number().default(5),
    maxConnections: Joi.number().default(20),
    idleTimeoutMs: Joi.number().default(60000)
  }).default()
}).required();

/**
 * Validates Redis configuration against schema with security and performance requirements
 * @param config - Redis configuration object to validate
 * @returns Promise<RedisConfig> Validated Redis configuration
 * @throws ValidationError if configuration is invalid
 */
async function validateRedisConfig(config: RedisConfig): Promise<RedisConfig> {
  const { isValid, errors } = await validateSchema(config, redisConfigSchema);

  if (!isValid) {
    throw new Error(
      VALIDATION_MESSAGES.INVALID_FORMAT.replace(
        '{fieldName}',
        'Redis configuration'
      ).replace('{expectedFormat}', errors?.join(', ') || '')
    );
  }

  return config;
}

/**
 * Retrieves and validates Redis configuration from environment
 * @returns RedisConfig Secure Redis configuration object
 * @throws Error if required environment variables are missing
 */
async function getRedisConfig(): Promise<RedisConfig> {
  const redisConfig: RedisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
    cluster: {
      enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
      nodes: process.env.REDIS_CLUSTER_NODES ? 
        JSON.parse(process.env.REDIS_CLUSTER_NODES) : [],
      retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '3000', 10),
      retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '10', 10)
    },
    sentinel: {
      enabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
      masterName: process.env.REDIS_SENTINEL_MASTER_NAME || '',
      sentinels: process.env.REDIS_SENTINELS ? 
        JSON.parse(process.env.REDIS_SENTINELS) : []
    },
    tls: {
      enabled: process.env.REDIS_TLS_ENABLED !== 'false',
      ca: process.env.REDIS_TLS_CA || '',
      cert: process.env.REDIS_TLS_CERT || '',
      key: process.env.REDIS_TLS_KEY || '',
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false'
    },
    connectionPool: {
      minConnections: parseInt(process.env.REDIS_POOL_MIN_CONNECTIONS || '5', 10),
      maxConnections: parseInt(process.env.REDIS_POOL_MAX_CONNECTIONS || '20', 10),
      idleTimeoutMs: parseInt(process.env.REDIS_POOL_IDLE_TIMEOUT || '60000', 10)
    }
  };

  return validateRedisConfig(redisConfig);
}

// Initialize and validate Redis configuration
export const redisConfig = await getRedisConfig();

// Prevent runtime modifications to the configuration
Object.freeze(redisConfig);