import React, { useCallback, useState, useMemo } from 'react'; // ^18.0.0
import { Box, Divider, IconButton, Tooltip, useTheme } from '@mui/material'; // ^5.0.0
import { 
  ZoomIn, 
  ZoomOut, 
  PanTool, 
  Edit, 
  Save, 
  Cancel, 
  Delete 
} from '@mui/icons-material'; // ^5.0.0
import { debounce } from 'lodash'; // ^4.17.21

import Button from '../common/Button';
import { FloorPlanStatus } from '../../types/floor-plan.types';

// Props interface with comprehensive type definitions
interface FloorPlanToolbarProps {
  isEditable: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPanModeToggle: () => void;
  onEditModeToggle: () => void;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
  isPanMode: boolean;
  status: FloorPlanStatus;
  zoomLevel: number;
}

// Constants for zoom limits and debounce timing
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const DEBOUNCE_DELAY = 150;

/**
 * FloorPlanToolbar - A comprehensive toolbar for floor plan manipulation
 * Provides controls for view manipulation, editing capabilities, and status-based actions
 */
const FloorPlanToolbar: React.FC<FloorPlanToolbarProps> = React.memo(({
  isEditable,
  onZoomIn,
  onZoomOut,
  onPanModeToggle,
  onEditModeToggle,
  onSave,
  onDelete,
  isPanMode,
  status,
  zoomLevel
}) => {
  const theme = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounced zoom handlers to prevent rapid firing
  const handleZoomIn = useMemo(
    () => debounce(() => {
      if (zoomLevel < ZOOM_MAX) onZoomIn();
    }, DEBOUNCE_DELAY),
    [onZoomIn, zoomLevel]
  );

  const handleZoomOut = useMemo(
    () => debounce(() => {
      if (zoomLevel > ZOOM_MIN) onZoomOut();
    }, DEBOUNCE_DELAY),
    [onZoomOut, zoomLevel]
  );

  // Enhanced save handler with loading state
  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      await onSave();
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  // Delete handler with confirmation
  const handleDelete = useCallback(async () => {
    if (window.confirm('Are you sure you want to delete this floor plan?')) {
      try {
        setIsDeleting(true);
        await onDelete();
      } finally {
        setIsDeleting(false);
      }
    }
  }, [onDelete]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
        padding: theme.spacing(1),
        backgroundColor: theme.palette.background.paper,
        borderRadius: theme.spacing(1),
        boxShadow: theme.shadows[1],
        '@media (max-width: 600px)': {
          flexWrap: 'wrap',
          justifyContent: 'center'
        }
      }}
      role="toolbar"
      aria-label="Floor plan manipulation tools"
    >
      {/* View Controls Group */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title="Zoom In (Ctrl +)">
          <span>
            <IconButton
              onClick={handleZoomIn}
              disabled={zoomLevel >= ZOOM_MAX}
              aria-label="Zoom in"
              size="large"
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <ZoomIn />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Zoom Out (Ctrl -)">
          <span>
            <IconButton
              onClick={handleZoomOut}
              disabled={zoomLevel <= ZOOM_MIN}
              aria-label="Zoom out"
              size="large"
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <ZoomOut />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Pan Mode (Hold Spacebar)">
          <span>
            <IconButton
              onClick={onPanModeToggle}
              color={isPanMode ? 'primary' : 'default'}
              aria-label="Toggle pan mode"
              aria-pressed={isPanMode}
              size="large"
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <PanTool />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Divider orientation="vertical" flexItem />

      {/* Edit Controls Group */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {status === FloorPlanStatus.DRAFT && (
          <>
            <Tooltip title={isEditable ? 'Exit Edit Mode' : 'Enter Edit Mode'}>
              <span>
                <IconButton
                  onClick={onEditModeToggle}
                  color={isEditable ? 'primary' : 'default'}
                  aria-label="Toggle edit mode"
                  aria-pressed={isEditable}
                  size="large"
                  sx={{ minWidth: 44, minHeight: 44 }}
                >
                  <Edit />
                </IconButton>
              </span>
            </Tooltip>

            {isEditable && (
              <>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Save />}
                  onClick={handleSave}
                  loading={isSaving}
                  loadingPosition="start"
                  aria-label="Save changes"
                  size="large"
                >
                  Save
                </Button>

                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={handleDelete}
                  loading={isDeleting}
                  loadingPosition="start"
                  aria-label="Delete floor plan"
                  size="large"
                >
                  Delete
                </Button>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
});

FloorPlanToolbar.displayName = 'FloorPlanToolbar';

export default FloorPlanToolbar;