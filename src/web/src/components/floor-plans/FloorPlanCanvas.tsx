import React, { useRef, useEffect, useCallback } from 'react';
import { fabric } from 'fabric'; // version: 5.3.0
import {
  FloorPlan,
  FloorPlanSpace,
  Coordinates,
  Dimensions
} from '../../types/floor-plan.types';
import {
  calculateSpaceArea,
  validateSpaceCoordinates,
  scaleCoordinates,
  calculateCentroid
} from '../../utils/floor-plan.utils';

// Constants for styling and interaction
const SPACE_FILL_COLOR = 'rgba(200, 200, 200, 0.3)';
const SPACE_STROKE_COLOR = '#666666';
const SELECTED_SPACE_COLOR = 'rgba(0, 120, 212, 0.4)';
const SPACE_STROKE_WIDTH = 2;
const LABEL_FONT_FAMILY = 'Roboto, sans-serif';
const LABEL_FONT_SIZE = 14;
const TOUCH_THRESHOLD = 10;
const CACHE_SIZE = 50;
const MAX_UNDO_STEPS = 20;

// LRU Cache for polygon path calculations
const pathCache = new Map<string, string>();

interface FloorPlanCanvasProps {
  floorPlan: FloorPlan;
  isEditable: boolean;
  zoom: number;
  selectedSpaceId: string | null;
  onSpaceSelect: (spaceId: string | null) => void;
  onSpaceUpdate: (space: FloorPlanSpace) => void;
  onError: (error: Error) => void;
  accessibilityLabel: string;
}

/**
 * Interactive canvas component for floor plan visualization and editing
 * with enhanced touch support and performance optimizations
 */
