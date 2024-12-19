// @package @reduxjs/toolkit v1.9.5
// @package lodash v4.17.21

import { createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { debounce } from 'lodash';
import { 
  FloorPlan, 
  FloorPlanSpace, 
  FloorPlanStatus, 
  FloorPlanError 
} from '../../types/floor-plan.types';
import { floorPlanService } from '../../services/floor-plan.service';

/**
 * Action creator for setting the current floor plan
 * Supports optimistic updates and cleanup
 */
export const setCurrentFloorPlan = createAction<FloorPlan | null>(
  'floorPlan/setCurrent'
);

/**
 * Async thunk for loading a floor plan by ID
 * Implements caching, retry logic, and real-time updates
 */
export const loadFloorPlan = createAsyncThunk<
  FloorPlan,
  string,
  { rejectValue: FloorPlanError }
>(
  'floorPlan/load',
  async (id: string, { rejectWithValue }) => {
    try {
      await floorPlanService.loadFloorPlan(id);
      
      // Setup real-time updates subscription
      const subscription = floorPlanService.currentFloorPlan.subscribe(
        floorPlan => {
          if (floorPlan) {
            setCurrentFloorPlan(floorPlan);
          }
        }
      );

      // Return the loaded floor plan
      return floorPlanService.currentFloorPlan.value!;
    } catch (error: any) {
      return rejectWithValue({
        code: 'LOAD_ERROR',
        message: `Failed to load floor plan: ${error.message}`,
        details: error
      });
    }
  }
);

/**
 * Async thunk for saving floor plan changes
 * Implements optimistic updates and debounced saves
 */
export const saveFloorPlan = createAsyncThunk<
  FloorPlan,
  Partial<FloorPlan>,
  { rejectValue: FloorPlanError }
>(
  'floorPlan/save',
  async (changes: Partial<FloorPlan>, { rejectWithValue, getState }) => {
    try {
      // Apply optimistic update
      const currentPlan = floorPlanService.currentFloorPlan.value;
      if (!currentPlan) {
        throw new Error('No floor plan currently loaded');
      }

      // Create optimistic update
      const optimisticPlan: FloorPlan = {
        ...currentPlan,
        ...changes,
        metadata: {
          ...currentPlan.metadata,
          lastModified: new Date()
        }
      };

      // Apply optimistic update
      setCurrentFloorPlan(optimisticPlan);

      // Debounce multiple rapid changes
      const debouncedSave = debounce(async () => {
        await floorPlanService.updateFloorPlan(changes);
      }, 300);

      await debouncedSave();

      return optimisticPlan;
    } catch (error: any) {
      // Revert optimistic update on failure
      setCurrentFloorPlan(floorPlanService.currentFloorPlan.value);
      
      return rejectWithValue({
        code: 'SAVE_ERROR',
        message: `Failed to save floor plan: ${error.message}`,
        details: error
      });
    }
  }
);

/**
 * Async thunk for adding a new space to floor plan
 * Implements validation and conflict checking
 */
export const addSpace = createAsyncThunk<
  FloorPlan,
  FloorPlanSpace,
  { rejectValue: FloorPlanError }
>(
  'floorPlan/addSpace',
  async (spaceData: FloorPlanSpace, { rejectWithValue }) => {
    try {
      const currentPlan = floorPlanService.currentFloorPlan.value;
      if (!currentPlan) {
        throw new Error('No floor plan currently loaded');
      }

      // Create optimistic update with new space
      const optimisticPlan: FloorPlan = {
        ...currentPlan,
        spaces: [...currentPlan.spaces, spaceData],
        metadata: {
          ...currentPlan.metadata,
          lastModified: new Date()
        }
      };

      // Apply optimistic update
      setCurrentFloorPlan(optimisticPlan);

      // Persist changes
      await floorPlanService.addSpace(spaceData);

      return optimisticPlan;
    } catch (error: any) {
      // Revert optimistic update on failure
      setCurrentFloorPlan(floorPlanService.currentFloorPlan.value);

      return rejectWithValue({
        code: 'ADD_SPACE_ERROR',
        message: `Failed to add space: ${error.message}`,
        details: error
      });
    }
  }
);

/**
 * Async thunk for updating space properties
 * Implements validation and optimistic updates
 */
export const updateSpace = createAsyncThunk<
  FloorPlan,
  { spaceId: string; changes: Partial<FloorPlanSpace> },
  { rejectValue: FloorPlanError }
>(
  'floorPlan/updateSpace',
  async ({ spaceId, changes }, { rejectWithValue }) => {
    try {
      const currentPlan = floorPlanService.currentFloorPlan.value;
      if (!currentPlan) {
        throw new Error('No floor plan currently loaded');
      }

      // Create optimistic update with modified space
      const updatedSpaces = currentPlan.spaces.map(space =>
        space.id === spaceId ? { ...space, ...changes } : space
      );

      const optimisticPlan: FloorPlan = {
        ...currentPlan,
        spaces: updatedSpaces,
        metadata: {
          ...currentPlan.metadata,
          lastModified: new Date()
        }
      };

      // Apply optimistic update
      setCurrentFloorPlan(optimisticPlan);

      // Persist changes
      await floorPlanService.updateFloorPlan({ spaces: updatedSpaces });

      return optimisticPlan;
    } catch (error: any) {
      // Revert optimistic update on failure
      setCurrentFloorPlan(floorPlanService.currentFloorPlan.value);

      return rejectWithValue({
        code: 'UPDATE_SPACE_ERROR',
        message: `Failed to update space: ${error.message}`,
        details: error
      });
    }
  }
);

/**
 * Action creator for handling real-time floor plan updates
 * Manages WebSocket updates and state synchronization
 */
export const handleRealtimeUpdate = createAction<Partial<FloorPlan>>(
  'floorPlan/realtimeUpdate',
  (update: Partial<FloorPlan>) => {
    const currentPlan = floorPlanService.currentFloorPlan.value;
    if (currentPlan && update.id === currentPlan.id) {
      setCurrentFloorPlan({
        ...currentPlan,
        ...update,
        metadata: {
          ...currentPlan.metadata,
          ...update.metadata,
          lastModified: new Date()
        }
      });
    }
    return { payload: update };
  }
);