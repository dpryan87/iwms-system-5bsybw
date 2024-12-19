// @jest/globals v29.5.0
import { beforeAll, afterAll } from '@jest/globals';
import { DatabaseConfig } from '../../src/common/interfaces/config.interface';
import { performance } from 'perf_hooks';
import { createPool, Pool } from 'pg';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// Global test configuration constants
const TEST_TIMEOUT = 30000;
const TEST_DB_NAME = 'iwms_test';
const TEST_METRICS_ENABLED = true;
const TEST_REDIS_DB = 1;

// Test environment state tracking
interface TestEnvironmentState {
  startTime: number;
  dbPool?: Pool;
  redisClient?: Redis;
  testId: string;
  resourceUsage: {
    dbConnections: number;
    cacheKeys: number;
    memoryUsage: number;
  };
}

const state: TestEnvironmentState = {
  startTime: 0,
  testId: '',
  resourceUsage: {
    dbConnections: 0,
    cacheKeys: 0,
    memoryUsage: 0
  }
};

/**
 * Validates test environment configuration
 * @throws Error if required environment variables are missing
 */
const validateEnvironment = (): void => {
  const requiredVars = [
    'TEST_DB_HOST',
    'TEST_DB_PORT',
    'TEST_REDIS_HOST',
    'TEST_REDIS_PORT'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  if (missing.length) {
    throw new Error(`Missing required test environment variables: ${missing.join(', ')}`);
  }
};

/**
 * Creates an isolated test database instance
 * @returns Promise<void>
 */
const initializeTestDatabase = async (): Promise<void> => {
  const dbConfig: DatabaseConfig = {
    host: process.env.TEST_DB_HOST!,
    port: parseInt(process.env.TEST_DB_PORT!, 10),
    database: TEST_DB_NAME,
    username: process.env.TEST_DB_USER!,
    password: process.env.TEST_DB_PASSWORD!,
    schema: 'public',
    ssl: {
      enabled: false,
      rejectUnauthorized: true
    },
    poolConfig: {
      min: 1,
      max: 5,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 1000
    }
  };

  state.dbPool = createPool({
    ...dbConfig,
    database: 'postgres' // Connect to default DB first
  });

  // Create test database if it doesn't exist
  await state.dbPool.query(`
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE datname = $1
  `, [TEST_DB_NAME]);

  await state.dbPool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
  await state.dbPool.query(`CREATE DATABASE ${TEST_DB_NAME}`);

  // Reconnect to test database
  await state.dbPool.end();
  state.dbPool = createPool(dbConfig);
};

/**
 * Initializes Redis test instance with secure configuration
 * @returns Promise<void>
 */
const initializeTestCache = async (): Promise<void> => {
  state.redisClient = new Redis({
    host: process.env.TEST_REDIS_HOST!,
    port: parseInt(process.env.TEST_REDIS_PORT!, 10),
    db: TEST_REDIS_DB,
    password: process.env.TEST_REDIS_PASSWORD,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => Math.min(times * 50, 2000)
  });

  // Clear test database
  await state.redisClient.flushdb();
};

/**
 * Tracks system resource usage
 * @returns Current resource usage metrics
 */
const trackResourceUsage = async (): Promise<void> => {
  if (!TEST_METRICS_ENABLED) return;

  const pool = state.dbPool;
  const redis = state.redisClient;

  if (pool) {
    const { rows } = await pool.query('SELECT count(*) FROM pg_stat_activity');
    state.resourceUsage.dbConnections = parseInt(rows[0].count, 10);
  }

  if (redis) {
    const keys = await redis.dbsize();
    state.resourceUsage.cacheKeys = keys;
  }

  state.resourceUsage.memoryUsage = process.memoryUsage().heapUsed;
};

/**
 * Enhanced global setup function that initializes test environment
 * with performance monitoring and security features
 */
export const setupTestEnvironment = beforeAll(async () => {
  state.startTime = performance.now();
  state.testId = uuidv4();

  try {
    // Validate environment
    validateEnvironment();

    // Initialize test infrastructure
    await initializeTestDatabase();
    await initializeTestCache();

    // Track initial resource usage
    await trackResourceUsage();

    if (TEST_METRICS_ENABLED) {
      console.log(`Test environment initialized (ID: ${state.testId})`);
      console.log('Initial resource usage:', state.resourceUsage);
    }
  } catch (error) {
    console.error('Test environment setup failed:', error);
    throw error;
  }
}, TEST_TIMEOUT);

/**
 * Enhanced global teardown function with comprehensive cleanup verification
 */
export const teardownTestEnvironment = afterAll(async () => {
  try {
    // Track final resource usage
    await trackResourceUsage();

    // Cleanup database
    if (state.dbPool) {
      await state.dbPool.query(`
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = $1
      `, [TEST_DB_NAME]);
      await state.dbPool.end();
    }

    // Cleanup Redis
    if (state.redisClient) {
      await state.redisClient.flushdb();
      await state.redisClient.quit();
    }

    if (TEST_METRICS_ENABLED) {
      const duration = performance.now() - state.startTime;
      console.log(`Test environment teardown completed (ID: ${state.testId})`);
      console.log(`Duration: ${duration.toFixed(2)}ms`);
      console.log('Final resource usage:', state.resourceUsage);
    }
  } catch (error) {
    console.error('Test environment teardown failed:', error);
    throw error;
  }
}, TEST_TIMEOUT);