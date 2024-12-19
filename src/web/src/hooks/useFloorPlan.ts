import { useCallback, useState, useEffect, useRef } from 'react'; // version: ^18.0.0
import { useDebounce } from 'use-debounce'; // version: ^9.0.0
import { useQueryClient, useMutation, useQuery } from 'react-query'; // version: ^4.0.0
import { 
  FloorPlan, 
  FloorPlanSpace, 
  FloorPlanStatus,
  FloorPlanMetadata 
} from '../types/floor-plan.types';

// Enhanced error type for comprehensive error handling
interface FloorPlanError {
  code: string;
  message: string;
  retryCount: number;
  lastAttempt: Date;
  recoverable: boolean;
}

// Real-time synchronization status
interface SyncStatus {
  connected: boolean;
  lastSync: Date;
  pendingChanges: number;
}

// Performance and usage metrics
interface FloorPlanMetrics {
  loadTime: number;
  renderTime: number;
  operationLatency: number;
  cacheHitRate: number;
}

// Validation state interface
interface FloorPlanValidation {
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
}

// Enhanced operation handlers
interface FloorPlanOperations {
  update: (updates: Partial<FloorPlan>) => Promise<void>;
  addSpace: (space: Omit<FloorPlanSpace, 'id'>) => Promise<void>;
  removeSpace: (spaceId: string) => Promise<void>;
  updateMetadata: (metadata: Partial<FloorPlanMetadata>) => Promise<void>;
  publish: () => Promise<void>;
  revertChanges: () => Promise<void>;
}

// Configuration options
export interface UseFloorPlanOptions {
  enableRealTimeSync?: boolean;
  retryAttempts?: number;
  cacheTimeout?: number;
  validate3D?: boolean;
  optimisticUpdates?: boolean;
}

// Hook return type
export interface UseFloorPlanReturn {
  loading: boolean;
  error: FloorPlanError | null;
  floorPlan: FloorPlan | null;
  validation: FloorPlanValidation;
  syncStatus: SyncStatus;
  operations: FloorPlanOperations;
  metrics: FloorPlanMetrics;
}

const DEFAULT_OPTIONS: UseFloorPlanOptions = {
  enableRealTimeSync: true,
  retryAttempts: 3,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  validate3D: true,
  optimisticUpdates: true,
};

/**
 * Advanced hook for managing floor plan operations with real-time synchronization
 * and optimistic updates
 * @param propertyId - Unique identifier of the property
 * @param options - Configuration options
 */
