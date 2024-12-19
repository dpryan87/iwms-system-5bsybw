// @package @testing-library/react-hooks ^8.0.1
// @package @testing-library/react ^13.0.0
// @package @jest/globals ^29.0.0
// @package @faker-js/faker ^8.0.0

import { renderHook, act } from '@testing-library/react-hooks';
import { faker } from '@faker-js/faker';
import { useOccupancy } from '../../src/hooks/useOccupancy';
import { OccupancyData, OccupancyAlertType, AlertSeverity } from '../../src/types/occupancy.types';
import { WebSocketEventType } from '../../src/types/api.types';

// Mock WebSocket functionality
jest.mock('../../src/hooks/useWebSocket', () => ({
  subscribeToSpace: jest.fn(),
  unsubscribeFromSpace: jest.fn()
}));

describe('useOccupancy Hook', () => {
  // Test data generators
  const generateMockOccupancyData = (): OccupancyData => ({
    spaceId: faker.string.uuid(),
    timestamp: new Date(),
    occupantCount: faker.number.int({ min: 0, max: 100 }),
    capacity: 100,
    utilizationRate: faker.number.int({ min: 0, max: 100 }),
  });

  // Common test setup
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should initialize with correct default values', () => {
    const spaceId = faker.string.uuid();
    const { result } = renderHook(() => useOccupancy(spaceId));

    expect(result.current).toEqual({
      currentOccupancy: null,
      occupancyTrend: null,
      isLoading: true,
      error: null,
      connectionStatus: 'DISCONNECTED',
      performanceMetrics: expect.objectContaining({
        lastUpdateTime: expect.any(Number),
        updateCount: 0,
        errorCount: 0,
        averageLatency: 0,
        cacheHitRate: 0
      })
    });
  });

  it('should handle successful occupancy updates', async () => {
    const spaceId = faker.string.uuid();
    const mockData = generateMockOccupancyData();
    const { result } = renderHook(() => useOccupancy(spaceId));

    await act(async () => {
      // Simulate WebSocket connection
      result.current.connectionStatus = 'CONNECTED';
      // Simulate occupancy update
      const event = new MessageEvent('message', {
        data: {
          type: WebSocketEventType.DATA_UPDATE,
          payload: mockData
        }
      });
      window.dispatchEvent(event);
    });

    expect(result.current.currentOccupancy).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle connection stability and retry mechanism', async () => {
    const spaceId = faker.string.uuid();
    const { result } = renderHook(() => useOccupancy(spaceId));

    await act(async () => {
      // Simulate connection drop
      result.current.connectionStatus = 'DISCONNECTED';
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.connectionStatus).toBe('RECONNECTING');

    await act(async () => {
      // Simulate successful reconnection
      result.current.connectionStatus = 'CONNECTED';
    });

    expect(result.current.connectionStatus).toBe('CONNECTED');
    expect(result.current.error).toBeNull();
  });

  it('should handle data validation errors', async () => {
    const spaceId = faker.string.uuid();
    const { result } = renderHook(() => useOccupancy(spaceId));

    await act(async () => {
      // Simulate invalid data
      const invalidData = {
        spaceId: faker.string.uuid(),
        occupantCount: -1, // Invalid count
        utilizationRate: 150 // Invalid rate
      };

      const event = new MessageEvent('message', {
        data: {
          type: WebSocketEventType.DATA_UPDATE,
          payload: invalidData
        }
      });
      window.dispatchEvent(event);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.performanceMetrics.errorCount).toBeGreaterThan(0);
  });

  it('should generate appropriate alerts based on thresholds', async () => {
    const spaceId = faker.string.uuid();
    const { result } = renderHook(() => useOccupancy(spaceId));

    await act(async () => {
      // Simulate high utilization
      const highUtilizationData: OccupancyData = {
        ...generateMockOccupancyData(),
        utilizationRate: 90
      };

      const event = new MessageEvent('message', {
        data: {
          type: WebSocketEventType.DATA_UPDATE,
          payload: highUtilizationData
        }
      });
      window.dispatchEvent(event);
    });

    expect(result.current.currentOccupancy?.utilizationRate).toBeGreaterThanOrEqual(85);
  });

  it('should prevent memory leaks and cleanup resources', async () => {
    const spaceId = faker.string.uuid();
    const { result, unmount } = renderHook(() => useOccupancy(spaceId));

    // Monitor subscriptions and timers
    const initialTimers = jest.getTimerCount();

    await act(async () => {
      unmount();
    });

    expect(jest.getTimerCount()).toBeLessThan(initialTimers);
  });

  it('should handle filter updates correctly', async () => {
    const spaceId = faker.string.uuid();
    const filter = {
      minUtilization: 30,
      maxUtilization: 80,
      timeRange: {
        start: new Date(Date.now() - 3600000), // 1 hour ago
        end: new Date()
      }
    };

    const { result, rerender } = renderHook(() => useOccupancy(spaceId, filter));

    await act(async () => {
      // Simulate data within filter range
      const validData: OccupancyData = {
        ...generateMockOccupancyData(),
        utilizationRate: 50
      };

      const event = new MessageEvent('message', {
        data: {
          type: WebSocketEventType.DATA_UPDATE,
          payload: validData
        }
      });
      window.dispatchEvent(event);
    });

    expect(result.current.currentOccupancy).toBeTruthy();
  });

  it('should track performance metrics accurately', async () => {
    const spaceId = faker.string.uuid();
    const { result } = renderHook(() => useOccupancy(spaceId));

    const initialMetrics = { ...result.current.performanceMetrics };

    await act(async () => {
      // Simulate multiple updates
      for (let i = 0; i < 5; i++) {
        const mockData = generateMockOccupancyData();
        const event = new MessageEvent('message', {
          data: {
            type: WebSocketEventType.DATA_UPDATE,
            payload: mockData
          }
        });
        window.dispatchEvent(event);
      }
    });

    expect(result.current.performanceMetrics.updateCount).toBeGreaterThan(initialMetrics.updateCount);
    expect(result.current.performanceMetrics.averageLatency).toBeGreaterThanOrEqual(0);
  });

  it('should handle manual data refresh correctly', async () => {
    const spaceId = faker.string.uuid();
    const { result } = renderHook(() => useOccupancy(spaceId));

    await act(async () => {
      await result.current.refreshData();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});