/**
 * @fileoverview Unit tests for OccupancyService with comprehensive coverage
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { OccupancyService } from '../../../src/core/occupancy/services/occupancy.service';
import { IOccupancyData } from '../../../src/core/occupancy/interfaces/occupancy.interface';
import { TestDataGenerator } from '../../utils/test-helpers';
import { logger } from '../../../src/common/utils/logger.util';
import { ErrorCodes } from '../../../src/common/constants/error-codes';
import { VALIDATION_MESSAGES } from '../../../src/common/constants/messages';

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  GET_CURRENT_OCCUPANCY: 100, // ms
  GET_TRENDS: 200, // ms
  UPDATE_DATA: 50, // ms
  SUBSCRIPTION: 20 // ms
};

describe('OccupancyService', () => {
  let occupancyService: OccupancyService;
  let mockOccupancyRepository: jest.Mocked<any>;
  let mockBMSService: jest.Mocked<any>;
  let testDataGenerator: TestDataGenerator;
  let performanceMetrics: { [key: string]: number };

  beforeEach(() => {
    // Reset mocks and metrics
    performanceMetrics = {};
    mockOccupancyRepository = {
      getCurrentOccupancy: jest.fn(),
      getOccupancyTrends: jest.fn(),
      saveOccupancyData: jest.fn()
    };

    mockBMSService = {
      validateSensorHealth: jest.fn(),
      subscribeSensorUpdates: jest.fn()
    };

    occupancyService = new OccupancyService(
      mockOccupancyRepository,
      mockBMSService
    );

    testDataGenerator = new TestDataGenerator();
  });

  describe('getCurrentOccupancy', () => {
    const validSpaceId = 'space-123';
    let testOccupancyData: IOccupancyData;

    beforeEach(() => {
      testOccupancyData = {
        spaceId: validSpaceId,
        timestamp: new Date(),
        occupantCount: 10,
        capacity: 20,
        utilizationRate: 50,
        sensorMetadata: {
          sensorId: 'sensor-1',
          accuracy: 95,
          batteryLevel: 80,
          firmwareVersion: '1.0.0'
        },
        dataSource: 'sensor',
        isValidated: true
      };
    });

    it('should return current occupancy data with valid space ID', async () => {
      const startTime = performance.now();
      
      mockBMSService.validateSensorHealth.mockResolvedValue(true);
      mockOccupancyRepository.getCurrentOccupancy.mockResolvedValue(testOccupancyData);

      const result = await occupancyService.getCurrentOccupancy(validSpaceId);
      const executionTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toEqual(testOccupancyData);
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.GET_CURRENT_OCCUPANCY);
      
      performanceMetrics['getCurrentOccupancy'] = executionTime;
    });

    it('should handle sensor health validation failure', async () => {
      mockBMSService.validateSensorHealth.mockResolvedValue(false);

      const result = await occupancyService.getCurrentOccupancy(validSpaceId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SENSOR_ERROR');
    });

    it('should handle non-existent space ID', async () => {
      mockBMSService.validateSensorHealth.mockResolvedValue(true);
      mockOccupancyRepository.getCurrentOccupancy.mockResolvedValue(null);

      const result = await occupancyService.getCurrentOccupancy('non-existent');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should use cached data when available and valid', async () => {
      mockBMSService.validateSensorHealth.mockResolvedValue(true);
      mockOccupancyRepository.getCurrentOccupancy.mockResolvedValue(testOccupancyData);

      // First call to populate cache
      await occupancyService.getCurrentOccupancy(validSpaceId);
      
      // Second call should use cache
      const startTime = performance.now();
      const result = await occupancyService.getCurrentOccupancy(validSpaceId);
      const executionTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toEqual(testOccupancyData);
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.GET_CURRENT_OCCUPANCY / 2);
      expect(mockOccupancyRepository.getCurrentOccupancy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOccupancyTrends', () => {
    const validSpaceId = 'space-123';
    const timeRange = {
      start: new Date('2023-01-01'),
      end: new Date('2023-01-02')
    };

    it('should return occupancy trends with valid parameters', async () => {
      const trendData = testDataGenerator.generateTrendData();
      mockOccupancyRepository.getOccupancyTrends.mockResolvedValue(trendData);

      const startTime = performance.now();
      const result = await occupancyService.getOccupancyTrends(
        validSpaceId,
        timeRange,
        { interval: 'hourly', includeAnomalies: true }
      );
      const executionTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toEqual(trendData);
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.GET_TRENDS);
      
      performanceMetrics['getOccupancyTrends'] = executionTime;
    });

    it('should handle invalid time range', async () => {
      const invalidTimeRange = {
        start: new Date('2023-01-02'),
        end: new Date('2023-01-01')
      };

      const result = await occupancyService.getOccupancyTrends(
        validSpaceId,
        invalidTimeRange
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('updateOccupancyData', () => {
    let validOccupancyData: IOccupancyData;

    beforeEach(() => {
      validOccupancyData = testDataGenerator.generateOccupancyData();
    });

    it('should update occupancy data with validation', async () => {
      mockBMSService.validateSensorHealth.mockResolvedValue(true);
      mockOccupancyRepository.saveOccupancyData.mockResolvedValue(true);

      const startTime = performance.now();
      const result = await occupancyService.updateOccupancyData(
        validOccupancyData,
        { validateSensor: true }
      );
      const executionTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.UPDATE_DATA);
      
      performanceMetrics['updateOccupancyData'] = executionTime;
    });

    it('should handle sensor validation failure', async () => {
      mockBMSService.validateSensorHealth.mockResolvedValue(false);

      const result = await occupancyService.updateOccupancyData(
        validOccupancyData,
        { validateSensor: true }
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('subscribeToUpdates', () => {
    const validSpaceId = 'space-123';

    it('should establish subscription with backpressure handling', (done) => {
      const subscription = occupancyService.subscribeToUpdates(validSpaceId);
      const startTime = performance.now();

      subscription.subscribe({
        next: (data) => {
          const executionTime = performance.now() - startTime;
          expect(data).toBeDefined();
          expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SUBSCRIPTION);
          performanceMetrics['subscription'] = executionTime;
          done();
        },
        error: done
      });

      // Simulate occupancy update
      const updateData = testDataGenerator.generateOccupancyData();
      occupancyService.updateOccupancyData(updateData);
    });
  });

  describe('batchUpdateOccupancy', () => {
    it('should handle batch updates with concurrent processing', async () => {
      const batchData = Array(5).fill(null).map(() => 
        testDataGenerator.generateOccupancyData()
      );

      mockBMSService.validateSensorHealth.mockResolvedValue(true);
      mockOccupancyRepository.saveOccupancyData.mockResolvedValue(true);

      const result = await occupancyService.batchUpdateOccupancy(batchData, {
        validateAll: true,
        maxConcurrent: 2
      });

      expect(result.success).toBe(true);
      expect(result.data?.successCount).toBe(5);
      expect(result.data?.failureCount).toBe(0);
    });
  });

  afterEach(() => {
    // Log performance metrics
    logger.debug('Test performance metrics', { metrics: performanceMetrics });

    // Verify performance thresholds
    Object.entries(performanceMetrics).forEach(([operation, time]) => {
      const threshold = PERFORMANCE_THRESHOLDS[operation as keyof typeof PERFORMANCE_THRESHOLDS];
      if (time > threshold) {
        logger.warn(`Performance threshold exceeded for ${operation}`, {
          actual: time,
          threshold,
          difference: time - threshold
        });
      }
    });
  });
});