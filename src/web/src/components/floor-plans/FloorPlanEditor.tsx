import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Paper, Toolbar, IconButton, Tooltip, Divider } from '@mui/material'; // @mui/material version ^5.0.0
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  PanTool as PanIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Close as CloseIcon
} from '@mui/icons-material'; // @mui/icons-material version ^5.0.0
import { useUndoable } from 'react-use'; // version ^17.4.0
import { debounce } from 'lodash'; // version ^4.17.21

import {
  FloorPlan,
  FloorPlanSpace,
  FloorPlanStatus,
  SpaceType,
  Coordinates,
  ValidationResult
} from '../../types/floor-plan.types';
import { validateFloorPlan } from '../../utils/floor-plan.utils';
import ErrorBoundary from '../common/ErrorBoundary';
import Notification from '../common/Notification';

// Props interface for the FloorPlanEditor component
interface FloorPlanEditorProps {
  floorPlan: FloorPlan;
  onSave: (updatedPlan: FloorPlan) => Promise<void>;
  onCancel: () => void;
  autoSave?: boolean;
  onError?: (error: Error) => void;
}

// Internal state interface for the editor
interface EditorState {
  selectedSpaceId: string | null;
  isPanMode: boolean;
  zoom: number;
  isDirty: boolean;
  validationErrors: ValidationResult[];
  isAutosaving: boolean;
}

/**
 * FloorPlanEditor component provides a comprehensive interface for editing floor plans
 * with support for space management, validation, and real-time updates.
 */
const FloorPlanEditor: React.FC<FloorPlanEditorProps> = ({
  floorPlan,
  onSave,
  onCancel,
  autoSave = true,
  onError
}) => {
  // State management with undo/redo support
  const [presentFloorPlan, setPresentFloorPlan, { undo, redo, canUndo, canRedo }] = useUndoable(floorPlan);
  
  // Editor state
  const [editorState, setEditorState] = useState<EditorState>({
    selectedSpaceId: null,
    isPanMode: false,
    zoom: 1,
    isDirty: false,
    validationErrors: [],
    isAutosaving: false
  });

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Notification state
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  /**
   * Handles space selection with keyboard support
   */
  const handleSpaceSelect = useCallback((spaceId: string | null, event?: KeyboardEvent) => {
    if (event && !['Enter', 'Space'].includes(event.code)) {
      return;
    }

    setEditorState(prev => ({
      ...prev,
      selectedSpaceId: spaceId
    }));

    // Update focus management for accessibility
    if (spaceId && containerRef.current) {
      const spaceElement = containerRef.current.querySelector(`[data-space-id="${spaceId}"]`);
      if (spaceElement instanceof HTMLElement) {
        spaceElement.focus();
      }
    }
  }, []);

  /**
   * Handles updates to space properties with validation
   */
  const handleSpaceUpdate = useCallback(async (updatedSpace: FloorPlanSpace) => {
    try {
      // Update floor plan with new space data
      const updatedFloorPlan = {
        ...presentFloorPlan,
        spaces: presentFloorPlan.spaces.map(space =>
          space.id === updatedSpace.id ? updatedSpace : space
        )
      };

      // Validate the updated floor plan
      const validationResult = await validateFloorPlan(updatedFloorPlan);
      if (!validationResult.isValid) {
        setEditorState(prev => ({
          ...prev,
          validationErrors: [validationResult]
        }));
        return;
      }

      // Update state and mark as dirty
      setPresentFloorPlan(updatedFloorPlan);
      setEditorState(prev => ({
        ...prev,
        isDirty: true,
        validationErrors: []
      }));

      // Trigger autosave if enabled
      if (autoSave) {
        debouncedSave(updatedFloorPlan);
      }
    } catch (error) {
      handleError(error as Error);
    }
  }, [presentFloorPlan, setPresentFloorPlan, autoSave]);

  /**
   * Debounced save handler for autosave functionality
   */
  const debouncedSave = useCallback(
    debounce(async (planToSave: FloorPlan) => {
      try {
        setEditorState(prev => ({ ...prev, isAutosaving: true }));
        await onSave(planToSave);
        setEditorState(prev => ({
          ...prev,
          isDirty: false,
          isAutosaving: false
        }));
        showNotification('Changes saved successfully', 'success');
      } catch (error) {
        handleError(error as Error);
      }
    }, 2000),
    [onSave]
  );

  /**
   * Handles zoom operations
   */
  const handleZoom = useCallback((delta: number) => {
    setEditorState(prev => ({
      ...prev,
      zoom: Math.max(0.1, Math.min(5, prev.zoom + delta))
    }));
  }, []);

  /**
   * Handles pan mode toggle
   */
  const togglePanMode = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      isPanMode: !prev.isPanMode
    }));
  }, []);

  /**
   * Error handler with notification
   */
  const handleError = useCallback((error: Error) => {
    setEditorState(prev => ({
      ...prev,
      isAutosaving: false
    }));
    showNotification(error.message, 'error');
    if (onError) {
      onError(error);
    }
  }, [onError]);

  /**
   * Shows notification with specified message and severity
   */
  const showNotification = useCallback((message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({
      open: true,
      message,
      severity
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  return (
    <ErrorBoundary onError={onError}>
      <Box
        ref={containerRef}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default'
        }}
      >
        <Toolbar>
          <Tooltip title="Zoom In">
            <IconButton onClick={() => handleZoom(0.1)} aria-label="zoom in">
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton onClick={() => handleZoom(-0.1)} aria-label="zoom out">
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Pan Mode">
            <IconButton
              onClick={togglePanMode}
              color={editorState.isPanMode ? 'primary' : 'default'}
              aria-label="toggle pan mode"
              aria-pressed={editorState.isPanMode}
            >
              <PanIcon />
            </IconButton>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          <Tooltip title="Undo">
            <span>
              <IconButton onClick={undo} disabled={!canUndo} aria-label="undo">
                <UndoIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo">
            <span>
              <IconButton onClick={redo} disabled={!canRedo} aria-label="redo">
                <RedoIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Save">
            <IconButton
              onClick={() => onSave(presentFloorPlan)}
              disabled={!editorState.isDirty || editorState.isAutosaving}
              aria-label="save changes"
            >
              <SaveIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close">
            <IconButton onClick={onCancel} aria-label="close editor">
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>

        <Paper
          sx={{
            flexGrow: 1,
            m: 2,
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              transform: `scale(${editorState.zoom})`,
              cursor: editorState.isPanMode ? 'grab' : 'default'
            }}
            aria-label="floor plan editor canvas"
          />
        </Paper>

        <Notification
          open={notification.open}
          message={notification.message}
          severity={notification.severity}
          onClose={() => setNotification(prev => ({ ...prev, open: false }))}
        />
      </Box>
    </ErrorBoundary>
  );
};

export default FloorPlanEditor;