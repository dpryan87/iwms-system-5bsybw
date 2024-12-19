// @package axios v1.4.0
// @package axios-retry v3.5.0

import { AxiosResponse } from 'axios';
import axiosInstance from './axios.config';
import { FloorPlan, FloorPlanStatus, FloorPlanMetadata } from '../types/floor-plan.types';
import { UUID } from 'crypto';

/**
 * Cache duration for floor plan data in milliseconds
 */
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Interface for floor plan upload options
 */
interface UploadOptions {
  onProgress?: (progress: number) => void;
  validateDimensions?: boolean;
  generateThumbnail?: boolean;
}

/**
 * Interface for floor plan update options
 */
interface UpdateOptions {
  handleConflicts?: boolean;
  notifyStakeholders?: boolean;
  preserveMetadata?: boolean;
}

/**
 * Interface for floor plan query parameters
 */
interface FloorPlanQueryParams {
  propertyId?: UUID;
  status?: FloorPlanStatus;
  page?: number;
  limit?: number;
  includeArchived?: boolean;
}

/**
 * Creates a new floor plan with comprehensive validation and error handling
 * @param floorPlanData - Floor plan data to create
 * @param options - Upload options for progress tracking and validation
 * @returns Promise resolving to created floor plan
 */
export async function createFloorPlan(
  floorPlanData: Partial<FloorPlan>,
  options: UploadOptions = {}
): Promise<FloorPlan> {
  try {
    // Validate required fields
    if (!floorPlanData.metadata?.fileUrl) {
      throw new Error('Floor plan file URL is required');
    }

    const { onProgress, validateDimensions = true } = options;

    // Configure request with upload progress tracking
    const config = {
      onUploadProgress: (progressEvent: any) => {
        if (onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
      headers: {
        'Content-Type': 'application/json',
        'X-Validate-Dimensions': validateDimensions.toString()
      }
    };

    const response = await axiosInstance.post<FloorPlan>(
      '/api/v1/floor-plans',
      floorPlanData,
      config
    );

    return response.data;
  } catch (error: any) {
    console.error('Failed to create floor plan:', error);
    throw new Error(`Floor plan creation failed: ${error.message}`);
  }
}

/**
 * Updates an existing floor plan with version control and conflict resolution
 * @param id - Floor plan ID
 * @param floorPlanData - Partial floor plan data to update
 * @param options - Update options for conflict handling
 * @returns Promise resolving to updated floor plan
 */
export async function updateFloorPlan(
  id: UUID,
  floorPlanData: Partial<FloorPlan>,
  options: UpdateOptions = {}
): Promise<FloorPlan> {
  try {
    const { handleConflicts = true, preserveMetadata = true } = options;

    // Get current version for conflict detection
    const currentPlan = await getFloorPlan(id);
    
    const config = {
      headers: {
        'If-Match': currentPlan.metadata.version,
        'X-Handle-Conflicts': handleConflicts.toString(),
        'X-Preserve-Metadata': preserveMetadata.toString()
      }
    };

    const response = await axiosInstance.put<FloorPlan>(
      `/api/v1/floor-plans/${id}`,
      floorPlanData,
      config
    );

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 409) {
      throw new Error('Floor plan has been modified by another user');
    }
    throw new Error(`Failed to update floor plan: ${error.message}`);
  }
}

/**
 * Retrieves a floor plan by ID with caching support
 * @param id - Floor plan ID
 * @returns Promise resolving to floor plan data
 */
export async function getFloorPlan(id: UUID): Promise<FloorPlan> {
  try {
    const response = await axiosInstance.get<FloorPlan>(
      `/api/v1/floor-plans/${id}`,
      {
        headers: {
          'Cache-Control': `max-age=${CACHE_DURATION / 1000}`
        }
      }
    );

    return response.data;
  } catch (error: any) {
    throw new Error(`Failed to retrieve floor plan: ${error.message}`);
  }
}

/**
 * Retrieves floor plans for a specific property with pagination
 * @param queryParams - Query parameters for filtering and pagination
 * @returns Promise resolving to paginated floor plans
 */
export async function getFloorPlansByProperty(
  queryParams: FloorPlanQueryParams
): Promise<{ data: FloorPlan[]; total: number; page: number }> {
  try {
    const response = await axiosInstance.get<{ data: FloorPlan[]; total: number; page: number }>(
      '/api/v1/floor-plans',
      {
        params: queryParams,
        headers: {
          'Cache-Control': `max-age=${CACHE_DURATION / 1000}`
        }
      }
    );

    return response.data;
  } catch (error: any) {
    throw new Error(`Failed to retrieve floor plans: ${error.message}`);
  }
}

/**
 * Deletes a floor plan with proper cleanup
 * @param id - Floor plan ID
 * @returns Promise resolving to deletion success
 */
export async function deleteFloorPlan(id: UUID): Promise<boolean> {
  try {
    await axiosInstance.delete(`/api/v1/floor-plans/${id}`, {
      headers: {
        'X-Confirm-Delete': 'true'
      }
    });

    return true;
  } catch (error: any) {
    throw new Error(`Failed to delete floor plan: ${error.message}`);
  }
}

/**
 * Updates floor plan metadata without modifying the plan itself
 * @param id - Floor plan ID
 * @param metadata - Updated metadata
 * @returns Promise resolving to updated floor plan
 */
export async function updateFloorPlanMetadata(
  id: UUID,
  metadata: Partial<FloorPlanMetadata>
): Promise<FloorPlan> {
  try {
    const response = await axiosInstance.patch<FloorPlan>(
      `/api/v1/floor-plans/${id}/metadata`,
      metadata
    );

    return response.data;
  } catch (error: any) {
    throw new Error(`Failed to update floor plan metadata: ${error.message}`);
  }
}

/**
 * Changes the status of a floor plan
 * @param id - Floor plan ID
 * @param status - New status
 * @returns Promise resolving to updated floor plan
 */
export async function updateFloorPlanStatus(
  id: UUID,
  status: FloorPlanStatus
): Promise<FloorPlan> {
  try {
    const response = await axiosInstance.patch<FloorPlan>(
      `/api/v1/floor-plans/${id}/status`,
      { status }
    );

    return response.data;
  } catch (error: any) {
    throw new Error(`Failed to update floor plan status: ${error.message}`);
  }
}