const FloorPlanCanvas: React.FC<FloorPlanCanvasProps> = ({
  floorPlan,
  isEditable,
  zoom,
  selectedSpaceId,
  onSpaceSelect,
  onSpaceUpdate,
  onError,
  accessibilityLabel
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const undoStackRef = useRef<fabric.Object[][]>([]);

  /**
   * Initializes the fabric.js canvas with enhanced touch support
   */
  const initializeCanvas = useCallback(() => {
    try {
      if (!canvasRef.current) return;

      // Initialize fabric canvas with touch support
      fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
        preserveObjectStacking: true,
        selection: isEditable,
        enableRetinaScaling: true,
        renderOnAddRemove: false,
        allowTouchScrolling: !isEditable
      });

      const canvas = fabricCanvasRef.current;

      // Configure canvas dimensions based on floor plan metadata
      const { width, height, scale } = floorPlan.metadata.dimensions;
      canvas.setWidth(width * scale);
      canvas.setHeight(height * scale);

      // Setup touch event handling
      canvas.on('touch:gesture', handleTouchGesture);
      canvas.on('touch:drag', handleTouchDrag);
      canvas.on('mouse:wheel', handleZoom);

      // Setup selection handling
      canvas.on('selection:created', handleSelection);
      canvas.on('selection:cleared', () => onSpaceSelect(null));

      // Setup modification tracking
      if (isEditable) {
        canvas.on('object:modified', handleObjectModified);
      }

      // Initialize ResizeObserver for responsive canvas
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(canvasRef.current.parentElement!);

      return () => {
        resizeObserver.disconnect();
        canvas.dispose();
      };
    } catch (error) {
      onError(new Error(`Canvas initialization failed: ${error.message}`));
    }
  }, [isEditable, floorPlan.metadata.dimensions]);

  /**
   * Renders floor plan spaces with performance optimizations
   */
  const renderSpaces = useCallback((spaces: FloorPlanSpace[]) => {
    try {
      if (!fabricCanvasRef.current) return;

      const canvas = fabricCanvasRef.current;
      canvas.clear();

      // Progressive loading for large space sets
      const batchSize = 20;
      let currentBatch = 0;

      const renderBatch = () => {
        const batch = spaces.slice(
          currentBatch * batchSize,
          (currentBatch + 1) * batchSize
        );

        batch.forEach(space => {
          // Create space polygon with caching
          const cacheKey = `${space.id}_${JSON.stringify(space.coordinates)}`;
          let pathString = pathCache.get(cacheKey);

          if (!pathString) {
            const scaledCoords = scaleCoordinates(
              space.coordinates,
              floorPlan.metadata.dimensions.scale
            );
            pathString = scaledCoords
              .map((coord, i) => `${i === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`)
              .join(' ') + ' Z';

            // Cache management
            if (pathCache.size >= CACHE_SIZE) {
              const firstKey = pathCache.keys().next().value;
              pathCache.delete(firstKey);
            }
            pathCache.set(cacheKey, pathString);
          }

          // Create fabric polygon
          const polygon = new fabric.Path(pathString, {
            fill: space.id === selectedSpaceId ? SELECTED_SPACE_COLOR : SPACE_FILL_COLOR,
            stroke: SPACE_STROKE_COLOR,
            strokeWidth: SPACE_STROKE_WIDTH,
            selectable: isEditable,
            objectCaching: true,
            data: { spaceId: space.id }
          });

          // Add space label
          const centroid = calculateCentroid(space.coordinates);
          const label = new fabric.Text(space.name, {
            left: centroid.x,
            top: centroid.y,
            fontSize: LABEL_FONT_SIZE,
            fontFamily: LABEL_FONT_FAMILY,
            originX: 'center',
            originY: 'center',
            selectable: false
          });

          canvas.add(polygon, label);
        });

        if (++currentBatch * batchSize < spaces.length) {
          requestAnimationFrame(renderBatch);
        } else {
          canvas.renderAll();
        }
      };

      renderBatch();
    } catch (error) {
      onError(new Error(`Space rendering failed: ${error.message}`));
    }
  }, [selectedSpaceId, isEditable, floorPlan.metadata.dimensions.scale]);

  // Event Handlers
  const handleTouchGesture = useCallback((event: fabric.IGestureEvent) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const { scale, rotation } = event.self;
    const target = canvas.getActiveObject();

    if (target && isEditable) {
      target.scale(target.scaleX! * scale);
      target.rotate((target.angle! + rotation) % 360);
      canvas.renderAll();
    }
  }, [isEditable]);

  const handleTouchDrag = useCallback((event: fabric.IDragEvent) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isEditable) return;

    const pointer = canvas.getPointer(event.self.e);
    const target = canvas.getActiveObject();

    if (target) {
      target.set({
        left: pointer.x - target.width! * target.scaleX! / 2,
        top: pointer.y - target.height! * target.scaleY! / 2
      });
      canvas.renderAll();
    }
  }, [isEditable]);

  const handleZoom = useCallback((event: fabric.IEvent) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const delta = (event as any).e.deltaY;
    let newZoom = canvas.getZoom() * (0.999 ** delta);
    newZoom = Math.min(Math.max(0.1, newZoom), 5);

    canvas.zoomToPoint(
      { x: (event as any).e.offsetX, y: (event as any).e.offsetY },
      newZoom
    );

    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleSelection = useCallback((event: fabric.IEvent) => {
    const selection = event.selected?.[0];
    if (selection && 'data' in selection) {
      onSpaceSelect(selection.data.spaceId);
    }
  }, [onSpaceSelect]);

  const handleObjectModified = useCallback((event: fabric.IEvent) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !event.target) return;

    const modified = event.target;
    if ('data' in modified) {
      const space = floorPlan.spaces.find(s => s.id === modified.data.spaceId);
      if (space) {
        const updatedCoordinates = (modified as fabric.Path).path
          .filter(cmd => cmd[0] !== 'Z')
          .map(cmd => ({ x: cmd[1], y: cmd[2] }));

        const validationResult = validateSpaceCoordinates(
          updatedCoordinates,
          floorPlan.metadata.dimensions
        );

        if (validationResult.isValid) {
          const updatedSpace = {
            ...space,
            coordinates: updatedCoordinates,
            area: calculateSpaceArea(updatedCoordinates)
          };
          onSpaceUpdate(updatedSpace);

          // Update undo stack
          undoStackRef.current.push([modified.clone()]);
          if (undoStackRef.current.length > MAX_UNDO_STEPS) {
            undoStackRef.current.shift();
          }
        } else {
          onError(new Error(`Invalid space modification: ${validationResult.errors.join(', ')}`));
          canvas.renderAll();
        }
      }
    }
  }, [floorPlan.spaces, onSpaceUpdate, onError]);

  const handleResize = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !canvasRef.current?.parentElement) return;

    const parent = canvasRef.current.parentElement;
    const ratio = canvas.getWidth() / canvas.getHeight();
    const containerWidth = parent.clientWidth;
    const containerHeight = parent.clientHeight;

    let width = containerWidth;
    let height = containerWidth / ratio;

    if (height > containerHeight) {
      height = containerHeight;
      width = containerHeight * ratio;
    }

    canvas.setDimensions({ width, height }, { cssOnly: true });
    canvas.renderAll();
  }, []);

  // Effects
  useEffect(() => {
    initializeCanvas();
  }, [initializeCanvas]);

  useEffect(() => {
    renderSpaces(floorPlan.spaces);
  }, [floorPlan.spaces, renderSpaces]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.setZoom(zoom);
      canvas.renderAll();
    }
  }, [zoom]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={accessibilityLabel}
      role="img"
      tabIndex={0}
    />
  );
};

export default FloorPlanCanvas;