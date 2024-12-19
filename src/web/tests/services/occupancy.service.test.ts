// @package jest ^29.0.0
// @package ws ^8.0.0

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { MockedFunction } from 'jest-mock';
import WS from 'ws';

import {
  fetchCurrentOccupancy,
  fetchOccupancyTrends,
  subscribeToOccupancyUpdates,
  processOccupancyUpdate
} from '../../src/services/occupancy.service';

import {
  OccupancyData,
  OccupancyTrend,
  OccupancyAlertType,
  AlertSeverity
} from '../../src/types/occupancy.types';

// Mock data constants
const MOCK_SPACE_ID = 'test-space-123';
const MOCK_OCCUPANCY_DATA: OccupancyData = {
  spaceId: MOCK_SPACE_ID,
  occupantCount: 50,
  capacity: 100,
  timestamp: new Date('2023-01-01T00:00:00Z'),
  utilizationRate: 50
};

const MOCK_TREND_DATA: OccupancyTrend = {
  spaceId: MOCK_SPACE_ID,
  timeRange: {
    start: new Date('2023-01-01T00:00:00Z'),
    end: new Date('2023-01-02T00:00:00Z')
  },
  averageUtilization: 45,
  peakOccupancy: 75,
  dataPoints: []
};

// Mock WebSocket server for testing
let mockWebSocketServer: WS.Server;

