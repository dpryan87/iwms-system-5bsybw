import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import WS from 'jest-websocket-mock';
import FloorPlanViewer from '../../src/components/floor-plans/FloorPlanViewer';
import { FloorPlan, FloorPlanSpace, WebSocketProvider } from '../../src/types/floor-plan.types';
import ErrorBoundary from '../../src/components/common/ErrorBoundary';

// Mock data
const mockFloorPlan: FloorPlan = {
  id: 'test-floor-plan',
  metadata: {
    name: 'Test Floor Plan',
    level: 1,
    totalArea: 1000,
    dimensions: {
      width: 1000,
      height: 800,
      scale: 1,
      unit: 'METRIC'
    },
    fileUrl: 'test-url',
    lastModified: new Date(),
    version: '1.0',
    customFields: {}
  },
  spaces: [
    {
      id: 'space-1',
      name: 'Test Space',
      type: 'OFFICE',
      coordinates: [
        { x: 0, y: 0, z: null },
        { x: 100, y: 0, z: null },
        { x: 100, y: 100, z: null },
        { x: 0, y: 100, z: null }
      ],
      area: 100,
      capacity: 4,
      assignedBusinessUnit: null,
      resources: [],
      occupancyStatus: 'VACANT'
    }
  ],
  status: 'PUBLISHED'
};

// Mock callbacks
const mockCallbacks = {
  onSpaceSelect: vi.fn(),
  onSpaceUpdate: vi.fn(),
  onSave: vi.fn(),
  onError: vi.fn()
};

// Helper function to render component with providers
const renderWithProviders = (customProps = {}) => {
  const wsServer = new WS('ws://localhost:1234');
  
  const defaultProps = {
    floorPlan: mockFloorPlan,
    isEditable: true,
    onSpaceSelect: mockCallbacks.onSpaceSelect,
    onSpaceUpdate: mockCallbacks.onSpaceUpdate,
    onSave: mockCallbacks.onSave,
    wsEndpoint: 'ws://localhost:1234'
  };

  const utils = render(
    <WebSocketProvider>
      <ErrorBoundary onError={mockCallbacks.onError}>
        <FloorPlanViewer {...defaultProps} {...customProps} />
      </ErrorBoundary>
    </WebSocketProvider>
  );

  return { ...utils, wsServer };
};

// Helper function for performance measurements
const createPerformanceWrapper = (component: React.ReactElement) => {
  const measurements: { renderTime: number; memoryUsage: number }[] = [];
  
  const PerformanceWrapper = () => {
    const startTime = performance.now();
    React.useEffect(() => {
      const endTime = performance.now();
      measurements.push({
        renderTime: endTime - startTime,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
      });
    });

    return component;
  };

  return { PerformanceWrapper, measurements };
};

describe('FloorPlanViewer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering and Initialization', () => {
    it('should render floor plan canvas with correct dimensions', () => {
      const { container } = renderWithProviders();
      const canvas = container.querySelector('canvas');
      
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute('width', mockFloorPlan.metadata.dimensions.width.toString());
      expect(canvas).toHaveAttribute('height', mockFloorPlan.metadata.dimensions.height.toString());
    });

    it('should establish WebSocket connection on mount', async () => {
      const { wsServer } = renderWithProviders();
      
      await waitFor(() => {
        expect(wsServer.connected).toBe(true);
      });
    });

    it('should render with proper ARIA attributes for accessibility', () => {
      renderWithProviders();
      const canvas = screen.getByRole('img');
      
      expect(canvas).toHaveAttribute('aria-label', `Floor plan for ${mockFloorPlan.metadata.name}`);
      expect(canvas).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('User Interactions', () => {
    it('should handle zoom controls correctly', async () => {
      renderWithProviders();
      const zoomInButton = screen.getByLabelText('Zoom in');
      const zoomOutButton = screen.getByLabelText('Zoom out');

      await userEvent.click(zoomInButton);
      await waitFor(() => {
        expect(screen.getByRole('img')).toHaveStyle('transform: scale(1.1)');
      });

      await userEvent.click(zoomOutButton);
      await waitFor(() => {
        expect(screen.getByRole('img')).toHaveStyle('transform: scale(1)');
      });
    });

    it('should handle space selection', async () => {
      renderWithProviders();
      const canvas = screen.getByRole('img');
      
      fireEvent.click(canvas, { clientX: 50, clientY: 50 });
      
      await waitFor(() => {
        expect(mockCallbacks.onSpaceSelect).toHaveBeenCalledWith('space-1');
      });
    });

    it('should handle edit mode toggle', async () => {
      renderWithProviders();
      const editButton = screen.getByLabelText('Enable edit mode');
      
      await userEvent.click(editButton);
      
      expect(editButton).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('img')).toHaveAttribute('data-mode', 'edit');
    });
  });

  describe('Real-time Updates', () => {
    it('should handle WebSocket messages correctly', async () => {
      const { wsServer } = renderWithProviders();
      
      wsServer.send(JSON.stringify({
        type: 'space_update',
        data: {
          spaceId: 'space-1',
          occupancyStatus: 'OCCUPIED'
        }
      }));

      await waitFor(() => {
        const space = screen.getByTestId('space-1');
        expect(space).toHaveAttribute('data-status', 'OCCUPIED');
      });
    });

    it('should handle connection loss and reconnection', async () => {
      const { wsServer } = renderWithProviders();
      
      wsServer.close();
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      wsServer.connect();
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should support keyboard navigation', async () => {
      renderWithProviders();
      const canvas = screen.getByRole('img');
      
      canvas.focus();
      fireEvent.keyDown(canvas, { key: 'Enter' });
      
      await waitFor(() => {
        expect(mockCallbacks.onSpaceSelect).toHaveBeenCalled();
      });
    });

    it('should announce status changes to screen readers', async () => {
      const { wsServer } = renderWithProviders();
      
      wsServer.send(JSON.stringify({
        type: 'status_update',
        message: 'Space occupancy updated'
      }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Space occupancy updated');
      });
    });
  });

  describe('Performance', () => {
    it('should render efficiently with large floor plans', async () => {
      const largeFloorPlan = {
        ...mockFloorPlan,
        spaces: Array(100).fill(mockFloorPlan.spaces[0])
      };

      const { PerformanceWrapper, measurements } = createPerformanceWrapper(
        <FloorPlanViewer
          floorPlan={largeFloorPlan}
          isEditable={true}
          {...mockCallbacks}
        />
      );

      render(<PerformanceWrapper />);

      await waitFor(() => {
        expect(measurements[0].renderTime).toBeLessThan(100); // 100ms threshold
      });
    });

    it('should handle rapid zoom interactions smoothly', async () => {
      renderWithProviders();
      const zoomInButton = screen.getByLabelText('Zoom in');
      
      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        await userEvent.click(zoomInButton);
      }
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(500); // 500ms threshold for 10 zoom operations
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid floor plan data gracefully', () => {
      const invalidFloorPlan = {
        ...mockFloorPlan,
        spaces: [{ invalid: 'data' }]
      };

      renderWithProviders({ floorPlan: invalidFloorPlan });
      
      expect(mockCallbacks.onError).toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should recover from WebSocket errors', async () => {
      const { wsServer } = renderWithProviders();
      
      wsServer.error();
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      wsServer.connect();
      await waitFor(() => {
        expect(wsServer.connected).toBe(true);
      });
    });
  });
});