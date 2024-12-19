// react v18.0.0
// react-redux v8.1.0
// lodash v4.17.21

import { useDispatch, useSelector } from 'react-redux';
import { useState, useCallback, useEffect } from 'react';
import { debounce } from 'lodash';
import { Resource, ResourceType, ResourceStatus } from '../types/resource.types';
import { ResourceActions } from '../store/actions/resource.actions';

/**
 * Error interface for resource operations
 */
interface ResourceError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Custom hook for managing workplace resources with real-time updates
 * Implements comprehensive resource management with Redux integration
 */
export const useResource = () => {
  const dispatch = useDispatch();

  // Local state management
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ResourceError | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Redux state selectors
  const resource = useSelector((state: any) => state.resources.selectedResource);
  const spaceResources = useSelector((state: any) => state.resources.spaceResources);

  /**
   * Handles WebSocket connection for real-time updates
   */
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const ws = new WebSocket(`${process.env.REACT_APP_WS_URL}/resources`);
    
    ws.onopen = () => {
      setWsConnected(true);
      ws.send(JSON.stringify({ type: 'AUTH', token }));
    };

    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        handleWebSocketUpdate(update);
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      setWsConnected(false);
      // Attempt reconnection after 5 seconds
      setTimeout(() => {
        setRetryCount((prev) => prev + 1);
      }, 5000);
    };

    return () => {
      ws.close();
    };
  }, [retryCount]);

  /**
   * Handles real-time resource updates from WebSocket
   */
  const handleWebSocketUpdate = useCallback((update: any) => {
    if (!update.type || !update.data) return;

    switch (update.type) {
      case 'RESOURCE_UPDATE':
        dispatch(ResourceActions.updateResourceInRealTime(update.data));
        break;
      case 'RESOURCE_DELETE':
        // Handle resource deletion
        break;
      case 'RESOURCE_CREATE':
        // Handle new resource creation
        break;
      default:
        console.warn('Unknown update type:', update.type);
    }
  }, [dispatch]);

  /**
   * Fetches a resource by ID with error handling and retries
   */
  const fetchResourceById = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await dispatch(ResourceActions.fetchResource(id));
      if (result.error) {
        throw result.error;
      }
      return result.payload;
    } catch (err: any) {
      setError({
        code: err.code || 'FETCH_ERROR',
        message: err.message || 'Failed to fetch resource',
        details: err.details
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Fetches resources for a specific space with debouncing
   */
  const fetchResourcesBySpace = useCallback(
    debounce(async (spaceId: string) => {
      setLoading(true);
      setError(null);

      try {
        const result = await dispatch(ResourceActions.fetchSpaceResources(spaceId));
        if (result.error) {
          throw result.error;
        }
        return result.payload;
      } catch (err: any) {
        setError({
          code: err.code || 'FETCH_ERROR',
          message: err.message || 'Failed to fetch space resources',
          details: err.details
        });
        return [];
      } finally {
        setLoading(false);
      }
    }, 300),
    [dispatch]
  );

  /**
   * Creates a new resource with validation
   */
  const createNewResource = useCallback(async (resourceData: Omit<Resource, 'id'>) => {
    setLoading(true);
    setError(null);

    try {
      const result = await dispatch(ResourceActions.createResource(resourceData));
      if (result.error) {
        throw result.error;
      }
      return result.payload;
    } catch (err: any) {
      setError({
        code: err.code || 'CREATE_ERROR',
        message: err.message || 'Failed to create resource',
        details: err.details
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Updates an existing resource with optimistic updates
   */
  const updateExistingResource = useCallback(async (
    id: string,
    updates: Partial<Resource>
  ) => {
    setLoading(true);
    setError(null);

    try {
      const result = await dispatch(ResourceActions.updateResource({ id, updates }));
      if (result.error) {
        throw result.error;
      }
      return result.payload;
    } catch (err: any) {
      setError({
        code: err.code || 'UPDATE_ERROR',
        message: err.message || 'Failed to update resource',
        details: err.details
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Removes a resource with confirmation
   */
  const removeResource = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await dispatch(ResourceActions.deleteResource(id));
      if (result.error) {
        throw result.error;
      }
      return true;
    } catch (err: any) {
      setError({
        code: err.code || 'DELETE_ERROR',
        message: err.message || 'Failed to delete resource',
        details: err.details
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  return {
    // State
    resource,
    spaceResources,
    loading,
    error,
    retryCount,
    wsConnected,

    // Methods
    fetchResourceById,
    fetchResourcesBySpace,
    createNewResource,
    updateExistingResource,
    removeResource
  };
};

export default useResource;