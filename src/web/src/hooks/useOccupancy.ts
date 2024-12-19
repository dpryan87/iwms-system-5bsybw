// @package react ^18.0.0

import { useState, useEffect, useCallback } from 'react';
import { subscribeToSpace, unsubscribeFromSpace } from './useWebSocket';
import { OccupancyData, OccupancyFilter, OccupancyTrend, OccupancyAlert, AlertSeverity, isOccupancyData } from '../types/occupancy.types';

/**
 * Performance metrics interface for monitoring hook behavior
 */
interface PerformanceMetrics {
  lastUpdateTime: number;
  updateCount: number;
  errorCount: number;
  averageLatency: number;
  cacheHitRate: number;
}

/**
 * WebSocket connection status
 */
enum WebSocketStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  TTL: 5 * 60 * 1000, // 5 minutes
  MAX_ENTRIES: 1000,
  STALE_WHILE_REVALIDATE: true
};

/**
 * Alert thresholds for occupancy monitoring
 */
const ALERT_THRESHOLDS = {
  HIGH_UTILIZATION: 85,
  LOW_UTILIZATION: 15,
  CAPACITY_WARNING: 95
};

/**
 * Enhanced hook for managing real-time occupancy data with caching and error handling
 * @param spaceId - Unique identifier for the space being monitored
 * @param filter - Optional filter parameters for occupancy data
 */
export function useOccupancy(spaceId: string, filter?: OccupancyFilter) {
  // State management
  const [currentOccupancy, setCurrentOccupancy] = useState<OccupancyData | null>(null);
  const [occupancyTrend, setOccupancyTrend] = useState<OccupancyTrend | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<WebSocketStatus>(WebSocketStatus.DISCONNECTED);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    lastUpdateTime: Date.now(),
    updateCount: 0,
    errorCount: 0,
    averageLatency: 0,
    cacheHitRate: 0
  });

  // Cache management
  const occupancyCache = new Map<string, { data: OccupancyData; timestamp: number }>();

  /**
   * Validates and sanitizes incoming occupancy data
   */
  const validateOccupancyData = useCallback((data: unknown): OccupancyData | null => {
    try {
      if (!isOccupancyData(data)) {
        throw new Error('Invalid occupancy data format');
      }

      // Additional validation checks
      if (data.occupantCount < 0 || data.occupantCount > data.capacity) {
        throw new Error('Invalid occupant count');
      }

      return data;
    } catch (error) {
      handleError('Data validation failed', error);
      return null;
    }
  }, []);

  /**
   * Handles WebSocket connection errors with retry logic
   */
  const handleWebSocketError = useCallback(async (error: Error, retryCount: number = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000 * Math.pow(2, retryCount);

    setError(error);
    setConnectionStatus(WebSocketStatus.ERROR);
    setPerformanceMetrics(prev => ({
      ...prev,
      errorCount: prev.errorCount + 1
    }));

    if (retryCount < MAX_RETRIES) {
      setTimeout(() => {
        setConnectionStatus(WebSocketStatus.RECONNECTING);
        initializeWebSocket();
      }, RETRY_DELAY);
    }
  }, []);

  /**
   * Initializes WebSocket connection for real-time updates
   */
  const initializeWebSocket = useCallback(async () => {
    try {
      await subscribeToSpace(spaceId);
      setConnectionStatus(WebSocketStatus.CONNECTED);
      setError(null);
    } catch (error) {
      handleError('WebSocket initialization failed', error);
    }
  }, [spaceId]);

  /**
   * Handles incoming occupancy updates with caching
   */
  const handleOccupancyUpdate = useCallback((data: unknown) => {
    const startTime = performance.now();
    const validatedData = validateOccupancyData(data);

    if (validatedData) {
      // Update cache
      occupancyCache.set(validatedData.spaceId, {
        data: validatedData,
        timestamp: Date.now()
      });

      // Update state
      setCurrentOccupancy(validatedData);
      setPerformanceMetrics(prev => ({
        ...prev,
        lastUpdateTime: Date.now(),
        updateCount: prev.updateCount + 1,
        averageLatency: (prev.averageLatency * prev.updateCount + (performance.now() - startTime)) / (prev.updateCount + 1)
      }));

      // Check for alerts
      checkOccupancyAlerts(validatedData);
    }
  }, [validateOccupancyData]);

  /**
   * Checks occupancy data against thresholds and generates alerts
   */
  const checkOccupancyAlerts = useCallback((data: OccupancyData): OccupancyAlert | null => {
    if (data.utilizationRate >= ALERT_THRESHOLDS.CAPACITY_WARNING) {
      return {
        spaceId: data.spaceId,
        timestamp: new Date(),
        alertType: 'CAPACITY_EXCEEDED',
        message: `Space utilization at ${data.utilizationRate}% - approaching capacity`,
        threshold: ALERT_THRESHOLDS.CAPACITY_WARNING,
        severity: AlertSeverity.CRITICAL
      };
    }

    if (data.utilizationRate >= ALERT_THRESHOLDS.HIGH_UTILIZATION) {
      return {
        spaceId: data.spaceId,
        timestamp: new Date(),
        alertType: 'HIGH_UTILIZATION',
        message: `High space utilization detected: ${data.utilizationRate}%`,
        threshold: ALERT_THRESHOLDS.HIGH_UTILIZATION,
        severity: AlertSeverity.WARNING
      };
    }

    return null;
  }, []);

  /**
   * Handles errors with logging and state updates
   */
  const handleError = useCallback((message: string, error: unknown) => {
    const errorObject = error instanceof Error ? error : new Error(String(error));
    console.error(`Occupancy Hook Error: ${message}`, errorObject);
    setError(errorObject);
    setPerformanceMetrics(prev => ({
      ...prev,
      errorCount: prev.errorCount + 1
    }));
  }, []);

  /**
   * Refreshes occupancy data manually
   */
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      await initializeWebSocket();
    } catch (error) {
      handleError('Data refresh failed', error);
    } finally {
      setIsLoading(false);
    }
  }, [initializeWebSocket]);

  /**
   * Cleanup function for WebSocket connection
   */
  const cleanup = useCallback(() => {
    try {
      unsubscribeFromSpace(spaceId);
      occupancyCache.clear();
      setConnectionStatus(WebSocketStatus.DISCONNECTED);
    } catch (error) {
      handleError('Cleanup failed', error);
    }
  }, [spaceId]);

  // Initialize WebSocket connection and setup cleanup
  useEffect(() => {
    setIsLoading(true);
    initializeWebSocket()
      .finally(() => setIsLoading(false));

    return cleanup;
  }, [spaceId, initializeWebSocket, cleanup]);

  // Apply filters when filter prop changes
  useEffect(() => {
    if (filter && currentOccupancy) {
      const isWithinFilter = 
        currentOccupancy.utilizationRate >= filter.minUtilization &&
        currentOccupancy.utilizationRate <= filter.maxUtilization &&
        new Date(currentOccupancy.timestamp) >= filter.timeRange.start &&
        new Date(currentOccupancy.timestamp) <= filter.timeRange.end;

      if (!isWithinFilter) {
        setCurrentOccupancy(null);
      }
    }
  }, [filter, currentOccupancy]);

  return {
    currentOccupancy,
    occupancyTrend,
    isLoading,
    error,
    refreshData,
    connectionStatus,
    performanceMetrics
  };
}

export type {
  PerformanceMetrics,
  WebSocketStatus
};