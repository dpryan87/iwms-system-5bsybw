// @package rxjs v7.0.0
// @package lodash v4.17.21

import { BehaviorSubject, debounceTime, distinctUntilChanged } from 'rxjs';
import { memoize } from 'lodash';
import { 
  FloorPlan, 
  FloorPlanSpace, 
  FloorPlanStatus, 
  SpaceType, 
  FloorPlanMetadata, 
  Coordinates3D 
} from '../types/floor-plan.types';
import {
  createFloorPlan,
  updateFloorPlan,
  getFloorPlan,
  getFloorPlansByProperty,
  deleteFloorPlan
} from '../api/floor-plans.api';
import {
  calculateSpaceArea,
  validateSpaceCoordinates,
  checkSpaceOverlap,
  scaleCoordinates,
  generateSpaceId,
  calculateCentroid,
  calculate3DVolume
} from '../utils/floor-plan.utils';

/**
 * Enhanced FloorPlanService class providing comprehensive floor plan management
 * with support for 2D/3D visualization, real-time updates, and advanced calculations
 */
export class FloorPlanService {
  // Observable streams for real-time floor plan data
  private readonly currentFloorPlan$ = new BehaviorSubject<FloorPlan | null>(null);
  private readonly propertyFloorPlans$ = new BehaviorSubject<FloorPlan[]>([]);
  private readonly floorPlanChanges$ = new BehaviorSubject<Partial<FloorPlan> | null>(null);

  // Performance optimization caches
  private readonly calculationCache = new Map<string, number>();
  private readonly validationCache = new Map<string, boolean>();

  // Web Worker for intensive calculations
  private readonly geometryWorker: Worker;

  constructor() {
    // Initialize WebWorker for geometric calculations
    this.geometryWorker = new Worker('/workers/geometry.worker.js');
    this.setupWorkerHandlers();

    // Configure debounced updates
    this.floorPlanChanges$
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(async (changes) => {
        if (changes && this.currentFloorPlan$.value) {
          await this.saveFloorPlanChanges(changes);
        }
      });
  }

  /**
   * Initializes a new floor plan with enhanced 3D support
   * @param propertyId - Property identifier
   * @param metadata - Floor plan metadata
   * @param enable3D - Enable 3D visualization support
   */
  public async initializeFloorPlan(
    propertyId: string,
    metadata: FloorPlanMetadata,
    enable3D: boolean = false
  ): Promise<FloorPlan> {
    try {
      const newFloorPlan: Partial<FloorPlan> = {
        metadata: {
          ...metadata,
          version: '1.0.0',
          lastModified: new Date(),
          dimensions: {
            ...metadata.dimensions,
            scale: 1
          }
        },
        spaces: [],
        status: FloorPlanStatus.DRAFT
      };

      const createdFloorPlan = await createFloorPlan(newFloorPlan);
      this.currentFloorPlan$.next(createdFloorPlan);
      return createdFloorPlan;
    } catch (error) {
      console.error('Failed to initialize floor plan:', error);
      throw new Error(`Floor plan initialization failed: ${error.message}`);
    }
  }

  /**
   * Loads a floor plan with optimized caching
   * @param id - Floor plan identifier
   */
  public async loadFloorPlan(id: string): Promise<void> {
    try {
      const floorPlan = await getFloorPlan(id);
      
      // Process 3D data if present
      if (this.has3DData(floorPlan)) {
        await this.process3DData(floorPlan);
      }

      this.currentFloorPlan$.next(floorPlan);
      this.clearCalculationCache();
    } catch (error) {
      console.error('Failed to load floor plan:', error);
      throw new Error(`Floor plan loading failed: ${error.message}`);
    }
  }

  /**
   * Updates floor plan with real-time synchronization
   * @param updates - Partial floor plan updates
   */
  public async updateFloorPlan(updates: Partial<FloorPlan>): Promise<void> {
    try {
      const currentPlan = this.currentFloorPlan$.value;
      if (!currentPlan) {
        throw new Error('No floor plan currently loaded');
      }

      // Validate updates before applying
      await this.validateUpdates(updates);

      // Apply updates to current plan
      const updatedPlan = {
        ...currentPlan,
        ...updates,
        metadata: {
          ...currentPlan.metadata,
          lastModified: new Date()
        }
      };

      // Trigger debounced save
      this.floorPlanChanges$.next(updates);

      // Update local state immediately
      this.currentFloorPlan$.next(updatedPlan);
    } catch (error) {
      console.error('Failed to update floor plan:', error);
      throw new Error(`Floor plan update failed: ${error.message}`);
    }
  }

