import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Paper, CircularProgress, Alert } from '@mui/material'; // version: ^5.0.0
import { debounce } from 'lodash'; // version: ^4.17.21
import FloorPlanCanvas from './FloorPlanCanvas';
import FloorPlanControls from './FloorPlanControls';
import useWebSocket, { WebSocketConnectionState } from '../../hooks/useWebSocket';
import ErrorBoundary from '../common/ErrorBoundary';
import { FloorPlan, FloorPlanSpace } from '../../types/floor-plan.types';

// Constants for zoom and interaction behavior
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;
const INITIAL_ZOOM = 1.0;
const DEBOUNCE_DELAY = 150;
const WS_RECONNECT_DELAY = 3000;

interface FloorPlanViewerProps {
  floorPlan: FloorPlan;
  isEditable: boolean;
  onSpaceSelect: (spaceId: string | null) => void;
  onSpaceUpdate: (space: FloorPlanSpace) => Promise<void>;
  onSave: () => Promise<void>;
  wsEndpoint: string;
}

/**
 * FloorPlanViewer component provides an interactive floor plan visualization interface
 * with real-time updates and WCAG 2.1 Level AA compliance
 */
const FloorPlanViewer: React.FC<FloorPlanViewerProps> = React.memo(({
  floorPlan,
  isEditable,
  onSpaceSelect,
  onSpaceUpdate,
  onSave,
  wsEndpoint
}) => {
  // State management
  const [zoom, setZoom] = useState<number>(INITIAL_ZOOM);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isSelectMode, setIsSelectMode] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // WebSocket integration for real-time updates
  const { state: wsState, connect, disconnect } = useWebSocket(wsEndpoint, {
    autoConnect: true,
    reconnectAttempts: 5,
    reconnectInterval: WS_RECONNECT_DELAY,
    heartbeatInterval: 30000
  });

  // Memoized loading state
  const isLoading = useMemo(() => 
    wsState.connectionState === WebSocketConnectionState.CONNECTING ||
    wsState.connectionState === WebSocketConnectionState.RECONNECTING,
    [wsState.connectionState]
  );

  // Debounced zoom handlers
  const handleZoomIn = useCallback(debounce(() => {
    setZoom(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, DEBOUNCE_DELAY), []);

  const handleZoomOut = useCallback(debounce(() => {
    setZoom(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, DEBOUNCE_DELAY), []);

  // Mode toggle handlers
  const handlePanModeToggle = useCallback(() => {
    setIsPanMode(prev => !prev);
    if (!isPanMode) {
      setIsEditMode(false);
      setIsSelectMode(false);
    }
  }, [isPanMode]);

  const handleEditModeToggle = useCallback(() => {
    if (!isEditable) return;
    setIsEditMode(prev => !prev);
    if (!isEditMode) {
      setIsPanMode(false);
      setIsSelectMode(false);
    }
  }, [isEditable, isEditMode]);

  const handleSelectModeToggle = useCallback(() => {
    setIsSelectMode(prev => !prev);
    if (!isSelectMode) {
      setIsPanMode(false);
      setIsEditMode(false);
    }
  }, [isSelectMode]);

  // Space selection handler
  const handleSpaceSelect = useCallback((spaceId: string | null) => {
    setSelectedSpaceId(spaceId);
    onSpaceSelect(spaceId);
  }, [onSpaceSelect]);

  // Space update handler with optimistic updates
  const handleSpaceUpdate = useCallback(async (space: FloorPlanSpace) => {
    try {
      await onSpaceUpdate(space);
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to update space'));
    }
  }, [onSpaceUpdate]);

  // Error handler
  const handleError = useCallback((error: Error) => {
    setError(error);
    console.error('FloorPlanViewer error:', error);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <ErrorBoundary onError={handleError}>
      <Paper
        elevation={2}
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Controls toolbar */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 1,
            backgroundColor: 'background.paper',
            borderRadius: 1
          }}
        >
          <FloorPlanControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onPanModeToggle={handlePanModeToggle}
            onEditModeToggle={handleEditModeToggle}
            onSelectModeToggle={handleSelectModeToggle}
            isPanMode={isPanMode}
            isEditMode={isEditMode}
            isSelectMode={isSelectMode}
            disabled={isLoading}
            loading={isLoading}
            error={error}
          />
        </Box>

        {/* Main canvas area */}
        <Box
          sx={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <FloorPlanCanvas
            floorPlan={floorPlan}
            isEditable={isEditable && isEditMode}
            zoom={zoom}
            selectedSpaceId={selectedSpaceId}
            onSpaceSelect={handleSpaceSelect}
            onSpaceUpdate={handleSpaceUpdate}
            onError={handleError}
            accessibilityLabel={`Floor plan for ${floorPlan.metadata.name}`}
          />

          {/* Loading indicator */}
          {isLoading && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <CircularProgress />
            </Box>
          )}

          {/* Error display */}
          {error && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                right: 16
              }}
            >
              <Alert 
                severity="error" 
                onClose={() => setError(null)}
                sx={{ width: '100%' }}
              >
                {error.message}
              </Alert>
            </Box>
          )}
        </Box>
      </Paper>
    </ErrorBoundary>
  );
});

// Display name for debugging
FloorPlanViewer.displayName = 'FloorPlanViewer';

export default FloorPlanViewer;