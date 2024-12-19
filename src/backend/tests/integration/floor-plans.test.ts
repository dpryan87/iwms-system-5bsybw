// @package jest v29.5.0
// @package supertest v6.3.3

import { jest, describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals';
import supertest from 'supertest';
import { IFloorPlan, FloorPlanStatus, IValidationResult } from '../../src/core/floor-plans/interfaces/floor-plan.interface';
import { FloorPlanService } from '../../src/core/floor-plans/services/floor-plan.service';
import { TestHelpers } from '../utils/test-helpers';

// Constants for test configuration
const TEST_DB_NAME = 'iwms_test_floor_plans';
const PERFORMANCE_THRESHOLD_MS = 100;
const CACHE_TTL_SECONDS = 300;

// Test data constants
const VALID_FLOOR_PLAN: IFloorPlan = {
  id: '',  // Will be generated
  propertyId: 'test-property-123',
  version: '1.0.0',
  status: FloorPlanStatus.DRAFT,
  metadata: {
    name: 'Test Floor Plan',
    level: 1,
    totalArea: 1000,
    dimensions: {
      width: 100,
      height: 100,
      scale: 1
    },
    fileUrl: 'https://storage.example.com/floor-plans/test.dwg',
    fileHash: 'abc123',
    bmsConfig: {
      systemId: 'bms-123',
      sensorMappings: '{}',
      enabled: false,
      config: {
        endpoint: 'https://bms.example.com',
        credentials: {
          apiKey: 'test-key'
        },
        refreshInterval: 300000,
        retryPolicy: {
          attempts: 3,
          backoff: 1000
        }
      }
    },
    validationRules: {
      minArea: 10,
      maxArea: 10000,
      requiredFields: ['name', 'level', 'dimensions'],
      customRules: {}
    },
    customAttributes: {}
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test-user',
  updatedBy: 'test-user',
  versionInfo: {
    major: 1,
    minor: 0,
    revision: 0,
    changelog: 'Initial version',
    isLatest: true
  },
  auditInfo: {
    createdAt: new Date(),
    createdBy: 'test-user',
    updatedAt: new Date(),
    updatedBy: 'test-user',
    comments: []
  }
};

describe('Floor Plan Integration Tests', () => {
  let floorPlanService: FloorPlanService;
  let testDb: any;
  let testCache: any;
  let performanceMetrics: any;

  beforeAll(async () => {
    // Initialize test environment
    testDb = await TestHelpers.createTestDatabase(TEST_DB_NAME, {
      performanceMonitoring: true,
      cleanupEnabled: true
    });

    testCache = await TestHelpers.setupTestCache({
      ttl: CACHE_TTL_SECONDS,
      namespace: 'floor-plans-test'
    });

    performanceMetrics = TestHelpers.monitorPerformance('floor-plans-test', {
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      memoryUsage: 0,
      dbOperations: 0,
      cacheOperations: 0
    });

    // Initialize floor plan service with test configuration
    floorPlanService = new FloorPlanService(testDb, testCache, performanceMetrics);
  });

  afterAll(async () => {
    // Cleanup test resources
    await TestHelpers.cleanupTestDatabase(TEST_DB_NAME, {
      cleanupEnabled: true
    });
    await testCache.flushAll();
    await performanceMetrics.generateReport();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await testCache.flushAll();
  });

  describe('CRUD Operations', () => {
    it('should create a new floor plan with validation', async () => {
      const result = await floorPlanService.createFloorPlan(VALID_FLOOR_PLAN);

      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
      expect(result.status).toBe(FloorPlanStatus.DRAFT);
      expect(result.metadata.name).toBe(VALID_FLOOR_PLAN.metadata.name);

      // Verify cache population
      const cached = await testCache.get(`floor-plan:${result.id}`);
      expect(cached).toBeTruthy();
    }, 10000);

    it('should retrieve a floor plan with performance check', async () => {
      // Create test floor plan
      const created = await floorPlanService.createFloorPlan(VALID_FLOOR_PLAN);

      const startTime = Date.now();
      const result = await floorPlanService.getFloorPlan(created.id);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should update a floor plan and invalidate cache', async () => {
      // Create test floor plan
      const created = await floorPlanService.createFloorPlan(VALID_FLOOR_PLAN);

      const updateData = {
        metadata: {
          ...created.metadata,
          name: 'Updated Floor Plan'
        }
      };

      const result = await floorPlanService.updateFloorPlan(created.id, updateData);

      expect(result.metadata.name).toBe('Updated Floor Plan');
      expect(result.updatedAt).not.toBe(created.updatedAt);

      // Verify cache invalidation
      const cached = await testCache.get(`floor-plan:${created.id}`);
      expect(cached).toBeNull();
    });

    it('should delete a floor plan and clean up resources', async () => {
      // Create test floor plan
      const created = await floorPlanService.createFloorPlan(VALID_FLOOR_PLAN);

      await floorPlanService.deleteFloorPlan(created.id);

      // Verify deletion
      await expect(floorPlanService.getFloorPlan(created.id))
        .rejects
        .toThrow('Floor plan not found');

      // Verify cache cleanup
      const cached = await testCache.get(`floor-plan:${created.id}`);
      expect(cached).toBeNull();
    });
  });

  describe('Validation and Error Handling', () => {
    it('should validate floor plan data correctly', async () => {
      const result: IValidationResult = await floorPlanService.validateFloorPlan(VALID_FLOOR_PLAN);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid floor plan data', async () => {
      const invalidPlan = {
        ...VALID_FLOOR_PLAN,
        metadata: {
          ...VALID_FLOOR_PLAN.metadata,
          dimensions: {
            width: -1, // Invalid dimension
            height: 100,
            scale: 1
          }
        }
      };

      const result: IValidationResult = await floorPlanService.validateFloorPlan(invalidPlan);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'metadata.dimensions',
          code: 'INVALID_DIMENSIONS'
        })
      );
    });
  });

  describe('Performance and Caching', () => {
    it('should handle concurrent operations correctly', async () => {
      const operations = Array(5).fill(null).map(() => 
        floorPlanService.createFloorPlan({
          ...VALID_FLOOR_PLAN,
          metadata: {
            ...VALID_FLOOR_PLAN.metadata,
            name: `Concurrent Plan ${Math.random()}`
          }
        })
      );

      const results = await Promise.all(operations);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.id).toBeTruthy();
      });
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      const operations = Array(10).fill(null).map(async () => {
        const created = await floorPlanService.createFloorPlan(VALID_FLOOR_PLAN);
        await floorPlanService.getFloorPlan(created.id);
        await floorPlanService.updateFloorPlan(created.id, {
          metadata: { name: 'Updated' }
        });
        await floorPlanService.deleteFloorPlan(created.id);
      });

      await Promise.all(operations);
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 10);
    });
  });
});