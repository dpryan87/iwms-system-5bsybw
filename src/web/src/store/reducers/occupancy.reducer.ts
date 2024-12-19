/**
 * @fileoverview Redux reducer for managing occupancy-related state with enhanced error handling
 * @version 1.0.0
 * @package @reduxjs/toolkit@1.9.5
 */

import { createReducer, PayloadAction } from '@reduxjs/toolkit';
import { 
  OccupancyData, 
  OccupancyTrend, 
  OccupancyAlert, 
  OccupancyAlertType,
  AlertSeverity,
  isOccupancyData,
  isOccupancyAlert
} from '../../types/occupancy.types';

/**
 * Enumeration of occupancy operation types for loading state tracking
 */
export enum OccupancyOperationType {
  FETCH = 'FETCH',
  UPDATE = 'UPDATE',
  ANALYZE = 'ANALYZE',
  ALERT = 'ALERT'
}

/**
 * Interface for occupancy error state
 */
interface OccupancyError {
  message: string;
  code: string;
  timestamp: Date;
}

/**
 * Interface defining the shape of the occupancy slice of Redux state
 */
export interface OccupancyState {
  currentOccupancy: Record<string, OccupancyData>;
  trends: Record<string, OccupancyTrend>;
  alerts: OccupancyAlert[];
  loadingStates: Record<OccupancyOperationType, boolean>;
  lastUpdated: Record<string, Date>;
  errors: OccupancyError[];
}

/**
 * Initial state for the occupancy reducer
 */
const INITIAL_STATE: OccupancyState = {
  currentOccupancy: {},
  trends: {},
  alerts: [],
  loadingStates: {
    [OccupancyOperationType.FETCH]: false,
    [OccupancyOperationType.UPDATE]: false,
    [OccupancyOperationType.ANALYZE]: false,
    [OccupancyOperationType.ALERT]: false
  },
  lastUpdated: {},
  errors: []
};

/**
 * Timeout duration for error messages in milliseconds
 */
const ERROR_TIMEOUT = 5000;

/**
 * Creates the occupancy reducer with enhanced error handling and performance optimizations
 */
export const occupancyReducer = createReducer(INITIAL_STATE, (builder) => {
  builder
    // Set loading state for operations
    .addCase('occupancy/setLoading', (state, action: PayloadAction<{
      operationType: OccupancyOperationType;
      isLoading: boolean;
    }>) => {
      state.loadingStates[action.payload.operationType] = action.payload.isLoading;
    })

    // Update current occupancy data with validation
    .addCase('occupancy/setCurrentOccupancy', (state, action: PayloadAction<{
      spaceId: string;
      data: OccupancyData;
    }>) => {
      const { spaceId, data } = action.payload;
      
      if (!isOccupancyData(data)) {
        state.errors.push({
          message: 'Invalid occupancy data format',
          code: 'INVALID_DATA',
          timestamp: new Date()
        });
        return;
      }

      state.currentOccupancy[spaceId] = data;
      state.lastUpdated[spaceId] = new Date();
    })

    // Update occupancy trends with validation
    .addCase('occupancy/setTrend', (state, action: PayloadAction<{
      spaceId: string;
      trend: OccupancyTrend;
    }>) => {
      const { spaceId, trend } = action.payload;
      
      // Validate trend data points
      const validDataPoints = trend.dataPoints.every(isOccupancyData);
      if (!validDataPoints) {
        state.errors.push({
          message: 'Invalid trend data points',
          code: 'INVALID_TREND',
          timestamp: new Date()
        });
        return;
      }

      state.trends[spaceId] = trend;
      state.lastUpdated[spaceId] = new Date();
    })

    // Add occupancy alert with priority handling
    .addCase('occupancy/addAlert', (state, action: PayloadAction<OccupancyAlert>) => {
      if (!isOccupancyAlert(action.payload)) {
        state.errors.push({
          message: 'Invalid alert format',
          code: 'INVALID_ALERT',
          timestamp: new Date()
        });
        return;
      }

      // Add alert and sort by severity and timestamp
      state.alerts.push(action.payload);
      state.alerts.sort((a, b) => {
        const severityOrder = {
          [AlertSeverity.CRITICAL]: 0,
          [AlertSeverity.WARNING]: 1,
          [AlertSeverity.INFO]: 2
        };
        
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
    })

    // Clear resolved alerts
    .addCase('occupancy/clearAlert', (state, action: PayloadAction<{
      spaceId: string;
      alertType: OccupancyAlertType;
    }>) => {
      state.alerts = state.alerts.filter(alert => 
        !(alert.spaceId === action.payload.spaceId && 
          alert.alertType === action.payload.alertType)
      );
    })

    // Clear errors after timeout
    .addCase('occupancy/clearErrors', (state) => {
      const now = new Date().getTime();
      state.errors = state.errors.filter(error => 
        now - error.timestamp.getTime() < ERROR_TIMEOUT
      );
    })

    // Handle error recovery
    .addCase('occupancy/recoverFromError', (state, action: PayloadAction<{
      spaceId: string;
      operationType: OccupancyOperationType;
    }>) => {
      const { spaceId, operationType } = action.payload;
      
      // Reset loading state
      state.loadingStates[operationType] = false;
      
      // Remove related errors
      state.errors = state.errors.filter(error => 
        !(error.code.includes(operationType) && error.message.includes(spaceId))
      );
    });
});

export default occupancyReducer;