// @package @reduxjs/toolkit v1.9.5

import { createReducer, PayloadAction, ActionReducerMapBuilder } from '@reduxjs/toolkit';
import {
  FloorPlan,
  FloorPlanSpace,
  FloorPlanStatus,
  FloorPlanMetadata,
  FloorPlanValidationState
} from '../../types/floor-plan.types';
import {
  setCurrentFloorPlan,
  loadFloorPlan,
  saveFloorPlan,
  addSpace,
  updateSpace,
  handleRealtimeUpdate
} from '../actions/floor-plan.actions';

/**
 * Interface for tracking floor plan changes
 */
interface FloorPlanChange {
  type: 'ADD' | 'UPDATE' | 'DELETE';
  timestamp: Date;
  data: Partial<FloorPlan>;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for floor plan error state
 */
interface FloorPlanError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Comprehensive floor plan state interface
 */
interface FloorPlanState {
  currentFloorPlan: FloorPlan | null;
  loading: boolean;
  error: FloorPlanError | null;
  saving: boolean;
  version: number;
  validationState: FloorPlanValidationState;
  lastModified: Date;
  pendingChanges: FloorPlanChange[];
}

/**
 * Initial state with proper type safety
 */
const initialState: FloorPlanState = {
  currentFloorPlan: null,
  loading: false,
  error: null,
  saving: false,
  version: 0,
  validationState: {
    valid: true,
    messages: []
  },
  lastModified: new Date(),
  pendingChanges: []
};

/**
 * Enhanced floor plan reducer with comprehensive state management
 */
export const floorPlanReducer = createReducer(
  initialState,
  (builder: ActionReducerMapBuilder<FloorPlanState>) => {
    builder
      // Handle setting current floor plan
      .addCase(setCurrentFloorPlan, (state, action: PayloadAction<FloorPlan | null>) => {
        state.currentFloorPlan = action.payload;
        state.lastModified = new Date();
        state.version++;
      })

      // Handle floor plan loading states
      .addCase(loadFloorPlan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadFloorPlan.fulfilled, (state, action: PayloadAction<FloorPlan>) => {
        state.loading = false;
        state.currentFloorPlan = action.payload;
        state.lastModified = new Date();
        state.version++;
        state.validationState = {
          valid: true,
          messages: []
        };
      })
      .addCase(loadFloorPlan.rejected, (state, action) => {
        state.loading = false;
        state.error = {
          code: 'LOAD_ERROR',
          message: action.error.message || 'Failed to load floor plan',
          details: action.error
        };
      })

      // Handle floor plan saving states with optimistic updates
      .addCase(saveFloorPlan.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(saveFloorPlan.fulfilled, (state, action: PayloadAction<FloorPlan>) => {
        state.saving = false;
        state.currentFloorPlan = action.payload;
        state.lastModified = new Date();
        state.version++;
        state.pendingChanges = [];
      })
      .addCase(saveFloorPlan.rejected, (state, action) => {
        state.saving = false;
        state.error = {
          code: 'SAVE_ERROR',
          message: action.error.message || 'Failed to save floor plan',
          details: action.error
        };
        // Revert optimistic update if needed
        if (state.pendingChanges.length > 0) {
          const lastValidState = state.pendingChanges[0].data as FloorPlan;
          state.currentFloorPlan = lastValidState;
          state.pendingChanges = [];
        }
      })

      // Handle space addition with validation
      .addCase(addSpace.fulfilled, (state, action: PayloadAction<FloorPlan>) => {
        state.currentFloorPlan = action.payload;
        state.lastModified = new Date();
        state.version++;
        state.pendingChanges.push({
          type: 'ADD',
          timestamp: new Date(),
          data: action.payload
        });
      })

      // Handle space updates with validation
      .addCase(updateSpace.fulfilled, (state, action: PayloadAction<FloorPlan>) => {
        state.currentFloorPlan = action.payload;
        state.lastModified = new Date();
        state.version++;
        state.pendingChanges.push({
          type: 'UPDATE',
          timestamp: new Date(),
          data: action.payload
        });
      })

      // Handle real-time updates
      .addCase(handleRealtimeUpdate, (state, action: PayloadAction<Partial<FloorPlan>>) => {
        if (state.currentFloorPlan && action.payload.id === state.currentFloorPlan.id) {
          state.currentFloorPlan = {
            ...state.currentFloorPlan,
            ...action.payload,
            metadata: {
              ...state.currentFloorPlan.metadata,
              ...action.payload.metadata,
              lastModified: new Date()
            }
          };
          state.lastModified = new Date();
          state.version++;
        }
      });
  }
);

export default floorPlanReducer;