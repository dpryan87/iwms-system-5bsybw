import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Box, 
  Paper, 
  Button, 
  Typography, 
  CircularProgress, 
  Skeleton 
} from '@mui/material';
import { debounce } from 'lodash';

// Internal components
import FloorPlanViewer from '../components/floor-plans/FloorPlanViewer';
import FloorPlanList from '../components/floor-plans/FloorPlanList';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Hooks and services
import { useFloorPlan } from '../hooks/useFloorPlan';

// Types
import { FloorPlan, FloorPlanSpace } from '../types/floor-plan.types';

// Enhanced state interface for the floor plans page
interface FloorPlanPageState {
  selectedFloorPlan: FloorPlan | null;
  isEditing: boolean;
  viewMode: 'list' | 'detail';
  optimisticUpdates: Map<string, Partial<FloorPlan>>;
  errorState: {
    message: string;
    severity: 'error' | 'warning' | 'info';
  } | null;
}

/**
 * FloorPlans component provides a comprehensive interface for managing floor plans
 * with real-time updates, optimistic UI, and accessibility features
 */
const FloorPlans: React.FC = () => {
  // Router hooks
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // State management
  const [state, setState] = useState<FloorPlanPageState>({
    selectedFloorPlan: null,
    isEditing: false,
    viewMode: 'list',
    optimisticUpdates: new Map(),
    errorState: null
  });

  // Floor plan management hook
  const {
    loading,
    error,
    floorPlan,
    validation,
    syncStatus,
    operations,
    metrics
  } = useFloorPlan(propertyId!, {
    enableRealTimeSync: true,
    validate3D: true,
    optimisticUpdates: true
  });

  // Memoized handlers
  const handleFloorPlanSelect = useCallback((selectedPlan: FloorPlan) => {
    setState(prev => ({
      ...prev,
      selectedFloorPlan: selectedPlan,
      viewMode: 'detail'
    }));
    navigate(`${location.pathname}/${selectedPlan.id}`);
  }, [navigate, location.pathname]);

  const handleSpaceUpdate = useCallback(async (space: FloorPlanSpace) => {
    if (!state.selectedFloorPlan) return;

    try {
      // Apply optimistic update
      const updatedSpaces = state.selectedFloorPlan.spaces.map(s => 
        s.id === space.id ? space : s
      );

      const optimisticUpdate = {
        ...state.selectedFloorPlan,
        spaces: updatedSpaces
      };

      setState(prev => ({
        ...prev,
        optimisticUpdates: prev.optimisticUpdates.set(space.id, optimisticUpdate)
      }));

      // Perform actual update
      await operations.update({ spaces: updatedSpaces });

      // Clear optimistic update on success
      setState(prev => {
        const updates = new Map(prev.optimisticUpdates);
        updates.delete(space.id);
        return { ...prev, optimisticUpdates: updates };
      });
    } catch (error) {
      // Rollback optimistic update on failure
      setState(prev => {
        const updates = new Map(prev.optimisticUpdates);
        updates.delete(space.id);
        return {
          ...prev,
          optimisticUpdates: updates,
          errorState: {
            message: 'Failed to update space. Changes have been reverted.',
            severity: 'error'
          }
        };
      });
    }
  }, [state.selectedFloorPlan, operations]);

  // Debounced save handler
  const handleSave = useMemo(() => 
    debounce(async () => {
      if (!state.selectedFloorPlan) return;

      try {
        await operations.update(state.selectedFloorPlan);
        setState(prev => ({
          ...prev,
          isEditing: false,
          errorState: {
            message: 'Floor plan saved successfully',
            severity: 'info'
          }
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          errorState: {
            message: 'Failed to save floor plan',
            severity: 'error'
          }
        }));
      }
    }, 500),
    [state.selectedFloorPlan, operations]
  );

  // Effect for handling validation errors
  useEffect(() => {
    if (!validation.isValid && Object.keys(validation.errors).length > 0) {
      setState(prev => ({
        ...prev,
        errorState: {
          message: Object.values(validation.errors)[0][0],
          severity: 'warning'
        }
      }));
    }
  }, [validation]);

  // Render loading state
  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={400} />
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </Box>
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error" variant="h6">
          {error.message}
        </Typography>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h5" component="h1">
            Floor Plans
          </Typography>
          {state.viewMode === 'detail' && (
            <Button
              onClick={() => setState(prev => ({ ...prev, viewMode: 'list' }))}
              sx={{ mt: 1 }}
            >
              Back to List
            </Button>
          )}
        </Box>

        {/* Main content */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {state.viewMode === 'list' ? (
            <FloorPlanList
              propertyId={propertyId!}
              onFloorPlanSelect={handleFloorPlanSelect}
              initialSort={{ field: 'metadata.level', direction: 'asc' }}
            />
          ) : (
            <Paper sx={{ height: '100%', position: 'relative' }}>
              <FloorPlanViewer
                floorPlan={state.selectedFloorPlan!}
                isEditable={state.isEditing}
                onSpaceSelect={() => {}}
                onSpaceUpdate={handleSpaceUpdate}
                onSave={handleSave}
                wsEndpoint={`ws://api/floor-plans/${state.selectedFloorPlan?.id}/sync`}
              />
            </Paper>
          )}
        </Box>

        {/* Status indicator */}
        {syncStatus && (
          <Box
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            {syncStatus.connected ? (
              <Typography variant="caption" color="success.main">
                Connected
              </Typography>
            ) : (
              <Typography variant="caption" color="error.main">
                Disconnected
              </Typography>
            )}
            {syncStatus.pendingChanges > 0 && <CircularProgress size={16} />}
          </Box>
        )}
      </Box>
    </ErrorBoundary>
  );
};

export default FloorPlans;