describe('Occupancy Service Tests', () => {
  beforeEach(() => {
    // Setup WebSocket mock server
    mockWebSocketServer = new WS.Server({ port: 8080 });
    jest.useFakeTimers();
  });

  afterEach(() => {
    mockWebSocketServer.close();
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('fetchCurrentOccupancy', () => {
    test('should successfully fetch current occupancy data', async () => {
      const mockFetch = jest.fn().mockResolvedValue(MOCK_OCCUPANCY_DATA);
      global.fetch = mockFetch;

      const result = await fetchCurrentOccupancy(MOCK_SPACE_ID);
      
      expect(result).toEqual(MOCK_OCCUPANCY_DATA);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(MOCK_SPACE_ID)
      );
    });

    test('should handle invalid space ID', async () => {
      await expect(fetchCurrentOccupancy('')).rejects.toThrow('Invalid space ID');
    });

    test('should handle API failure', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('API Error'));
      global.fetch = mockFetch;

      await expect(fetchCurrentOccupancy(MOCK_SPACE_ID)).rejects.toThrow('API Error');
    });

    test('should validate occupancy data structure', async () => {
      const invalidData = { ...MOCK_OCCUPANCY_DATA, utilizationRate: 150 };
      const mockFetch = jest.fn().mockResolvedValue(invalidData);
      global.fetch = mockFetch;

      await expect(fetchCurrentOccupancy(MOCK_SPACE_ID))
        .rejects.toThrow('Invalid utilization rate');
    });
  });

  describe('fetchOccupancyTrends', () => {
    test('should fetch and validate trend data', async () => {
      const mockFetch = jest.fn().mockResolvedValue(MOCK_TREND_DATA);
      global.fetch = mockFetch;

      const result = await fetchOccupancyTrends(MOCK_SPACE_ID, {
        timeRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-01-02')
        }
      });

      expect(result).toEqual(MOCK_TREND_DATA);
      expect(result.averageUtilization).toBeLessThanOrEqual(100);
      expect(result.peakOccupancy).toBeLessThanOrEqual(result.dataPoints.length);
    });

    test('should handle invalid date range', async () => {
      await expect(fetchOccupancyTrends(MOCK_SPACE_ID, {
        timeRange: {
          start: new Date('2023-01-02'),
          end: new Date('2023-01-01')
        }
      })).rejects.toThrow('Invalid time range');
    });

    test('should handle large datasets efficiently', async () => {
      const largeDataset = {
        ...MOCK_TREND_DATA,
        dataPoints: Array(1000).fill(MOCK_OCCUPANCY_DATA)
      };
      const mockFetch = jest.fn().mockResolvedValue(largeDataset);
      global.fetch = mockFetch;

      const startTime = performance.now();
      const result = await fetchOccupancyTrends(MOCK_SPACE_ID, {
        timeRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-01-02')
        }
      });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Performance benchmark
      expect(result.dataPoints).toHaveLength(1000);
    });
  });

  describe('subscribeToOccupancyUpdates', () => {
    test('should establish WebSocket connection and handle updates', done => {
      const mockCallback = jest.fn();
      const subscription = subscribeToOccupancyUpdates(MOCK_SPACE_ID, mockCallback);

      mockWebSocketServer.on('connection', socket => {
        socket.send(JSON.stringify({
          type: 'occupancy:update',
          data: MOCK_OCCUPANCY_DATA
        }));
      });

      setTimeout(() => {
        expect(mockCallback).toHaveBeenCalledWith(MOCK_OCCUPANCY_DATA);
        subscription();
        done();
      }, 100);
    });

    test('should handle reconnection on connection loss', done => {
      const mockCallback = jest.fn();
      subscribeToOccupancyUpdates(MOCK_SPACE_ID, mockCallback);

      mockWebSocketServer.close();
      mockWebSocketServer = new WS.Server({ port: 8080 });

      setTimeout(() => {
        expect(mockCallback).toHaveBeenCalledWith(expect.any(Object));
        done();
      }, 1000);
    });

    test('should clean up resources on unsubscribe', () => {
      const mockCallback = jest.fn();
      const unsubscribe = subscribeToOccupancyUpdates(MOCK_SPACE_ID, mockCallback);

      unsubscribe();

      expect(mockWebSocketServer.clients.size).toBe(0);
    });
  });

  describe('processOccupancyUpdate', () => {
    test('should validate and process occupancy updates', () => {
      const result = processOccupancyUpdate(MOCK_OCCUPANCY_DATA);

      expect(result).toEqual({
        success: true,
        data: MOCK_OCCUPANCY_DATA
      });
    });

    test('should handle capacity exceeded alerts', () => {
      const overCapacityData = {
        ...MOCK_OCCUPANCY_DATA,
        occupantCount: 150
      };

      const result = processOccupancyUpdate(overCapacityData);

      expect(result).toEqual({
        success: true,
        data: overCapacityData,
        alert: {
          type: OccupancyAlertType.CAPACITY_EXCEEDED,
          severity: AlertSeverity.CRITICAL,
          message: expect.stringContaining('exceeded')
        }
      });
    });

    test('should handle concurrent updates', async () => {
      const updates = Array(10).fill(MOCK_OCCUPANCY_DATA).map((data, index) => ({
        ...data,
        occupantCount: 50 + index
      }));

      const results = await Promise.all(
        updates.map(update => processOccupancyUpdate(update))
      );

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should validate data integrity', () => {
      const invalidData = {
        ...MOCK_OCCUPANCY_DATA,
        utilizationRate: -10
      };

      expect(() => processOccupancyUpdate(invalidData))
        .toThrow('Invalid utilization rate');
    });
  });

  describe('Performance Tests', () => {
    test('should handle high-frequency updates', async () => {
      const updateCount = 1000;
      const startTime = performance.now();
      
      for (let i = 0; i < updateCount; i++) {
        await processOccupancyUpdate({
          ...MOCK_OCCUPANCY_DATA,
          occupantCount: Math.floor(Math.random() * 100)
        });
      }

      const endTime = performance.now();
      const timePerUpdate = (endTime - startTime) / updateCount;

      expect(timePerUpdate).toBeLessThan(1); // Less than 1ms per update
    });

    test('should maintain performance under load', async () => {
      const concurrentRequests = 50;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        fetchCurrentOccupancy(MOCK_SPACE_ID)
      );

      const startTime = performance.now();
      await Promise.all(requests);
      const endTime = performance.now();

      const averageTime = (endTime - startTime) / concurrentRequests;
      expect(averageTime).toBeLessThan(100); // Less than 100ms per request
    });
  });
});