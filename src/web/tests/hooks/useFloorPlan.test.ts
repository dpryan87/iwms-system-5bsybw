// @package @testing-library/react-hooks v8.0.1
// @package @testing-library/react v13.4.0
// @package @jest/globals v29.0.0
// @package react-redux v8.0.5
// @package @reduxjs/toolkit v1.9.5

import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useFloorPlan } from '../../src/hooks/useFloorPlan';
import {
  FloorPlan,
  FloorPlanStatus,
  FloorPlanSpace,
  SpaceType,
  MeasurementUnit
} from '../../src/types/floor-plan.types';

// Mock data
const mockFloorPlan: FloorPlan = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  metadata: {
    name: 'Test Floor Plan',
    level: 1,
    totalArea: 1000,
    usableArea: 900,
    dimensions: {
      width: 100,
      height: 80,
      scale: 1,
      unit: MeasurementUnit.METRIC
    },
    fileUrl: 'https://example.com/floorplan.dwg',
    lastModified: new Date(),
    version: '1.0.0',
    customFields: {}
  },
  spaces: [],
  status: FloorPlanStatus.DRAFT
};

const mockSpace: FloorPlanSpace = {
  id: '123e4567-e89b-12d3-a456-426614174001',
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

// Mock store setup
const createMockStore = () => {
  return configureStore({
    reducer: {
      floorPlan: (state = { currentFloorPlan: null }, action) => {
        switch (action.type) {
          case 'floorPlan/setCurrent':
            return { ...state, currentFloorPlan: action.payload };
          default:
            return state;
        }
      }
    }
  });
};

describe('useFloorPlan', () => {
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockStore = createMockStore();
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={mockStore}>{children}</Provider>
  );

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useFloorPlan('test-property'), {
        wrapper
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.floorPlan).toBeNull();
      expect(result.current.validation.isValid).toBe(true);
      expect(result.current.syncStatus.connected).toBe(false);
    });
  });

  describe('Floor Plan Operations', () => {
    it('should create a new floor plan successfully', async () => {
      const { result } = renderHook(() => useFloorPlan('test-property'), {
        wrapper
      });

      await act(async () => {
        await result.current.operations.update(mockFloorPlan);
      });

      expect(result.current.floorPlan).toEqual(mockFloorPlan);
      expect(result.current.error).toBeNull();
    });

    it('should add a space to floor plan', async () => {
      const { result } = renderHook(() => useFloorPlan('test-property'), {
        wrapper
      });

      await act(async () => {
        await result.current.operations.update(mockFloorPlan);
        await result.current.operations.addSpace(mockSpace);
      });

      expect(result.current.floorPlan?.spaces).toHaveLength(1);
      expect(result.current.floorPlan?.spaces[0]).toMatchObject(mockSpace);
    });

    it('should remove a space from floor plan', async () => {
      const { result } = renderHook(() => useFloorPlan('test-property'), {
        wrapper
      });

      await act(async () => {
        await result.current.operations.update({
          ...mockFloorPlan,
          spaces: [mockSpace]
        });
        await result.current.operations.removeSpace(mockSpace.id);
      });

      expect(result.current.floorPlan?.spaces).toHaveLength(0);
    });

    it('should update floor plan metadata', async () => {
      const { result } = renderHook(() => useFloorPlan('test-property'), {
        wrapper
      });

      const updatedMetadata = {
        name: 'Updated Floor Plan',
        level: 2
      };

      await act(async () => {
        await result.current.operations.update(mockFloorPlan);
        await result.current.operations.updateMetadata(updatedMetadata);
      });

      expect(result.current.floorPlan?.metadata.name).toBe('Updated Floor Plan');
      expect(result.current.floorPlan?.metadata.level).toBe(2);
    });

    it('should publish floor plan', async () => {
      const { result } = renderHook(() => useFloorPlan('test-property'), {
        wrapper
      });

      await act(async () => {
        await result.current.operations.update(mockFloorPlan);
        await result.current.operations.publish();
      });

      expect(result.current.floorPlan?.status).toBe(FloorPlanStatus.PUBLISHED);
    });
  });

  describe('Validation', () => {
    it('should validate space coordinates', async () => {
      const { result } = renderHook(() => useFloorPlan('test-property'), {
        wrapper
      });

      const invalidSpace = {
        ...mockSpace,
        coordinates: [
          { x: -10, y: 0, z: 0 }, // Invalid coordinate
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 10, z: 0 }
        ]
      };

      await act(async () => {
        await result.current.operations.update(mockFloorPlan);
        await result.current.operations.addSpace(invalidSpace);
      });

      expect(result.current.validation.isValid).toBe(false);
      expect(result.current.validation.errors).toHaveLength(1);
    });

    it('should validate 3D coordinates when enabled', async () => {
      const { result } = renderHook(
        () => useFloorPlan('test-property', { validate3D: true }),
        { wrapper }
      );

      const space3D = {
        ...mockSpace,
        coordinates: mockSpace.coordinates.map(coord => ({ ...coord, z: null }))
      };

      await act(async () => {
        await result.current.operations.update(mockFloorPlan);
        await result.current.operations.addSpace(space3D);
      });

      expect(result.current.validation.warnings).toHaveLength(1);
    });
  });

  describe('Real-time Sync', () => {
    it('should handle real-time updates', async () => {
      const { result } = renderHook(
        () => useFloorPlan('test-property', { enableRealTimeSync: true }),
        { wrapper }
      );

      await act(async () => {
        await result.current.operations.update(mockFloorPlan);
      });

      expect(result.current.syncStatus.connected).toBe(true);
      expect(result.current.syncStatus.pendingChanges).toBe(0);
    });

    it('should handle sync disconnection', async () => {
      const { result } = renderHook(
        () => useFloorPlan('test-property', { enableRealTimeSync: true }),
        { wrapper }
      );

      // Simulate WebSocket disconnection
      await act(async () => {
        const wsClose = new CloseEvent('close');
        window.dispatchEvent(wsClose);
      });

      expect(result.current.syncStatus.connected).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle operation failures', async () => {
      const { result } = renderHook(() => useFloorPlan('test-property'), {
        wrapper
      });

      const error = new Error('Operation failed');
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        await result.current.operations.update({ ...mockFloorPlan, id: 'invalid' });
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toContain('Operation failed');
    });

    it('should handle validation errors gracefully', async () => {
      const { result } = renderHook(() => useFloorPlan('test-property'), {
        wrapper
      });

      const invalidFloorPlan = {
        ...mockFloorPlan,
        metadata: { ...mockFloorPlan.metadata, totalArea: -100 }
      };

      await act(async () => {
        await result.current.operations.update(invalidFloorPlan);
      });

      expect(result.current.validation.isValid).toBe(false);
      expect(result.current.validation.errors).toHaveLength(1);
    });
  });

  describe('Performance Metrics', () => {
    it('should track operation latency', async () => {
      const { result } = renderHook(() => useFloorPlan('test-property'), {
        wrapper
      });

      await act(async () => {
        await result.current.operations.update(mockFloorPlan);
      });

      expect(result.current.metrics.operationLatency).toBeGreaterThan(0);
    });

    it('should track load time', async () => {
      const { result } = renderHook(() => useFloorPlan('test-property'), {
        wrapper
      });

      await act(async () => {
        await result.current.operations.update(mockFloorPlan);
      });

      expect(result.current.metrics.loadTime).toBeGreaterThan(0);
    });
  });
});