export function useFloorPlan(
  propertyId: string,
  options: UseFloorPlanOptions = {}
): UseFloorPlanReturn {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [metrics, setMetrics] = useState<FloorPlanMetrics>({
    loadTime: 0,
    renderTime: 0,
    operationLatency: 0,
    cacheHitRate: 0,
  });

  // State management
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    connected: false,
    lastSync: new Date(),
    pendingChanges: 0,
  });

  const [validation, setValidation] = useState<FloorPlanValidation>({
    isValid: true,
    errors: {},
    warnings: {},
  });

  // Query for fetching floor plan data
  const { 
    data: floorPlan, 
    error, 
    isLoading 
  } = useQuery<FloorPlan, FloorPlanError>(
    ['floorPlan', propertyId],
    async () => {
      const startTime = performance.now();
      const response = await fetch(`/api/floor-plans/${propertyId}`);
      if (!response.ok) throw new Error('Failed to fetch floor plan');
      const data = await response.json();
      setMetrics(prev => ({
        ...prev,
        loadTime: performance.now() - startTime,
      }));
      return data;
    },
    {
      staleTime: mergedOptions.cacheTimeout,
      cacheTime: mergedOptions.cacheTimeout,
    }
  );

  // Mutation for updating floor plan
  const updateMutation = useMutation<void, FloorPlanError, Partial<FloorPlan>>(
    async (updates) => {
      const startTime = performance.now();
      const response = await fetch(`/api/floor-plans/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update floor plan');
      setMetrics(prev => ({
        ...prev,
        operationLatency: performance.now() - startTime,
      }));
    },
    {
      onMutate: async (updates) => {
        if (mergedOptions.optimisticUpdates) {
          await queryClient.cancelQueries(['floorPlan', propertyId]);
          const previousData = queryClient.getQueryData<FloorPlan>(['floorPlan', propertyId]);
          queryClient.setQueryData(['floorPlan', propertyId], (old: FloorPlan | undefined) => ({
            ...old,
            ...updates,
          }));
          return { previousData };
        }
      },
      onError: (err, _, context) => {
        if (context?.previousData) {
          queryClient.setQueryData(['floorPlan', propertyId], context.previousData);
        }
      },
    }
  );

  // Real-time synchronization setup
  useEffect(() => {
    if (!mergedOptions.enableRealTimeSync) return;

    const ws = new WebSocket(`ws://api/floor-plans/${propertyId}/sync`);
    wsRef.current = ws;

    ws.onopen = () => {
      setSyncStatus(prev => ({ ...prev, connected: true }));
    };

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      queryClient.setQueryData(['floorPlan', propertyId], update);
      setSyncStatus(prev => ({
        ...prev,
        lastSync: new Date(),
        pendingChanges: Math.max(0, prev.pendingChanges - 1),
      }));
    };

    ws.onclose = () => {
      setSyncStatus(prev => ({ ...prev, connected: false }));
    };

    return () => {
      ws.close();
    };
  }, [propertyId, mergedOptions.enableRealTimeSync]);

  // Debounced validation
  const [debouncedValidate] = useDebounce(
    (plan: FloorPlan) => {
      const errors: Record<string, string[]> = {};
      const warnings: Record<string, string[]> = {};

      // Validate 3D coordinates if enabled
      if (mergedOptions.validate3D) {
        plan.spaces.forEach(space => {
          space.coordinates.forEach((coord, index) => {
            if (coord.z === null) {
              warnings[`space-${space.id}`] = [
                ...(warnings[`space-${space.id}`] || []),
                `Coordinate at index ${index} missing Z value`,
              ];
            }
          });
        });
      }

      setValidation({
        isValid: Object.keys(errors).length === 0,
        errors,
        warnings,
      });
    },
    500
  );

  // Enhanced operations object
  const operations: FloorPlanOperations = {
    update: useCallback(async (updates: Partial<FloorPlan>) => {
      await updateMutation.mutateAsync(updates);
    }, [updateMutation]),

    addSpace: useCallback(async (space: Omit<FloorPlanSpace, 'id'>) => {
      if (!floorPlan) return;
      const newSpace = { ...space, id: crypto.randomUUID() };
      await operations.update({
        spaces: [...floorPlan.spaces, newSpace],
      });
    }, [floorPlan]),

    removeSpace: useCallback(async (spaceId: string) => {
      if (!floorPlan) return;
      await operations.update({
        spaces: floorPlan.spaces.filter(space => space.id !== spaceId),
      });
    }, [floorPlan]),

    updateMetadata: useCallback(async (metadata: Partial<FloorPlanMetadata>) => {
      if (!floorPlan) return;
      await operations.update({
        metadata: { ...floorPlan.metadata, ...metadata },
      });
    }, [floorPlan]),

    publish: useCallback(async () => {
      if (!floorPlan) return;
      await operations.update({
        status: FloorPlanStatus.PUBLISHED,
      });
    }, [floorPlan]),

    revertChanges: useCallback(async () => {
      await queryClient.invalidateQueries(['floorPlan', propertyId]);
    }, [propertyId]),
  };

  // Validate floor plan when it changes
  useEffect(() => {
    if (floorPlan && mergedOptions.validate3D) {
      debouncedValidate(floorPlan);
    }
  }, [floorPlan, mergedOptions.validate3D]);

  return {
    loading: isLoading,
    error: error || null,
    floorPlan,
    validation,
    syncStatus,
    operations,
    metrics,
  };
}