import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import OccupancyDashboard from '../../../src/components/occupancy/OccupancyDashboard';
import { useOccupancy } from '../../../src/hooks/useOccupancy';
import ErrorBoundary from '../../../src/components/common/ErrorBoundary';
import { createAppTheme } from '../../../src/styles/theme';
import { ERROR_MESSAGES } from '../../../src/constants/error.constants';

// Mock the useOccupancy hook
vi.mock('../../../src/hooks/useOccupancy');

// Mock data for testing
const mockOccupancyData = {
  spaceId: 'test-space-1',
  occupantCount: 75,
  capacity: 100,
  utilizationRate: 75,
  timestamp: new Date('2023-01-01T12:00:00Z')
};

const mockOccupancyTrend = {
  spaceId: 'test-space-1',
  dataPoints: [
    { ...mockOccupancyData, timestamp: new Date('2023-01-01T11:00:00Z'), utilizationRate: 70 },
    { ...mockOccupancyData, timestamp: new Date('2023-01-01T12:00:00Z'), utilizationRate: 75 }
  ],
  averageUtilization: 72.5,
  peakOccupancy: 75,
  timeRange: {
    start: new Date('2023-01-01T11:00:00Z'),
    end: new Date('2023-01-01T12:00:00Z')
  }
};

// Helper function to render component with providers
const renderWithProviders = (
  ui: React.ReactElement,
  { withError = false } = {}
) => {
  const theme = createAppTheme('light');
  
  return render(
    <ThemeProvider theme={theme}>
      <ErrorBoundary fallback={<div>Error Boundary Fallback</div>}>
        {ui}
      </ErrorBoundary>
    </ThemeProvider>
  );
};

describe('OccupancyDashboard Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial Rendering and Loading States', () => {
    it('should show loading indicator when data is being fetched', () => {
      // Mock loading state
      (useOccupancy as jest.Mock).mockReturnValue({
        isLoading: true,
        error: null,
        currentOccupancy: null,
        occupancyTrend: null
      });

      renderWithProviders(
        <OccupancyDashboard 
          spaceId="test-space-1"
          timeRange={{ start: new Date(), end: new Date() }}
        />
      );

      // Verify loading state
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading occupancy data')).toBeInTheDocument();
    });

    it('should render dashboard with data when loading completes', async () => {
      // Mock successful data load
      (useOccupancy as jest.Mock).mockReturnValue({
        isLoading: false,
        error: null,
        currentOccupancy: mockOccupancyData,
        occupancyTrend: mockOccupancyTrend,
        connectionStatus: 'CONNECTED'
      });

      renderWithProviders(
        <OccupancyDashboard 
          spaceId="test-space-1"
          timeRange={{ start: new Date(), end: new Date() }}
        />
      );

      // Verify dashboard content
      await waitFor(() => {
        expect(screen.getByText('Current Occupancy')).toBeInTheDocument();
        expect(screen.getByText('75/100')).toBeInTheDocument();
        expect(screen.getByText('75.0% Utilized')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Data Display and Updates', () => {
    it('should update occupancy data in real-time', async () => {
      const mockUpdatedData = {
        ...mockOccupancyData,
        occupantCount: 80,
        utilizationRate: 80
      };

      // Mock initial data
      (useOccupancy as jest.Mock).mockReturnValue({
        isLoading: false,
        error: null,
        currentOccupancy: mockOccupancyData,
        occupancyTrend: mockOccupancyTrend,
        connectionStatus: 'CONNECTED'
      });

      renderWithProviders(
        <OccupancyDashboard 
          spaceId="test-space-1"
          timeRange={{ start: new Date(), end: new Date() }}
        />
      );

      // Verify initial data
      expect(screen.getByText('75/100')).toBeInTheDocument();

      // Mock data update
      (useOccupancy as jest.Mock).mockReturnValue({
        isLoading: false,
        error: null,
        currentOccupancy: mockUpdatedData,
        occupancyTrend: mockOccupancyTrend,
        connectionStatus: 'CONNECTED'
      });

      // Verify updated data
      await waitFor(() => {
        expect(screen.getByText('80/100')).toBeInTheDocument();
        expect(screen.getByText('80.0% Utilized')).toBeInTheDocument();
      });
    });

    it('should display high utilization alert when threshold is exceeded', async () => {
      const highUtilizationData = {
        ...mockOccupancyData,
        occupantCount: 90,
        utilizationRate: 90
      };

      (useOccupancy as jest.Mock).mockReturnValue({
        isLoading: false,
        error: null,
        currentOccupancy: highUtilizationData,
        occupancyTrend: mockOccupancyTrend,
        connectionStatus: 'CONNECTED'
      });

      renderWithProviders(
        <OccupancyDashboard 
          spaceId="test-space-1"
          timeRange={{ start: new Date(), end: new Date() }}
        />
      );

      // Verify alert presence
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(/High utilization alert/i);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should display error message when data fetch fails', async () => {
      const mockError = new Error('Failed to fetch occupancy data');

      (useOccupancy as jest.Mock).mockReturnValue({
        isLoading: false,
        error: mockError,
        currentOccupancy: null,
        occupancyTrend: null,
        connectionStatus: 'ERROR'
      });

      renderWithProviders(
        <OccupancyDashboard 
          spaceId="test-space-1"
          timeRange={{ start: new Date(), end: new Date() }}
        />
      );

      // Verify error message
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.OCCUPANCY_DATA_ERROR);
      });
    });

    it('should handle connection status changes', async () => {
      (useOccupancy as jest.Mock).mockReturnValue({
        isLoading: false,
        error: null,
        currentOccupancy: mockOccupancyData,
        occupancyTrend: mockOccupancyTrend,
        connectionStatus: 'DISCONNECTED'
      });

      renderWithProviders(
        <OccupancyDashboard 
          spaceId="test-space-1"
          timeRange={{ start: new Date(), end: new Date() }}
        />
      );

      // Verify connection status warning
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(/Connection Status: DISCONNECTED/i);
      });
    });
  });

  describe('Accessibility Compliance', () => {
    it('should meet WCAG accessibility requirements', async () => {
      (useOccupancy as jest.Mock).mockReturnValue({
        isLoading: false,
        error: null,
        currentOccupancy: mockOccupancyData,
        occupancyTrend: mockOccupancyTrend,
        connectionStatus: 'CONNECTED'
      });

      renderWithProviders(
        <OccupancyDashboard 
          spaceId="test-space-1"
          timeRange={{ start: new Date(), end: new Date() }}
        />
      );

      // Verify ARIA attributes
      expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Occupancy Dashboard');
      
      // Verify alerts are properly announced
      const alerts = screen.getAllByRole('alert');
      alerts.forEach(alert => {
        expect(alert).toHaveAttribute('aria-live');
      });
    });

    it('should support keyboard navigation', async () => {
      (useOccupancy as jest.Mock).mockReturnValue({
        isLoading: false,
        error: null,
        currentOccupancy: mockOccupancyData,
        occupancyTrend: mockOccupancyTrend,
        connectionStatus: 'CONNECTED'
      });

      renderWithProviders(
        <OccupancyDashboard 
          spaceId="test-space-1"
          timeRange={{ start: new Date(), end: new Date() }}
        />
      );

      // Verify all interactive elements are focusable
      const focusableElements = screen.getAllByRole('button');
      focusableElements.forEach(element => {
        element.focus();
        expect(element).toHaveFocus();
      });
    });
  });
});