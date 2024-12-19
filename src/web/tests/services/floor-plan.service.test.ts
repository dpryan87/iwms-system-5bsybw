// @package jest v29.0.0
// @package rxjs v7.0.0

import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { BehaviorSubject } from 'rxjs';
import { FloorPlanService } from '../../src/services/floor-plan.service';
import { 
  FloorPlan, 
  FloorPlanSpace, 
  FloorPlanStatus, 
  SpaceType,
  MeasurementUnit
} from '../../src/types/floor-plan.types';
import {
  createFloorPlan,
  updateFloorPlan,
  getFloorPlan,
  getFloorPlansByProperty,
  deleteFloorPlan
} from '../../src/api/floor-plans.api';

// Mock API functions
jest.mock('../../src/api/floor-plans.api');
const mockCreateFloorPlan = createFloorPlan as jest.MockedFunction<typeof createFloorPlan>;
const mockUpdateFloorPlan = updateFloorPlan as jest.MockedFunction<typeof updateFloorPlan>;
const mockGetFloorPlan = getFloorPlan as jest.MockedFunction<typeof getFloorPlan>;
const mockGetFloorPlansByProperty = getFloorPlansByProperty as jest.MockedFunction<typeof getFloorPlansByProperty>;
const mockDeleteFloorPlan = deleteFloorPlan as jest.MockedFunction<typeof deleteFloorPlan>;

// Mock WebGL context for 3D visualization testing
const mockWebGLContext = jest.fn();
(global as any).WebGLRenderingContext = mockWebGLContext;

describe('FloorPlanService', () => {
  let service: FloorPlanService;
  let testFloorPlan: FloorPlan;
  let testSpace: FloorPlanSpace;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Initialize service
    service = new FloorPlanService();

    // Setup test data
    testSpace = {
      id: '123e4567-e89b-12d3-a456-426614174000',
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

    testFloorPlan = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      metadata: {
        name: 'Test Floor Plan',
        level: 1,
        totalArea: 1000,
        usableArea: 800,
        dimensions: {
          width: 100,
          height: 100,
          scale: 1,
          unit: MeasurementUnit.METRIC
        },
        fileUrl: 'https://example.com/floorplan.dwg',
        lastModified: new Date(),
        version: '1.0.0',
        customFields: {}
      },
      spaces: [testSpace],
      status: FloorPlanStatus.DRAFT
    };

    // Setup API mock responses
    mockCreateFloorPlan.mockResolvedValue(testFloorPlan);
    mockGetFloorPlan.mockResolvedValue(testFloorPlan);
    mockUpdateFloorPlan.mockResolvedValue(testFloorPlan);
    mockGetFloorPlansByProperty.mockResolvedValue({
      data: [testFloorPlan],
      total: 1,
      page: 1
    });
  });

  afterEach(() => {
    // Clean up subscriptions and WebGL context
    service['geometryWorker'].terminate();
  });

  test('should initialize floor plan with 3D support', async () => {
    const metadata = {
      name: 'New Floor Plan',
      level: 1,
      totalArea: 1000,
      usableArea: 800,
      dimensions: {
        width: 100,
        height: 100,
        scale: 1,
        unit: MeasurementUnit.METRIC
      },
      fileUrl: 'https://example.com/floorplan.dwg',
      lastModified: new Date(),
      version: '1.0.0',
      customFields: {}
    };

    const result = await service.initializeFloorPlan('property-123', metadata, true);

    expect(result).toBeDefined();
    expect(result.metadata.name).toBe('New Floor Plan');
    expect(mockCreateFloorPlan).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        dimensions: expect.objectContaining({ scale: 1 })
      }),
      spaces: [],
      status: FloorPlanStatus.DRAFT
    }));
  });

  test('should handle real-time updates with debouncing', async () => {
    // Setup subscription to monitor updates
    const updates: Partial<FloorPlan>[] = [];
    service.currentFloorPlan.subscribe(plan => {
      if (plan) updates.push(plan);
    });

    // Load initial floor plan
    await service.loadFloorPlan(testFloorPlan.id);

    // Simulate rapid updates
    const updatePromises = [
      service.updateFloorPlan({ status: FloorPlanStatus.REVIEW }),
      service.updateFloorPlan({ status: FloorPlanStatus.PUBLISHED })
    ];

    await Promise.all(updatePromises);

    // Wait for debounce period
    await new Promise(resolve => setTimeout(resolve, 400));

    expect(mockUpdateFloorPlan).toHaveBeenCalledTimes(1);
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[updates.length - 1].status).toBe(FloorPlanStatus.PUBLISHED);
  });

  test('should validate space geometry in 3D', async () => {
    const invalidSpace: Partial<FloorPlanSpace> = {
      coordinates: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 }
      ],
      type: SpaceType.OFFICE
    };

    await service.loadFloorPlan(testFloorPlan.id);
    
    await expect(service.addSpace(invalidSpace))
      .rejects
      .toThrow('Invalid space: Space must have at least 3 coordinates');
  });

  test('should handle concurrent modifications with version control', async () => {
    // Simulate concurrent update scenario
    mockUpdateFloorPlan
      .mockRejectedValueOnce(new Error('Floor plan has been modified by another user'))
      .mockResolvedValueOnce(testFloorPlan);

    await service.loadFloorPlan(testFloorPlan.id);

    const update = { status: FloorPlanStatus.PUBLISHED };
    await expect(service.updateFloorPlan(update))
      .rejects
      .toThrow('Floor plan update failed: Floor plan has been modified by another user');
  });

  test('should optimize performance with calculation caching', async () => {
    await service.loadFloorPlan(testFloorPlan.id);

    // Add same space multiple times to test cache
    const space = { ...testSpace, id: '123e4567-e89b-12d3-a456-426614174002' };
    
    const start = performance.now();
    await service.addSpace(space);
    await service.addSpace({ ...space, id: '123e4567-e89b-12d3-a456-426614174003' });
    const end = performance.now();

    expect(end - start).toBeLessThan(100); // Verify cache improves performance
  });

  test('should handle WebGL context loss in 3D mode', async () => {
    // Mock WebGL context loss
    const contextLossEvent = new Event('webglcontextlost');
    mockWebGLContext.mockImplementation(() => {
      throw new Error('WebGL context lost');
    });

    await service.loadFloorPlan(testFloorPlan.id);
    
    // Attempt 3D operations after context loss
    await expect(service.toggle3DMode())
      .rejects
      .toThrow('WebGL context lost');
  });

  test('should clean up resources on error', async () => {
    const mockCleanup = jest.spyOn(service as any, 'clearCalculationCache');
    
    // Force an error
    mockGetFloorPlan.mockRejectedValue(new Error('Network error'));
    
    await expect(service.loadFloorPlan('invalid-id'))
      .rejects
      .toThrow();
      
    expect(mockCleanup).toHaveBeenCalled();
  });

  test('should validate floor plan metadata updates', async () => {
    await service.loadFloorPlan(testFloorPlan.id);

    const invalidUpdate = {
      metadata: {
        ...testFloorPlan.metadata,
        dimensions: { width: -100, height: 100, scale: 1, unit: MeasurementUnit.METRIC }
      }
    };

    await expect(service.updateFloorPlan(invalidUpdate))
      .rejects
      .toThrow('Invalid space update');
  });
});