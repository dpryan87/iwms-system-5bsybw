// @reduxjs/toolkit version ^1.9.0
import { createSelector, createStructuredSelector } from '@reduxjs/toolkit';
import { Resource, ResourceType, ResourceStatus } from '../../types/resource.types';

/**
 * Interface defining the shape of the resource state slice
 */
interface ResourceState {
  resources: Record<string, Resource>;
  loading: boolean;
  error: string | null;
}

/**
 * Type guard to ensure resource state exists
 */
const isResourceState = (state: any): state is { resource: ResourceState } => {
  return state && 'resource' in state;
};

/**
 * Base selector to access the resource state slice
 * Provides type safety and null checking
 */
export const selectResourceState = (state: any): ResourceState => {
  if (!isResourceState(state)) {
    return { resources: {}, loading: false, error: null };
  }
  return state.resource;
};

/**
 * Memoized selector to get all resources as a record
 * Uses shallow equality checking for performance optimization
 */
export const selectResources = createSelector(
  [selectResourceState],
  (resourceState): Record<string, Resource> => resourceState.resources || {}
);

/**
 * WeakMap cache for storing computed resource arrays
 * Optimizes memory usage by allowing garbage collection
 */
const resourceListCache = new WeakMap<Record<string, Resource>, Resource[]>();

/**
 * Memoized selector to get resources as an array
 * Implements caching for expensive array conversions
 */
export const selectResourcesList = createSelector(
  [selectResources],
  (resources): Resource[] => {
    const cached = resourceListCache.get(resources);
    if (cached) return cached;

    const resourceList = Object.values(resources);
    resourceListCache.set(resources, resourceList);
    return resourceList;
  }
);

/**
 * Type-safe selector to get resources for a specific space
 * Implements error handling and null safety
 */
export const selectResourcesBySpace = createSelector(
  [selectResourcesList, (_state: any, spaceId: string) => spaceId],
  (resources, spaceId): Resource[] => {
    if (!spaceId) return [];
    return resources.filter(resource => resource.spaceId === spaceId);
  }
);

/**
 * Null-safe selector to get a specific resource by ID
 * Provides undefined fallback for missing resources
 */
export const selectResourceById = createSelector(
  [selectResources, (_state: any, resourceId: string) => resourceId],
  (resources, resourceId): Resource | undefined => {
    if (!resourceId) return undefined;
    return resources[resourceId];
  }
);

/**
 * WeakMap cache for storing filtered resource arrays by type
 */
const resourcesByTypeCache = new WeakMap<Resource[], Map<ResourceType, Resource[]>>();

/**
 * Optimized selector to get resources filtered by type
 * Implements caching for filtered results
 */
export const selectResourcesByType = createSelector(
  [selectResourcesList, (_state: any, type: ResourceType) => type],
  (resources, type): Resource[] => {
    if (!type) return [];

    let typeCache = resourcesByTypeCache.get(resources);
    if (!typeCache) {
      typeCache = new Map();
      resourcesByTypeCache.set(resources, typeCache);
    }

    const cached = typeCache.get(type);
    if (cached) return cached;

    const filtered = resources.filter(resource => resource.type === type);
    typeCache.set(type, filtered);
    return filtered;
  }
);

/**
 * WeakMap cache for storing filtered resource arrays by status
 */
const resourcesByStatusCache = new WeakMap<Resource[], Map<ResourceStatus, Resource[]>>();

/**
 * Cached selector to get resources filtered by status
 * Implements performance optimizations for filtered results
 */
export const selectResourcesByStatus = createSelector(
  [selectResourcesList, (_state: any, status: ResourceStatus) => status],
  (resources, status): Resource[] => {
    if (!status) return [];

    let statusCache = resourcesByStatusCache.get(resources);
    if (!statusCache) {
      statusCache = new Map();
      resourcesByStatusCache.set(resources, statusCache);
    }

    const cached = statusCache.get(status);
    if (cached) return cached;

    const filtered = resources.filter(resource => resource.status === status);
    statusCache.set(status, filtered);
    return filtered;
  }
);

/**
 * Type-safe selector to get resource loading state
 * Provides false fallback for undefined state
 */
export const selectResourcesLoading = createSelector(
  [selectResourceState],
  (resourceState): boolean => resourceState.loading || false
);

/**
 * Error-handled selector to get resource error state
 * Provides null fallback for undefined state
 */
export const selectResourcesError = createSelector(
  [selectResourceState],
  (resourceState): string | null => resourceState.error || null
);

/**
 * Structured selector for common resource state combinations
 * Optimizes multiple selector usage in components
 */
export const selectResourceStateDetails = createStructuredSelector({
  resources: selectResources,
  loading: selectResourcesLoading,
  error: selectResourcesError
});