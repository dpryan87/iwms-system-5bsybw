// @reduxjs/toolkit version ^1.9.5
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Resource, ResourceType, ResourceStatus } from '../../types/resource.types';

/**
 * Interface defining the shape of the resource state in Redux store
 * Includes enhanced features for real-time updates, validation, and access control
 */
export interface ResourceState {
  items: Record<string, Resource>;
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  validationErrors: Record<string, string>;
  socketConnected: boolean;
  userRole: string;
}

/**
 * Initial state configuration for the resource reducer
 * Sets up default values for all state properties
 */
const initialState: ResourceState = {
  items: {},
  selectedId: null,
  loading: false,
  error: null,
  lastUpdated: null,
  validationErrors: {},
  socketConnected: false,
  userRole: ''
};

/**
 * Enhanced Redux slice for resource management with real-time capabilities
 * Implements comprehensive state management for workplace resources
 */
const resourceSlice = createSlice({
  name: 'resource',
  initialState,
  reducers: {
    // Resource CRUD Operations
    setResources: (state, action: PayloadAction<Resource[]>) => {
      state.loading = false;
      state.error = null;
      state.items = action.payload.reduce((acc, resource) => {
        acc[resource.id] = resource;
        return acc;
      }, {} as Record<string, Resource>);
      state.lastUpdated = new Date();
    },

    addResource: (state, action: PayloadAction<Resource>) => {
      state.items[action.payload.id] = action.payload;
      state.lastUpdated = new Date();
      state.validationErrors = {};
    },

    updateResource: (state, action: PayloadAction<Partial<Resource> & { id: string }>) => {
      const { id, ...updates } = action.payload;
      if (state.items[id]) {
        state.items[id] = { ...state.items[id], ...updates, updatedAt: new Date() };
        state.lastUpdated = new Date();
        state.validationErrors = {};
      }
    },

    deleteResource: (state, action: PayloadAction<string>) => {
      delete state.items[action.payload];
      if (state.selectedId === action.payload) {
        state.selectedId = null;
      }
      state.lastUpdated = new Date();
    },

    // Selection Management
    setSelectedResource: (state, action: PayloadAction<string>) => {
      state.selectedId = action.payload;
      state.validationErrors = {};
    },

    clearSelectedResource: (state) => {
      state.selectedId = null;
      state.validationErrors = {};
    },

    // Loading and Error States
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },

    setError: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Validation Management
    setValidationErrors: (state, action: PayloadAction<Record<string, string>>) => {
      state.validationErrors = action.payload;
    },

    clearValidationErrors: (state) => {
      state.validationErrors = {};
    },

    // Real-time Updates
    setSocketConnected: (state, action: PayloadAction<boolean>) => {
      state.socketConnected = action.payload;
    },

    handleSocketUpdate: (state, action: PayloadAction<{
      resourceId: string;
      updates: Partial<Resource>;
    }>) => {
      const { resourceId, updates } = action.payload;
      if (state.items[resourceId]) {
        state.items[resourceId] = {
          ...state.items[resourceId],
          ...updates,
          updatedAt: new Date()
        };
        state.lastUpdated = new Date();
      }
    },

    // Access Control
    setUserRole: (state, action: PayloadAction<string>) => {
      state.userRole = action.payload;
    },

    // Batch Operations
    batchUpdateResources: (state, action: PayloadAction<Record<string, Partial<Resource>>>) => {
      Object.entries(action.payload).forEach(([id, updates]) => {
        if (state.items[id]) {
          state.items[id] = {
            ...state.items[id],
            ...updates,
            updatedAt: new Date()
          };
        }
      });
      state.lastUpdated = new Date();
    }
  }
});

// Export actions and reducer
export const resourceActions = resourceSlice.actions;
export const resourceReducer = resourceSlice.reducer;

// Selector helpers
export const selectResources = (state: { resource: ResourceState }) => state.resource.items;
export const selectSelectedResource = (state: { resource: ResourceState }) => 
  state.resource.selectedId ? state.resource.items[state.resource.selectedId] : null;
export const selectResourcesLoading = (state: { resource: ResourceState }) => state.resource.loading;
export const selectResourcesError = (state: { resource: ResourceState }) => state.resource.error;
export const selectValidationErrors = (state: { resource: ResourceState }) => state.resource.validationErrors;
export const selectSocketConnected = (state: { resource: ResourceState }) => state.resource.socketConnected;
export const selectUserRole = (state: { resource: ResourceState }) => state.resource.userRole;