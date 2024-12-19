/**
 * Redux selectors for occupancy state management with enhanced performance and error handling
 * Implements memoized selectors for efficient state access and computation
 * @version 1.0.0
 * @package @reduxjs/toolkit@1.9.5
 */

import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../reducers';
import { OccupancyData } from '../../types/occupancy.types';

/**
 * Base selector to access the occupancy slice of state
 * Implements type-safe state access with null checking
 */
export const selectOccupancyState = (state: RootState) => state.occupancy || {
  currentOccupancy: {},
  trends: {},
  alerts: [],
  loadingStates: {},
  lastUpdated: {},
  errors: []
};

/**
 * Memoized selector for current occupancy data across all spaces
 * Provides optimized access to real-time occupancy information
 */
export const selectCurrentOccupancy = createSelector(
  [selectOccupancyState],
  (state) => state.currentOccupancy || {}
);

/**
 * Memoized selector for retrieving occupancy data for a specific space
 * Implements null checking and type safety
 * 
 * @param state - Root Redux state
 * @param spaceId - Target space identifier
 * @returns Occupancy data for the specified space or undefined if not found
 */
export const selectSpaceOccupancy = createSelector(
  [
    selectCurrentOccupancy,
    (_, spaceId: string) => spaceId
  ],
  (occupancy, spaceId): OccupancyData | undefined => occupancy[spaceId]
);

/**
 * Memoized selector for occupancy trends analysis
 * Provides efficient access to historical occupancy data
 */
export const selectOccupancyTrends = createSelector(
  [selectOccupancyState],
  (state) => state.trends || {}
);

/**
 * Memoized selector for active occupancy alerts
 * Filters and sorts alerts by severity and timestamp
 */
export const selectOccupancyAlerts = createSelector(
  [selectOccupancyState],
  (state) => state.alerts || []
);

/**
 * Memoized selector for occupancy loading states
 * Tracks loading status for different occupancy operations
 */
export const selectOccupancyLoading = createSelector(
  [selectOccupancyState],
  (state) => state.loadingStates || {}
);

/**
 * Memoized selector for occupancy error states
 * Provides access to error messages and codes
 */
export const selectOccupancyErrors = createSelector(
  [selectOccupancyState],
  (state) => state.errors || []
);

/**
 * Memoized selector for space utilization rates
 * Calculates current utilization percentage for each space
 */
export const selectSpaceUtilization = createSelector(
  [selectCurrentOccupancy],
  (occupancy): Record<string, number> => {
    const utilization: Record<string, number> = {};
    Object.entries(occupancy).forEach(([spaceId, data]) => {
      if (data && data.capacity > 0) {
        utilization[spaceId] = (data.occupantCount / data.capacity) * 100;
      } else {
        utilization[spaceId] = 0;
      }
    });
    return utilization;
  }
);

/**
 * Memoized selector for high utilization spaces
 * Identifies spaces exceeding specified utilization threshold
 * 
 * @param threshold - Utilization percentage threshold (default: 80)
 */
export const selectHighUtilizationSpaces = createSelector(
  [selectSpaceUtilization],
  (utilization, threshold: number = 80): string[] => {
    return Object.entries(utilization)
      .filter(([_, rate]) => rate >= threshold)
      .map(([spaceId]) => spaceId);
  }
);

/**
 * Memoized selector for last update timestamps
 * Tracks when each space's occupancy data was last updated
 */
export const selectLastUpdated = createSelector(
  [selectOccupancyState],
  (state) => state.lastUpdated || {}
);

/**
 * Memoized selector for checking if real-time updates are active
 * Monitors WebSocket connection status for occupancy updates
 */
export const selectIsRealTimeEnabled = createSelector(
  [selectOccupancyState],
  (state) => Boolean(state.loadingStates?.realtime)
);

/**
 * Memoized selector for aggregated occupancy statistics
 * Computes summary statistics across all monitored spaces
 */
export const selectOccupancyStats = createSelector(
  [selectCurrentOccupancy],
  (occupancy) => {
    const stats = {
      totalSpaces: 0,
      totalOccupants: 0,
      totalCapacity: 0,
      averageUtilization: 0
    };

    Object.values(occupancy).forEach(data => {
      if (data) {
        stats.totalSpaces++;
        stats.totalOccupants += data.occupantCount;
        stats.totalCapacity += data.capacity;
      }
    });

    stats.averageUtilization = stats.totalCapacity > 0
      ? (stats.totalOccupants / stats.totalCapacity) * 100
      : 0;

    return stats;
  }
);

/**
 * Type guard to ensure occupancy data validity
 * Implements runtime type checking for occupancy data
 */
const isValidOccupancyData = (data: unknown): data is OccupancyData => {
  return Boolean(
    data &&
    typeof (data as OccupancyData).spaceId === 'string' &&
    typeof (data as OccupancyData).occupantCount === 'number' &&
    typeof (data as OccupancyData).utilizationRate === 'number'
  );
};