// @package jest v29.5.0
// @package ioredis v5.3.0
// @package pg v8.11.0
// @package winston v3.9.0
// @package @faker-js/faker v8.0.2

import { jest } from '@jest/globals';
import Redis from 'ioredis';
import { Client as PgClient } from 'pg';
import { createLogger, format, transports } from 'winston';
import { faker } from '@faker-js/faker';
import { DatabaseConfig } from '../../src/common/interfaces/config.interface';
import { getDatabaseConfig } from '../../src/common/config/database.config';
import { getRedisConfig } from '../../src/common/config/redis.config';
import { ErrorCodes } from '../../src/common/constants/error-codes';
import { VALIDATION_MESSAGES } from '../../src/common/constants/messages';

// Global test configuration constants
const TEST_DB_PREFIX = 'iwms_test_';
const TEST_REDIS_DB = 1;
const TEST_TIMEOUT = 10000;
const TEST_PERFORMANCE_THRESHOLD = 5000;
const TEST_MEMORY_LIMIT = 512 * 1024 * 1024; // 512MB
const TEST_LOG_LEVEL = 'debug';

/**
 * Test configuration interface
 */
interface TestConfig {
  databaseName: string;
  performanceMonitoring?: boolean;
  cleanupEnabled?: boolean;
  logLevel?: string;
}

/**
 * Test metrics interface for performance monitoring
 */
interface TestMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage: number;
  dbOperations: number;
  cacheOperations: number;
}

/**
 * Test logger configuration
 */
const testLogger = createLogger({
  level: TEST_LOG_LEVEL,
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'test.log' })
  ]
});

/**
 * Creates a fresh test database for running tests
 * @param databaseName - Name of the test database
 * @param config - Test configuration options
 */
export async function createTestDatabase(
  databaseName: string,
  config: TestConfig
): Promise<void> {
  const metrics: TestMetrics = {
    startTime: Date.now(),
    endTime: 0,
    duration: 0,
    memoryUsage: 0,
    dbOperations: 0,
    cacheOperations: 0
  };

  try {
    const dbConfig = await getDatabaseConfig('development');
    const client = new PgClient({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.username,
      password: dbConfig.password,
      database: 'postgres' // Connect to default database first
    });

    await client.connect();
    metrics.dbOperations++;

    // Drop existing test database if it exists
    await client.query(`DROP DATABASE IF EXISTS ${TEST_DB_PREFIX}${databaseName}`);
    metrics.dbOperations++;

    // Create fresh test database
    await client.query(`CREATE DATABASE ${TEST_DB_PREFIX}${databaseName}`);
    metrics.dbOperations++;

    await client.end();

    if (config.performanceMonitoring) {
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.memoryUsage = process.memoryUsage().heapUsed;

      testLogger.info('Test database creation metrics', {
        operation: 'createTestDatabase',
        metrics,
        database: databaseName
      });

      if (metrics.duration > TEST_PERFORMANCE_THRESHOLD) {
        testLogger.warn('Test database creation exceeded performance threshold', {
          duration: metrics.duration,
          threshold: TEST_PERFORMANCE_THRESHOLD
        });
      }
    }
  } catch (error) {
    testLogger.error('Failed to create test database', {
      error,
      database: databaseName
    });
    throw error;
  }
}

/**
 * Cleans up test database after tests complete
 * @param databaseName - Name of the test database to cleanup
 * @param config - Test configuration options
 */
export async function cleanupTestDatabase(
  databaseName: string,
  config: TestConfig
): Promise<void> {
  if (!config.cleanupEnabled) {
    testLogger.info('Database cleanup skipped - cleanup disabled in config');
    return;
  }

  try {
    const dbConfig = await getDatabaseConfig('development');
    const client = new PgClient({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.username,
      password: dbConfig.password,
      database: 'postgres'
    });

    await client.connect();
    await client.query(`DROP DATABASE IF EXISTS ${TEST_DB_PREFIX}${databaseName}`);
    await client.end();

    testLogger.info('Test database cleaned up successfully', {
      database: databaseName
    });
  } catch (error) {
    testLogger.error('Failed to cleanup test database', {
      error,
      database: databaseName
    });
    throw error;
  }
}

/**
 * Sets up Redis client for testing
 * @param config - Test configuration options
 * @returns Configured Redis client
 */
