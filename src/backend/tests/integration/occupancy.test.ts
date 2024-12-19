/**
 * @fileoverview Integration tests for occupancy tracking and analysis functionality
 * @version 1.0.0
 * @package @tests/integration
 */

// Jest testing framework v29.5.0
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Container } from 'inversify'; // v6.0.x
import { performance } from 'perf_hooks';

// Internal imports
import { OccupancyService } from '../../src/core/occupancy/services/occupancy.service';
import { IOccupancyData, IOccupancyTrend } from '../../src/core/occupancy/interfaces/occupancy.interface';
import { setupTestEnvironment, teardownTestEnvironment } from '../utils/test-setup';
import { BMSService } from '../../src/integrations/bms/bms.service';
import { BMSSensorStatus } from '../../src/integrations/bms/interfaces/bms.interface';
import { logger } from '../../src/common/utils/logger.util';

// Test constants
const TEST_TIMEOUT = 30000;
const PERFORMANCE_THRESHOLD = 1000; // 1 second
const BATCH_SIZE = 100;
const TEST_SPACE_ID = '550e8400-e29b-41d4-a716-446655440000';

// Mock data
const mockOccupancyData: IOccupancyData = {
  spaceId: TEST_SPACE_ID,
  timestamp: new Date(),
  occupantCount: 25,
  capacity: 50,
  utilizationRate: 50,
  sensorMetadata: {
    sensorId: 'sensor-001',
    sensorType: 'infrared',
    accuracy: 98,
    lastCalibration: new Date(),
    manufacturer: 'SensorCorp',
    firmwareVersion: '2.1.0',
    batteryLevel: 85,
    connectionStatus: 'online'
  },
  dataSource: 'BMS',
  isValidated: true
};

describe('Occupancy Tracking Integration Tests', () => {
  let container: Container;
  let occupancyService: OccupancyService;
  let bmsService: BMSService;

  // Global test setup
  beforeAll(async () => {
    try {
      // Initialize test environment
      await setupTestEnvironment();

      // Setup dependency injection
      container = new Container();
      container.bind<OccupancyService>(OccupancyService).toSelf();
      container.bind<BMSService>(BMSService).toSelf();

      // Initialize services
      occupancyService = container.get<OccupancyService>(OccupancyService);
      bmsService = container.get<BMSService>(BMSService);

      // Connect to BMS
      await bmsService.connect({
        endpoint: process.env.TEST_BMS_ENDPOINT!,
        protocol: 'MQTT',
        credentials: {
          username: process.env.TEST_BMS_USERNAME!,
          password: process.env.TEST_BMS_PASSWORD!,
          clientId: `test-client-${Date.now()}`
        }
      });

      logger.info('Test environment initialized successfully');
    } catch (error) {
      logger.error('Test setup failed', error);
      throw error;
    }
  }, TEST_TIMEOUT);

  // Global test teardown
  afterAll(async () => {
    try {
      await bmsService.disconnect();
      await teardownTestEnvironment();
      container.unbindAll();
      logger.info('Test environment cleaned up successfully');
    } catch (error) {
      logger.error('Test teardown failed', error);
      throw error;
    }
  }, TEST_TIMEOUT);

  // Reset state before each test
  beforeEach(async () => {
    // Clear any cached data
    await occupancyService['occupancyCache'].clear();
  });

  describe('Real-time Occupancy Monitoring', () => {
    it('should receive and process real-time sensor updates', async () => {
      const startTime = performance.now();
      let updateReceived = false;

      // Subscribe to updates
      const subscription = occupancyService.subscribeToUpdates(TEST_SPACE_ID)
        .subscribe({
          next: (data) => {
            expect(data.spaceId).toBe(TEST_SPACE_ID);
            expect(data.occupantCount).toBeGreaterThanOrEqual(0);
            expect(data.utilizationRate).toBeLessThanOrEqual(100);
            updateReceived = true;
          },
          error: (error) => {
            throw error;
          }
        });

      // Simulate sensor update
      await occupancyService.updateOccupancyData(mockOccupancyData);

      // Wait for update
      await new Promise(resolve => setTimeout(resolve, 1000));
      subscription.unsubscribe();

      // Verify performance
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(updateReceived).toBe(true);
    }, TEST_TIMEOUT);

    it('should handle sensor connection interruptions gracefully', async () => {
      // Simulate network interruption
      await bmsService.disconnect();
      
      const result = await occupancyService.getCurrentOccupancy(TEST_SPACE_ID);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SENSOR_ERROR');

      // Restore connection
      await bmsService.connect({
        endpoint: process.env.TEST_BMS_ENDPOINT!,
        protocol: 'MQTT',
        credentials: {
          username: process.env.TEST_BMS_USERNAME!,
          password: process.env.TEST_BMS_PASSWORD!,
          clientId: `test-client-${Date.now()}`
        }
      });
    });

    it('should maintain data consistency during high update frequency', async () => {
      const updates: IOccupancyData[] = Array(BATCH_SIZE).fill(null).map((_, index) => ({
        ...mockOccupancyData,
        occupantCount: index % 50,
        timestamp: new Date(Date.now() + index * 1000)
      }));

      const result = await occupancyService.batchUpdateOccupancy(updates, {
        validateAll: true,
        continueOnError: false,
        maxConcurrent: 10
      });

      expect(result.success).toBe(true);
      expect(result.data?.successCount).toBe(BATCH_SIZE);
      expect(result.data?.failureCount).toBe(0);
    });
  });

  describe('Occupancy Analytics', () => {
    it('should calculate accurate utilization metrics', async () => {
      // Insert test data
      await occupancyService.updateOccupancyData(mockOccupancyData);

      const result = await occupancyService.getOccupancyTrends(
        TEST_SPACE_ID,
        {
          start: new Date(Date.now() - 3600000), // Last hour
          end: new Date()
        },
        {
          interval: 'hourly',
          includeAnomalies: true,
          smoothing: true
        }
      );

      expect(result.success).toBe(true);
      expect(result.data?.averageUtilization).toBeDefined();
      expect(result.data?.peakOccupancy).toBeGreaterThanOrEqual(0);
      expect(result.data?.dataPoints.length).toBeGreaterThan(0);
    });

    it('should handle large datasets efficiently', async () => {
      const startTime = performance.now();
      const timeRange = {
        start: new Date(Date.now() - 86400000), // Last 24 hours
        end: new Date()
      };

      const result = await occupancyService.getOccupancyTrends(
        TEST_SPACE_ID,
        timeRange,
        { interval: 'hourly' }
      );

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(result.success).toBe(true);
    });
  });

  describe('Data Validation and Security', () => {
    it('should validate sensor data accuracy', async () => {
      const invalidData = {
        ...mockOccupancyData,
        occupantCount: -1 // Invalid count
      };

      const result = await occupancyService.updateOccupancyData(invalidData, {
        validateSensor: true
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should meet performance SLA requirements', async () => {
      const startTime = performance.now();
      const promises = Array(10).fill(null).map(() => 
        occupancyService.getCurrentOccupancy(TEST_SPACE_ID)
      );

      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      expect(duration / 10).toBeLessThan(PERFORMANCE_THRESHOLD / 10);
      results.forEach(result => {
        expect(result.success).toBeDefined();
      });
    });
  });
});