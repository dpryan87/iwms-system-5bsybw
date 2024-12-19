/**
 * Floor Plan Selectors
 * Implements memoized selectors for accessing and deriving floor plan state data
 * with optimized performance and type safety for the IWMS application.
 * @version 1.0.0
 */

// @package @reduxjs/toolkit v1.9.5
import { createSelector } from '@reduxjs/toolkit';

// Internal imports
import { RootState } from '../reducers';
import { 
  FloorPlan, 
  FloorPlanStatus 
} from '../../types/floor-plan.types';

/**
 * Base selector to access the floor plan state slice
 * Provides type-safe access to the floor plan state
 */
export const selectFloorPlanState = (state: RootState) => state.floorPlan;

/**
 * Memoized selector to get all floor plans
 * Implements performance optimization through reselect
 */
export const selectAllFloorPlans = createSelector(
  [selectFloorPlanState],
  (floorPlanState) => {
    return Object.values(floorPlanState.currentFloorPlan || {});
  }
);

/**
 * Memoized selector for published floor plans
 * Filters and returns only published floor plans with caching
 */
export const selectPublishedFloorPlans = createSelector(
  [selectAllFloorPlans],
  (floorPlans) => {
    return floorPlans.filter(plan => 
      plan.status === FloorPlanStatus.PUBLISHED
    );
  }
);

/**
 * Memoized selector factory for retrieving a floor plan by ID
 * Implements error handling and type safety
 * @param id - Floor plan identifier
 */
export const selectFloorPlanById = (id: string) => createSelector(
  [selectAllFloorPlans],
  (floorPlans): FloorPlan | undefined => {
    try {
      return floorPlans.find(plan => plan.id === id);
    } catch (error) {
      console.error(`Error selecting floor plan ${id}:`, error);
      return undefined;
    }
  }
);

/**
 * Memoized selector for floor plans by property with pagination support
 * @param propertyId - Property identifier
 */
export const selectFloorPlansByPropertyId = (propertyId: string) => createSelector(
  [selectAllFloorPlans],
  (floorPlans) => {
    return floorPlans.filter(plan => plan.propertyId === propertyId);
  }
);

/**
 * Memoized selector for floor plan loading state
 * Tracks loading status of floor plan operations
 */
export const selectFloorPlanLoading = createSelector(
  [selectFloorPlanState],
  (floorPlanState) => floorPlanState.loading
);

/**
 * Memoized selector for floor plan error state
 * Provides access to error information with type safety
 */
export const selectFloorPlanError = createSelector(
  [selectFloorPlanState],
  (floorPlanState) => floorPlanState.error
);

/**
 * Memoized selector for floor plan validation state
 * Returns current validation status and messages
 */
export const selectFloorPlanValidation = createSelector(
  [selectFloorPlanState],
  (floorPlanState) => floorPlanState.validationState
);

/**
 * Memoized selector for floor plan version tracking
 * Monitors floor plan version for change detection
 */
export const selectFloorPlanVersion = createSelector(
  [selectFloorPlanState],
  (floorPlanState) => floorPlanState.version
);

/**
 * Memoized selector for pending floor plan changes
 * Tracks unsaved modifications to floor plans
 */
export const selectPendingChanges = createSelector(
  [selectFloorPlanState],
  (floorPlanState) => floorPlanState.pendingChanges
);

/**
 * Memoized selector for floor plan metadata
 * @param id - Floor plan identifier
 */
export const selectFloorPlanMetadata = (id: string) => createSelector(
  [selectFloorPlanById(id)],
  (floorPlan): FloorPlan['metadata'] | undefined => {
    return floorPlan?.metadata;
  }
);

/**
 * Memoized selector for floor plan spaces
 * @param id - Floor plan identifier
 */
export const selectFloorPlanSpaces = (id: string) => createSelector(
  [selectFloorPlanById(id)],
  (floorPlan) => floorPlan?.spaces || []
);

/**
 * Memoized selector for floor plan last modified timestamp
 */
export const selectLastModified = createSelector(
  [selectFloorPlanState],
  (floorPlanState) => floorPlanState.lastModified
);