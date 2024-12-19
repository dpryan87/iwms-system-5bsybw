/**
 * Root Reducer Configuration
 * Combines all feature-specific reducers with enhanced type safety and real-time update support
 * for the IWMS application's global state management.
 * @version 1.0.0
 */

// @package @reduxjs/toolkit v1.9.5
import { combineReducers } from '@reduxjs/toolkit';

// Import feature reducers
import { authReducer } from './auth.reducer';
import { floorPlanReducer } from './floor-plan.reducer';
import { leaseReducer } from './lease.reducer';
import { occupancyReducer } from './occupancy.reducer';
import { resourceReducer } from './resource.reducer';

// Import state types
import { AuthState } from '../../types/auth.types';
import { FloorPlanState } from './floor-plan.reducer';
import { ILeaseState } from './lease.reducer';
import { OccupancyState } from './occupancy.reducer';
import { ResourceState } from './resource.reducer';

/**
 * Comprehensive type definition for the global Redux state tree
 * Implements strict null checking and type safety for all state slices
 */
export interface RootState {
  /** Authentication and user session state */
  auth: AuthState;
  
  /** Floor plan management state with real-time updates */
  floorPlan: FloorPlanState;
  
  /** Lease management and document tracking state */
  lease: ILeaseState;
  
  /** Real-time occupancy monitoring state */
  occupancy: OccupancyState;
  
  /** Resource allocation and management state */
  resource: ResourceState;
}

/**
 * Root reducer combining all feature reducers with error boundary protection
 * Implements comprehensive error handling and state synchronization
 */
export const rootReducer = combineReducers<RootState>({
  auth: authReducer,
  floorPlan: floorPlanReducer,
  lease: leaseReducer,
  occupancy: occupancyReducer,
  resource: resourceReducer
});

/**
 * Type-safe selector for accessing the root state
 * Ensures proper typing for all state access throughout the application
 */
export type RootSelector<T> = (state: RootState) => T;

/**
 * Type guard to check if a state slice exists
 * Helps prevent runtime errors when accessing state properties
 */
export const hasStateSlice = <K extends keyof RootState>(
  state: Partial<RootState>,
  slice: K
): state is Required<Pick<RootState, K>> => {
  return state[slice] !== undefined;
};

/**
 * Error boundary HOC for reducer error handling
 * Prevents state corruption from unhandled reducer errors
 */
export const withErrorBoundary = (reducer: typeof rootReducer) => {
  return (state: RootState | undefined, action: any): RootState => {
    try {
      return reducer(state, action);
    } catch (error) {
      // Log error to monitoring service in production
      console.error('Reducer error:', error);
      
      // Return previous state to prevent corruption
      return state || reducer(undefined, { type: '@@INIT' });
    }
  };
};

// Export the error-protected root reducer as default
export default withErrorBoundary(rootReducer);