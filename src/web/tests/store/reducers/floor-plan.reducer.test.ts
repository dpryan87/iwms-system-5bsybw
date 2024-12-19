// @package @jest/globals v29.0.0

import { describe, it, expect, beforeEach } from '@jest/globals';
import { floorPlanReducer } from '../../../src/store/reducers/floor-plan.reducer';
import {
  setCurrentFloorPlan,
  loadFloorPlan,
  saveFloorPlan,
  addSpace,
  updateSpace,
  handleRealtimeUpdate
} from '../../../src/store/actions/floor-plan.actions';
import {
  FloorPlan,
  FloorPlanSpace,
  FloorPlanStatus,
  SpaceType,
  FloorPlanValidationState
} from '../../../src/types/floor-plan.types';

describe('Floor Plan Reducer', () => {
  // Initial state validation
  describe('Initial State', () => {
    it('should return the initial state', () => {
      const initialState = floorPlanReducer(undefined, { type: '' });
      expect(initialState).toEqual({
        currentFloorPlan: null,
        loading: false,
        error: null,
        saving: false,
        version: 0,
        validationState: {
          valid: true,
          messages: []
        },
        lastModified: expect.any(Date),
        pendingChanges: []
      });
    });
  });

  // Floor Plan Loading Operations
  describe('Floor Plan Loading', () => {
    const mockFloorPlan: FloorPlan = {
      id: 'test-floor-1',
      metadata: {
        name: 'Test Floor',
        level: 1,
        totalArea: 1000,
        usableArea: 900,
        dimensions: {
          width: 100,
          height: 100,
          scale: 1,
          unit: 'METRIC'
        },
        fileUrl: 'test.dwg',
        lastModified: new Date(),
        version: '1.0.0',
        customFields: {}
      },
      spaces: [],
      status: FloorPlanStatus.DRAFT
    };

    it('should handle loadFloorPlan.pending', () => {
      const state = floorPlanReducer(undefined, loadFloorPlan.pending('', 'test-floor-1'));
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle loadFloorPlan.fulfilled', () => {
      const state = floorPlanReducer(
        undefined,
        loadFloorPlan.fulfilled(mockFloorPlan, '', 'test-floor-1')
      );
      expect(state.loading).toBe(false);
      expect(state.currentFloorPlan).toEqual(mockFloorPlan);
      expect(state.version).toBe(1);
      expect(state.validationState.valid).toBe(true);
    });

    it('should handle loadFloorPlan.rejected', () => {
      const error = new Error('Failed to load floor plan');
      const state = floorPlanReducer(
        undefined,
        loadFloorPlan.rejected(error, '', 'test-floor-1')
      );
      expect(state.loading).toBe(false);
      expect(state.error).toEqual({
        code: 'LOAD_ERROR',
        message: 'Failed to load floor plan',
        details: error
      });
    });
  });

  // Floor Plan Saving Operations
  describe('Floor Plan Saving', () => {
    const mockFloorPlan: FloorPlan = {
      id: 'test-floor-1',
      metadata: {
        name: 'Test Floor',
        level: 1,
        totalArea: 1000,
        usableArea: 900,
        dimensions: {
          width: 100,
          height: 100,
          scale: 1,
          unit: 'METRIC'
        },
        fileUrl: 'test.dwg',
        lastModified: new Date(),
        version: '1.0.0',
        customFields: {}
      },
      spaces: [],
      status: FloorPlanStatus.DRAFT
    };

    it('should handle saveFloorPlan.pending', () => {
      const state = floorPlanReducer(undefined, saveFloorPlan.pending('', {}));
      expect(state.saving).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle saveFloorPlan.fulfilled', () => {
      const state = floorPlanReducer(
        undefined,
        saveFloorPlan.fulfilled(mockFloorPlan, '', {})
      );
      expect(state.saving).toBe(false);
      expect(state.currentFloorPlan).toEqual(mockFloorPlan);
      expect(state.version).toBe(1);
      expect(state.pendingChanges).toEqual([]);
    });

    it('should handle saveFloorPlan.rejected with pending changes', () => {
      const initialState = {
        ...floorPlanReducer(undefined, { type: '' }),
        pendingChanges: [{
          type: 'UPDATE',
          timestamp: new Date(),
          data: mockFloorPlan
        }]
      };

      const error = new Error('Failed to save floor plan');
      const state = floorPlanReducer(
        initialState,
        saveFloorPlan.rejected(error, '', {})
      );
      expect(state.saving).toBe(false);
      expect(state.error).toEqual({
        code: 'SAVE_ERROR',
        message: 'Failed to save floor plan',
        details: error
      });
      expect(state.currentFloorPlan).toEqual(mockFloorPlan);
    });
  });

  // Space Management Operations
  describe('Space Management', () => {
    const mockSpace: FloorPlanSpace = {
      id: 'space-1',
      name: 'Test Space',
      type: SpaceType.OFFICE,
      coordinates: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 10, z: 0 },
        { x: 0, y: 10, z: 0 }
      ],
      area: 100,
      capacity: 10,
      assignedBusinessUnit: null,
      resources: [],
      occupancyStatus: 'VACANT'
    };

    it('should handle addSpace.fulfilled', () => {
      const mockFloorPlan: FloorPlan = {
        ...mockFloorPlan,
        spaces: [mockSpace]
      };

      const state = floorPlanReducer(
        undefined,
        addSpace.fulfilled(mockFloorPlan, '', mockSpace)
      );
      expect(state.currentFloorPlan).toEqual(mockFloorPlan);
      expect(state.version).toBe(1);
      expect(state.pendingChanges).toHaveLength(1);
      expect(state.pendingChanges[0].type).toBe('ADD');
    });

    it('should handle updateSpace.fulfilled', () => {
      const updatedSpace = {
        ...mockSpace,
        name: 'Updated Space'
      };
      const mockFloorPlan: FloorPlan = {
        ...mockFloorPlan,
        spaces: [updatedSpace]
      };

      const state = floorPlanReducer(
        undefined,
        updateSpace.fulfilled(mockFloorPlan, '', { spaceId: 'space-1', changes: { name: 'Updated Space' } })
      );
      expect(state.currentFloorPlan).toEqual(mockFloorPlan);
      expect(state.version).toBe(1);
      expect(state.pendingChanges).toHaveLength(1);
      expect(state.pendingChanges[0].type).toBe('UPDATE');
    });
  });

  // Real-time Update Handling
  describe('Real-time Updates', () => {
    const mockFloorPlan: FloorPlan = {
      id: 'test-floor-1',
      metadata: {
        name: 'Test Floor',
        level: 1,
        totalArea: 1000,
        usableArea: 900,
        dimensions: {
          width: 100,
          height: 100,
          scale: 1,
          unit: 'METRIC'
        },
        fileUrl: 'test.dwg',
        lastModified: new Date(),
        version: '1.0.0',
        customFields: {}
      },
      spaces: [],
      status: FloorPlanStatus.DRAFT
    };

    it('should handle real-time updates for matching floor plan', () => {
      const initialState = {
        ...floorPlanReducer(undefined, { type: '' }),
        currentFloorPlan: mockFloorPlan
      };

      const update = {
        id: 'test-floor-1',
        metadata: {
          name: 'Updated Floor'
        }
      };

      const state = floorPlanReducer(
        initialState,
        handleRealtimeUpdate(update)
      );

      expect(state.currentFloorPlan?.metadata.name).toBe('Updated Floor');
      expect(state.version).toBe(1);
      expect(state.lastModified).toBeInstanceOf(Date);
    });

    it('should ignore real-time updates for non-matching floor plan', () => {
      const initialState = {
        ...floorPlanReducer(undefined, { type: '' }),
        currentFloorPlan: mockFloorPlan
      };

      const update = {
        id: 'different-floor',
        metadata: {
          name: 'Different Floor'
        }
      };

      const state = floorPlanReducer(
        initialState,
        handleRealtimeUpdate(update)
      );

      expect(state.currentFloorPlan).toEqual(mockFloorPlan);
      expect(state.version).toBe(0);
    });
  });

  // Version Management
  describe('Version Management', () => {
    it('should increment version on all state changes', () => {
      let state = floorPlanReducer(undefined, { type: '' });
      expect(state.version).toBe(0);

      state = floorPlanReducer(state, setCurrentFloorPlan(mockFloorPlan));
      expect(state.version).toBe(1);

      state = floorPlanReducer(
        state,
        saveFloorPlan.fulfilled(mockFloorPlan, '', {})
      );
      expect(state.version).toBe(2);
    });
  });
});