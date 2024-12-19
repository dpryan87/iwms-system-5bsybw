import React, { useCallback, useMemo } from 'react';
import { Box, IconButton, Tooltip, CircularProgress } from '@mui/material'; // ^5.0.0
import { ZoomIn, ZoomOut, PanTool, Edit, Select } from '@mui/icons-material'; // ^5.0.0
import Button from '../common/Button';
import { useFloorPlan } from '../../hooks/useFloorPlan';
import ErrorBoundary from '../common/ErrorBoundary';

// Constants for component configuration
const CONTROL_BUTTON_SIZE = 'small';
const TOOLTIP_ENTER_DELAY = 500;
const ZOOM_DEBOUNCE_DELAY = 150;
const MIN_TOUCH_TARGET_SIZE = 44;

/**
 * Enhanced props interface for FloorPlanControls component
 */
interface FloorPlanControlsProps {
  onZoomIn: (event: React.MouseEvent | React.KeyboardEvent) => void;
  onZoomOut: (event: React.MouseEvent | React.KeyboardEvent) => void;
  onPanModeToggle: () => void;
  onEditModeToggle: () => void;
  onSelectModeToggle: () => void;
  isPanMode: boolean;
  isEditMode: boolean;
  isSelectMode: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: Error | null;
}

/**
 * FloorPlanControls component provides an accessible control panel for floor plan manipulation
 * Implements WCAG 2.1 Level AA compliance with enhanced keyboard navigation
 */
const FloorPlanControls: React.FC<FloorPlanControlsProps> = React.memo(({
  onZoomIn,
  onZoomOut,
  onPanModeToggle,
  onEditModeToggle,
  onSelectModeToggle,
  isPanMode,
  isEditMode,
  isSelectMode,
  disabled = false,
  loading = false,
  error = null,
}) => {
  // Memoized keyboard event handlers
  const handleKeyboardZoomIn = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onZoomIn(event);
    }
  }, [onZoomIn]);

  const handleKeyboardZoomOut = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onZoomOut(event);
    }
  }, [onZoomOut]);

  // Memoized button states for mode toggles
  const modeButtonStates = useMemo(() => ({
    pan: {
      'aria-pressed': isPanMode,
      'aria-label': isPanMode ? 'Pan mode active' : 'Enable pan mode',
    },
    edit: {
      'aria-pressed': isEditMode,
      'aria-label': isEditMode ? 'Edit mode active' : 'Enable edit mode',
    },
    select: {
      'aria-pressed': isSelectMode,
      'aria-label': isSelectMode ? 'Select mode active' : 'Enable select mode',
    },
  }), [isPanMode, isEditMode, isSelectMode]);

  // Error handling component wrapper
  const handleError = useCallback((error: Error) => {
    console.error('Floor plan control error:', error);
  }, []);

  return (
    <ErrorBoundary onError={handleError}>
      <Box
        role="toolbar"
        aria-label="Floor plan controls"
        sx={{
          display: 'flex',
          gap: 1,
          p: 1,
          backgroundColor: 'background.paper',
          borderRadius: 1,
          boxShadow: 1,
          '& > *': {
            minWidth: MIN_TOUCH_TARGET_SIZE,
            minHeight: MIN_TOUCH_TARGET_SIZE,
          },
        }}
      >
        {/* Zoom Controls */}
        <Tooltip 
          title="Zoom in" 
          enterDelay={TOOLTIP_ENTER_DELAY}
          arrow
        >
          <span>
            <IconButton
              onClick={onZoomIn}
              onKeyDown={handleKeyboardZoomIn}
              disabled={disabled || loading}
              size={CONTROL_BUTTON_SIZE}
              aria-label="Zoom in"
              color="primary"
            >
              <ZoomIn />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip 
          title="Zoom out" 
          enterDelay={TOOLTIP_ENTER_DELAY}
          arrow
        >
          <span>
            <IconButton
              onClick={onZoomOut}
              onKeyDown={handleKeyboardZoomOut}
              disabled={disabled || loading}
              size={CONTROL_BUTTON_SIZE}
              aria-label="Zoom out"
              color="primary"
            >
              <ZoomOut />
            </IconButton>
          </span>
        </Tooltip>

        {/* Mode Toggle Controls */}
        <Tooltip 
          title={isPanMode ? "Pan mode active" : "Enable pan mode"} 
          enterDelay={TOOLTIP_ENTER_DELAY}
          arrow
        >
          <span>
            <IconButton
              onClick={onPanModeToggle}
              disabled={disabled || loading}
              size={CONTROL_BUTTON_SIZE}
              color={isPanMode ? "secondary" : "primary"}
              {...modeButtonStates.pan}
            >
              <PanTool />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip 
          title={isEditMode ? "Edit mode active" : "Enable edit mode"} 
          enterDelay={TOOLTIP_ENTER_DELAY}
          arrow
        >
          <span>
            <IconButton
              onClick={onEditModeToggle}
              disabled={disabled || loading}
              size={CONTROL_BUTTON_SIZE}
              color={isEditMode ? "secondary" : "primary"}
              {...modeButtonStates.edit}
            >
              <Edit />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip 
          title={isSelectMode ? "Select mode active" : "Enable select mode"} 
          enterDelay={TOOLTIP_ENTER_DELAY}
          arrow
        >
          <span>
            <IconButton
              onClick={onSelectModeToggle}
              disabled={disabled || loading}
              size={CONTROL_BUTTON_SIZE}
              color={isSelectMode ? "secondary" : "primary"}
              {...modeButtonStates.select}
            >
              <Select />
            </IconButton>
          </span>
        </Tooltip>

        {/* Loading Indicator */}
        {loading && (
          <CircularProgress
            size={24}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: '-12px',
              marginLeft: '-12px',
            }}
          />
        )}
      </Box>
    </ErrorBoundary>
  );
});

// Display name for debugging
FloorPlanControls.displayName = 'FloorPlanControls';

export default FloorPlanControls;