// @reduxjs/toolkit v1.9.5
import { createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { Resource, ResourceType, ResourceStatus } from '../../types/resource.types';
import { ResourceService } from '../../services/resource.service';
import { isTokenValid } from '../../utils/auth.utils';

// Error response type for standardized error handling
interface ErrorResponse {
  message: string;
  code: string;
  details?: Record<string, any>;
}

// Resource action type constants
export const RESOURCE_ACTION_TYPES = {
  FETCH_RESOURCES: 'resource/fetchResources',
  FETCH_RESOURCE: 'resource/fetchResource',
  CREATE_RESOURCE: 'resource/createResource',
  UPDATE_RESOURCE: 'resource/updateResource',
  DELETE_RESOURCE: 'resource/deleteResource',
  SET_SELECTED_RESOURCE: 'resource/setSelectedResource',
  CLEAR_SELECTED_RESOURCE: 'resource/clearSelectedResource',
  UPDATE_RESOURCE_STATUS: 'resource/updateResourceStatus',
  BATCH_UPDATE_RESOURCES: 'resource/batchUpdateResources'
} as const;

// Initialize ResourceService instance
const resourceService = new ResourceService(console);

// Synchronous action creators
export const setSelectedResource = createAction<Resource | null>(
  RESOURCE_ACTION_TYPES.SET_SELECTED_RESOURCE
);

export const clearSelectedResource = createAction(
  RESOURCE_ACTION_TYPES.CLEAR_SELECTED_RESOURCE
);

export const updateResourceStatus = createAction<{
  resourceId: string;
  status: ResourceStatus;
}>(RESOURCE_ACTION_TYPES.UPDATE_RESOURCE_STATUS);

// Async thunk for fetching resources with enhanced error handling and filtering
export const fetchResources = createAsyncThunk<
  Resource[],
  Record<string, any>,
  { rejectValue: ErrorResponse }
>(
  RESOURCE_ACTION_TYPES.FETCH_RESOURCES,
  async (filters, { rejectWithValue, getState }) => {
    try {
      // Get auth token from state
      const token = localStorage.getItem('access_token');
      
      if (!token || !isTokenValid(token)) {
        return rejectWithValue({
          message: 'Invalid or expired authentication token',
          code: 'AUTH_ERROR'
        });
      }

      // Fetch resources with filters
      const resources = await resourceService.fetchResources(filters, token);
      return resources;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to fetch resources',
        code: error.code || 'FETCH_ERROR',
        details: error.details
      });
    }
  }
);

// Async thunk for fetching a single resource
export const fetchResourceById = createAsyncThunk<
  Resource,
  string,
  { rejectValue: ErrorResponse }
>(
  RESOURCE_ACTION_TYPES.FETCH_RESOURCE,
  async (resourceId, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      
      if (!token || !isTokenValid(token)) {
        return rejectWithValue({
          message: 'Invalid or expired authentication token',
          code: 'AUTH_ERROR'
        });
      }

      const resource = await resourceService.fetchResourceById(resourceId, token);
      return resource;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to fetch resource',
        code: error.code || 'FETCH_ERROR',
        details: error.details
      });
    }
  }
);

// Async thunk for creating a new resource
export const createResource = createAsyncThunk<
  Resource,
  Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>,
  { rejectValue: ErrorResponse }
>(
  RESOURCE_ACTION_TYPES.CREATE_RESOURCE,
  async (resourceData, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      
      if (!token || !isTokenValid(token)) {
        return rejectWithValue({
          message: 'Invalid or expired authentication token',
          code: 'AUTH_ERROR'
        });
      }

      const newResource = await resourceService.createNewResource(resourceData, token);
      return newResource;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to create resource',
        code: error.code || 'CREATE_ERROR',
        details: error.details
      });
    }
  }
);

// Async thunk for updating an existing resource
export const updateResource = createAsyncThunk<
  Resource,
  { id: string; updates: Partial<Resource> },
  { rejectValue: ErrorResponse }
>(
  RESOURCE_ACTION_TYPES.UPDATE_RESOURCE,
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      
      if (!token || !isTokenValid(token)) {
        return rejectWithValue({
          message: 'Invalid or expired authentication token',
          code: 'AUTH_ERROR'
        });
      }

      const updatedResource = await resourceService.updateExistingResource(id, updates, token);
      return updatedResource;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to update resource',
        code: error.code || 'UPDATE_ERROR',
        details: error.details
      });
    }
  }
);

// Async thunk for deleting a resource
export const deleteResource = createAsyncThunk<
  string,
  string,
  { rejectValue: ErrorResponse }
>(
  RESOURCE_ACTION_TYPES.DELETE_RESOURCE,
  async (resourceId, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      
      if (!token || !isTokenValid(token)) {
        return rejectWithValue({
          message: 'Invalid or expired authentication token',
          code: 'AUTH_ERROR'
        });
      }

      await resourceService.removeResource(resourceId, token);
      return resourceId;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to delete resource',
        code: error.code || 'DELETE_ERROR',
        details: error.details
      });
    }
  }
);

// Async thunk for batch updating multiple resources
export const batchUpdateResources = createAsyncThunk<
  Resource[],
  { resources: Array<{ id: string; updates: Partial<Resource> }> },
  { rejectValue: ErrorResponse }
>(
  RESOURCE_ACTION_TYPES.BATCH_UPDATE_RESOURCES,
  async ({ resources }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      
      if (!token || !isTokenValid(token)) {
        return rejectWithValue({
          message: 'Invalid or expired authentication token',
          code: 'AUTH_ERROR'
        });
      }

      const updatePromises = resources.map(({ id, updates }) =>
        resourceService.updateExistingResource(id, updates, token)
      );

      const updatedResources = await Promise.all(updatePromises);
      return updatedResources;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to batch update resources',
        code: error.code || 'BATCH_UPDATE_ERROR',
        details: error.details
      });
    }
  }
);

// Export action types for reducer consumption
export type ResourceActions = 
  | ReturnType<typeof setSelectedResource>
  | ReturnType<typeof clearSelectedResource>
  | ReturnType<typeof updateResourceStatus>
  | ReturnType<typeof fetchResources.fulfilled>
  | ReturnType<typeof fetchResources.rejected>
  | ReturnType<typeof fetchResourceById.fulfilled>
  | ReturnType<typeof fetchResourceById.rejected>
  | ReturnType<typeof createResource.fulfilled>
  | ReturnType<typeof createResource.rejected>
  | ReturnType<typeof updateResource.fulfilled>
  | ReturnType<typeof updateResource.rejected>
  | ReturnType<typeof deleteResource.fulfilled>
  | ReturnType<typeof deleteResource.rejected>
  | ReturnType<typeof batchUpdateResources.fulfilled>
  | ReturnType<typeof batchUpdateResources.rejected>;