  /**
   * Adds a new space to the floor plan with validation
   * @param space - Space to add
   */
  public async addSpace(space: Partial<FloorPlanSpace>): Promise<void> {
    try {
      const currentPlan = this.currentFloorPlan$.value;
      if (!currentPlan) {
        throw new Error('No floor plan currently loaded');
      }

      // Validate space coordinates
      const validation = await this.validateSpaceAddition(space);
      if (!validation.isValid) {
        throw new Error(`Invalid space: ${validation.errors.join(', ')}`);
      }

      // Check for overlaps with existing spaces
      const overlaps = await this.checkSpaceOverlaps(space, currentPlan.spaces);
      if (overlaps.some(result => result.hasOverlap)) {
        throw new Error('Space overlaps with existing spaces');
      }

      // Add space to floor plan
      const updatedSpaces = [...currentPlan.spaces, space];
      await this.updateFloorPlan({ spaces: updatedSpaces });
    } catch (error) {
      console.error('Failed to add space:', error);
      throw new Error(`Space addition failed: ${error.message}`);
    }
  }

  /**
   * Retrieves floor plans for a property with pagination
   * @param propertyId - Property identifier
   * @param page - Page number
   * @param limit - Items per page
   */
  public async getPropertyFloorPlans(
    propertyId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<void> {
    try {
      const response = await getFloorPlansByProperty({
        propertyId,
        page,
        limit,
        includeArchived: false
      });

      this.propertyFloorPlans$.next(response.data);
    } catch (error) {
      console.error('Failed to retrieve property floor plans:', error);
      throw new Error(`Floor plan retrieval failed: ${error.message}`);
    }
  }

  // Public observables for component subscriptions
  public get currentFloorPlan() {
    return this.currentFloorPlan$.asObservable();
  }

  public get propertyFloorPlans() {
    return this.propertyFloorPlans$.asObservable();
  }

  // Private helper methods

  private async validateUpdates(updates: Partial<FloorPlan>): Promise<void> {
    if (updates.spaces) {
      for (const space of updates.spaces) {
        const validation = await this.validateSpaceAddition(space);
        if (!validation.isValid) {
          throw new Error(`Invalid space update: ${validation.errors.join(', ')}`);
        }
      }
    }
  }

  private async validateSpaceAddition(
    space: Partial<FloorPlanSpace>
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    if (!space.coordinates || space.coordinates.length < 3) {
      errors.push('Space must have at least 3 coordinates');
    }

    if (space.coordinates) {
      const currentPlan = this.currentFloorPlan$.value;
      if (currentPlan) {
        const validation = validateSpaceCoordinates(
          space.coordinates,
          currentPlan.metadata.dimensions,
          this.has3DData(currentPlan)
        );
        if (!validation.isValid) {
          errors.push(...validation.errors);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async checkSpaceOverlaps(
    space: Partial<FloorPlanSpace>,
    existingSpaces: FloorPlanSpace[]
  ): Promise<Array<{ hasOverlap: boolean; overlapArea: number }>> {
    return Promise.all(
      existingSpaces.map(existingSpace =>
        checkSpaceOverlap(space as FloorPlanSpace, existingSpace)
      )
    );
  }

  private has3DData(floorPlan: FloorPlan): boolean {
    return floorPlan.spaces.some(space =>
      space.coordinates.some(coord => (coord as Coordinates3D).z !== undefined)
    );
  }

  private async process3DData(floorPlan: FloorPlan): Promise<void> {
    // Process 3D calculations in web worker
    return new Promise((resolve, reject) => {
      this.geometryWorker.postMessage({
        type: '3D_PROCESSING',
        data: floorPlan
      });

      this.geometryWorker.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve();
        }
      };
    });
  }

  private setupWorkerHandlers(): void {
    this.geometryWorker.onerror = (error) => {
      console.error('Geometry worker error:', error);
    };
  }

  private async saveFloorPlanChanges(changes: Partial<FloorPlan>): Promise<void> {
    const currentPlan = this.currentFloorPlan$.value;
    if (currentPlan) {
      try {
        await updateFloorPlan(currentPlan.id, changes);
      } catch (error) {
        console.error('Failed to save floor plan changes:', error);
        throw new Error(`Failed to save changes: ${error.message}`);
      }
    }
  }

  private clearCalculationCache(): void {
    this.calculationCache.clear();
    this.validationCache.clear();
  }
}

// Export singleton instance
export const floorPlanService = new FloorPlanService();