export async function setupTestRedis(config: TestConfig): Promise<Redis> {
  try {
    const redisConfig = await getRedisConfig();
    const client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: TEST_REDIS_DB,
      retryStrategy: (times: number) => Math.min(times * 50, 2000)
    });

    // Clear test database
    await client.flushdb();

    testLogger.info('Test Redis client setup successfully', {
      database: TEST_REDIS_DB
    });

    return client;
  } catch (error) {
    testLogger.error('Failed to setup test Redis client', { error });
    throw error;
  }
}

/**
 * Generates realistic test data for various entities
 * @param entityType - Type of entity to generate data for
 * @param overrides - Optional property overrides
 * @param config - Test configuration options
 */
export async function generateTestData(
  entityType: string,
  overrides: Record<string, any> = {},
  config: TestConfig
): Promise<any> {
  try {
    let testData: Record<string, any>;

    switch (entityType) {
      case 'floorPlan':
        testData = {
          id: faker.string.uuid(),
          name: faker.location.buildingNumber(),
          version: '1.0',
          status: 'active',
          area: faker.number.float({ min: 1000, max: 10000 }),
          metadata: {
            floors: faker.number.int({ min: 1, max: 50 }),
            lastModified: faker.date.recent()
          }
        };
        break;

      case 'space':
        testData = {
          id: faker.string.uuid(),
          floorPlanId: faker.string.uuid(),
          type: faker.helpers.arrayElement(['office', 'meeting', 'common']),
          area: faker.number.float({ min: 100, max: 1000 }),
          capacity: faker.number.int({ min: 1, max: 50 }),
          status: 'available'
        };
        break;

      case 'occupancy':
        testData = {
          id: faker.string.uuid(),
          spaceId: faker.string.uuid(),
          timestamp: faker.date.recent(),
          count: faker.number.int({ min: 0, max: 100 }),
          source: faker.helpers.arrayElement(['sensor', 'manual'])
        };
        break;

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }

    // Apply any overrides
    testData = { ...testData, ...overrides };

    if (config.performanceMonitoring) {
      testLogger.debug('Generated test data', {
        entityType,
        data: testData
      });
    }

    return testData;
  } catch (error) {
    testLogger.error('Failed to generate test data', {
      error,
      entityType
    });
    throw error;
  }
}

/**
 * Monitors and logs test execution performance metrics
 * @param testName - Name of the test being monitored
 * @param metrics - Test performance metrics
 */
export async function monitorTestPerformance(
  testName: string,
  metrics: TestMetrics
): Promise<void> {
  metrics.endTime = Date.now();
  metrics.duration = metrics.endTime - metrics.startTime;
  metrics.memoryUsage = process.memoryUsage().heapUsed;

  testLogger.info('Test performance metrics', {
    test: testName,
    metrics,
    timestamp: new Date().toISOString()
  });

  if (metrics.duration > TEST_PERFORMANCE_THRESHOLD) {
    testLogger.warn('Test exceeded performance threshold', {
      test: testName,
      duration: metrics.duration,
      threshold: TEST_PERFORMANCE_THRESHOLD
    });
  }

  if (metrics.memoryUsage > TEST_MEMORY_LIMIT) {
    testLogger.warn('Test exceeded memory limit', {
      test: testName,
      memoryUsage: metrics.memoryUsage,
      limit: TEST_MEMORY_LIMIT
    });
  }
}

/**
 * Verifies complete cleanup of test resources
 * @param config - Test configuration options
 * @param options - Cleanup verification options
 */
export async function verifyTestCleanup(
  config: TestConfig,
  options: { verifyDb?: boolean; verifyRedis?: boolean } = {}
): Promise<boolean> {
  try {
    if (options.verifyDb) {
      const dbConfig = await getDatabaseConfig('development');
      const client = new PgClient({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.username,
        password: dbConfig.password,
        database: 'postgres'
      });

      await client.connect();
      const result = await client.query(
        `SELECT datname FROM pg_database WHERE datname LIKE '${TEST_DB_PREFIX}%'`
      );
      await client.end();

      if (result.rows.length > 0) {
        testLogger.warn('Found uncleaned test databases', {
          databases: result.rows
        });
        return false;
      }
    }

    if (options.verifyRedis) {
      const redis = await setupTestRedis(config);
      const keys = await redis.keys('*');
      await redis.quit();

      if (keys.length > 0) {
        testLogger.warn('Found uncleaned Redis keys', {
          keys
        });
        return false;
      }
    }

    testLogger.info('Test cleanup verification completed successfully');
    return true;
  } catch (error) {
    testLogger.error('Failed to verify test cleanup', { error });
    throw error;
  }
}