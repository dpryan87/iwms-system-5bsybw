/**
 * Occupancy Service
 * Manages occupancy data and real-time space utilization tracking with enhanced reliability,
 * caching, and monitoring capabilities.
 * @version 1.0.0
 */

// External imports
import { Subject } from 'rxjs'; // v7.8.0
import { debounceTime, retry } from 'rxjs/operators'; // v7.8.0

// Internal imports
import { 
  getCurrentOccupancy,
  getOccupancyTrends,
  updateOccupancyData
} from '../api/occupancy.api';
import { 
  OccupancyData,
  OccupancyTrend,
  OccupancyFilter,
  OccupancyAlertType,
  AlertSeverity,
  OccupancyAlert
} from '../types/occupancy.types';
import { useWebSocket } from '../hooks/useWebSocket';

// Constants for configuration
const OCCUPANCY_UPDATE_DEBOUNCE = 1000; // 1 second debounce for updates
const MAX_RECONNECT_ATTEMPTS = 5;
const BATCH_SIZE = 100;
const CACHE_TTL = 300000; // 5 minutes cache TTL

// WebSocket event types
const WEBSOCKET_EVENTS = {
  OCCUPANCY_UPDATE: 'occupancy:update',
  SENSOR_ERROR: 'occupancy:error',
  BATCH_COMPLETE: 'occupancy:batch:complete',
  ALERT_TRIGGERED: 'occupancy:alert'
} as const;

// Local cache implementation
const occupancyCache = new Map<string, {
  data: OccupancyData;
  timestamp: number;
}>();

// Real-time update stream
const occupancyUpdateSubject = new Subject<OccupancyData>();

/**
 * Retrieves current occupancy data for a specific space with caching and error handling
 * @param spaceId - Unique identifier for the space
 * @returns Promise resolving to current occupancy data
 */
export async function fetchCurrentOccupancy(spaceId: string): Promise<OccupancyData> {
  try {
    // Check cache first
    const cached = occupancyCache.get(spaceId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Fetch fresh data with retry logic
    const occupancyData = await getCurrentOccupancy(spaceId).pipe(
      retry({
        count: 3,
        delay: 1000,
        resetOnSuccess: true
      })
    ).toPromise();

    if (!occupancyData) {
      throw new Error('Failed to fetch occupancy data');
    }

    // Update cache
    occupancyCache.set(spaceId, {
      data: occupancyData,
      timestamp: Date.now()
    });

    return occupancyData;
  } catch (error) {
    console.error('[OccupancyService] fetchCurrentOccupancy error:', error);
    throw error;
  }
}

/**
 * Retrieves occupancy trend analysis with enhanced error handling and caching
 * @param spaceId - Space identifier for trend analysis
 * @param filter - Filter parameters for trend data
 * @returns Promise resolving to occupancy trend data
 */
export async function fetchOccupancyTrends(
  spaceId: string,
  filter: OccupancyFilter
): Promise<OccupancyTrend> {
  try {
    // Validate filter parameters
    if (!filter.timeRange || filter.timeRange.end <= filter.timeRange.start) {
      throw new Error('Invalid time range for trend analysis');
    }

    // Fetch trend data with retry logic
    const trendData = await getOccupancyTrends(spaceId, filter).pipe(
      retry({
        count: 3,
        delay: 2000,
        resetOnSuccess: true
      })
    ).toPromise();

    if (!trendData) {
      throw new Error('Failed to fetch trend data');
    }

    return trendData;
  } catch (error) {
    console.error('[OccupancyService] fetchOccupancyTrends error:', error);
    throw error;
  }
}

/**
 * Processes batch updates for occupancy data efficiently
 * @param updates - Array of occupancy data updates
 * @returns Promise resolving to void on successful batch update
 */
export async function processOccupancyBatch(updates: OccupancyData[]): Promise<void> {
  try {
    // Validate batch data
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('Invalid batch update data');
    }

    // Process updates in chunks
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (update) => {
          try {
            await updateOccupancyData(update);
            // Update cache
            occupancyCache.set(update.spaceId, {
              data: update,
              timestamp: Date.now()
            });
          } catch (error) {
            console.error(`[OccupancyService] Batch update failed for space ${update.spaceId}:`, error);
          }
        })
      );
    }

    // Emit batch completion event
    occupancyUpdateSubject.next({
      type: WEBSOCKET_EVENTS.BATCH_COMPLETE,
      timestamp: Date.now()
    } as any);
  } catch (error) {
    console.error('[OccupancyService] processOccupancyBatch error:', error);
    throw error;
  }
}

/**
 * Manages occupancy alerts and notifications
 * @param data - Occupancy data to check
 * @param config - Alert configuration parameters
 */
export async function handleOccupancyAlerts(
  data: OccupancyData,
  config: {
    highUtilizationThreshold: number;
    lowUtilizationThreshold: number;
  }
): Promise<void> {
  try {
    const alerts: OccupancyAlert[] = [];

    // Check for high utilization
    if (data.utilizationRate >= config.highUtilizationThreshold) {
      alerts.push({
        spaceId: data.spaceId,
        timestamp: new Date(),
        alertType: OccupancyAlertType.HIGH_UTILIZATION,
        message: `Space utilization exceeds ${config.highUtilizationThreshold}%`,
        threshold: config.highUtilizationThreshold,
        severity: AlertSeverity.WARNING
      });
    }

    // Check for low utilization
    if (data.utilizationRate <= config.lowUtilizationThreshold) {
      alerts.push({
        spaceId: data.spaceId,
        timestamp: new Date(),
        alertType: OccupancyAlertType.LOW_UTILIZATION,
        message: `Space utilization below ${config.lowUtilizationThreshold}%`,
        threshold: config.lowUtilizationThreshold,
        severity: AlertSeverity.INFO
      });
    }

    // Check for capacity exceeded
    if (data.occupantCount > data.capacity) {
      alerts.push({
        spaceId: data.spaceId,
        timestamp: new Date(),
        alertType: OccupancyAlertType.CAPACITY_EXCEEDED,
        message: `Space capacity exceeded: ${data.occupantCount}/${data.capacity}`,
        threshold: data.capacity,
        severity: AlertSeverity.CRITICAL
      });
    }

    // Process alerts
    alerts.forEach(alert => {
      occupancyUpdateSubject.next({
        type: WEBSOCKET_EVENTS.ALERT_TRIGGERED,
        alert
      } as any);
    });
  } catch (error) {
    console.error('[OccupancyService] handleOccupancyAlerts error:', error);
    throw error;
  }
}

// Initialize WebSocket connection for real-time updates
const { state: wsState, connect } = useWebSocket(
  `${process.env.VITE_WS_URL}/occupancy`,
  {
    autoConnect: true,
    reconnectAttempts: MAX_RECONNECT_ATTEMPTS,
    heartbeatInterval: 30000
  }
);

// Setup real-time update handling
occupancyUpdateSubject
  .pipe(debounceTime(OCCUPANCY_UPDATE_DEBOUNCE))
  .subscribe({
    next: (update) => {
      if (wsState.connected) {
        // Handle real-time update
        occupancyCache.set(update.spaceId, {
          data: update,
          timestamp: Date.now()
        });
      }
    },
    error: (error) => {
      console.error('[OccupancyService] Update stream error:', error);
    }
  });

// Export service functions
export {
  fetchCurrentOccupancy,
  fetchOccupancyTrends,
  processOccupancyBatch,
  handleOccupancyAlerts
};