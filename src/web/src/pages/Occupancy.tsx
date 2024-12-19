import React, { useCallback, useEffect, useState } from 'react';
import { Box, IconButton, Tooltip, CircularProgress, Alert } from '@mui/material';
import { RefreshIcon, DownloadIcon, ErrorIcon } from '@mui/icons-material';
import { useSearchParams, useNavigate } from 'react-router-dom';

// Internal imports
import DashboardLayout from '../layouts/DashboardLayout';
import OccupancyDashboard from '../components/occupancy/OccupancyDashboard';
import { useOccupancy } from '../hooks/useOccupancy';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Constants
const REFRESH_INTERVAL = 30000; // 30 seconds
const DEFAULT_TIME_RANGE = {
  start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  end: new Date()
};

// Interfaces
interface TimeRange {
  start: Date;
  end: Date;
  isValid: boolean;
}

interface OccupancyPageProps {
  defaultSpaceId?: string;
  refreshInterval?: number;
}

/**
 * Enhanced Occupancy page component providing real-time space utilization monitoring
 * with comprehensive error handling and accessibility features.
 */
const OccupancyPage: React.FC<OccupancyPageProps> = React.memo(({
  defaultSpaceId,
  refreshInterval = REFRESH_INTERVAL
}) => {
  // URL parameters and navigation
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Local state
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    try {
      const start = searchParams.get('start');
      const end = searchParams.get('end');
      return {
        start: start ? new Date(start) : DEFAULT_TIME_RANGE.start,
        end: end ? new Date(end) : DEFAULT_TIME_RANGE.end,
        isValid: true
      };
    } catch (error) {
      console.error('Invalid date parameters:', error);
      return { ...DEFAULT_TIME_RANGE, isValid: false };
    }
  });

  // Get spaceId from URL or use default
  const spaceId = searchParams.get('spaceId') || defaultSpaceId;

  // Initialize occupancy hook with error handling
  const {
    currentOccupancy,
    occupancyTrend,
    isLoading,
    error,
    refreshData,
    connectionStatus,
    performanceMetrics
  } = useOccupancy(spaceId!, {
    minUtilization: 0,
    maxUtilization: 100,
    timeRange
  });

  // Handle visibility change for performance optimization
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(refreshInterval);
      } else {
        refreshInterval = setInterval(refreshData, REFRESH_INTERVAL);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(refreshInterval);
    };
  }, [refreshData]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    try {
      await refreshData();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [refreshData]);

  // Handle data export
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = useCallback(async () => {
    if (!occupancyTrend?.dataPoints) return;

    try {
      setIsExporting(true);
      const csvData = occupancyTrend.dataPoints.map(point => ({
        timestamp: point.timestamp.toISOString(),
        occupantCount: point.occupantCount,
        capacity: point.capacity,
        utilizationRate: point.utilizationRate
      }));

      const csvString = [
        ['Timestamp', 'Occupant Count', 'Capacity', 'Utilization Rate'],
        ...csvData.map(row => Object.values(row))
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvString], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `occupancy-data-${new Date().toISOString()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [occupancyTrend]);

  // Action buttons for the dashboard
  const actions = (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Tooltip title="Refresh data">
        <IconButton
          onClick={handleRefresh}
          disabled={isLoading}
          aria-label="Refresh occupancy data"
        >
          <RefreshIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Export data">
        <IconButton
          onClick={handleExport}
          disabled={isLoading || isExporting || !occupancyTrend?.dataPoints.length}
          aria-label="Export occupancy data"
        >
          {isExporting ? <CircularProgress size={24} /> : <DownloadIcon />}
        </IconButton>
      </Tooltip>
    </Box>
  );

  return (
    <ErrorBoundary>
      <DashboardLayout
        title="Occupancy Monitoring"
        subtitle="Real-time space utilization tracking and analytics"
        actions={actions}
      >
        <Box
          role="main"
          aria-label="Occupancy Monitoring"
          aria-live="polite"
          aria-busy={isLoading}
          aria-atomic="true"
        >
          {error && (
            <Alert
              severity="error"
              icon={<ErrorIcon />}
              sx={{ mb: 2 }}
            >
              {error.message}
            </Alert>
          )}

          {connectionStatus !== 'CONNECTED' && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
            >
              Connection Status: {connectionStatus}
            </Alert>
          )}

          <OccupancyDashboard
            spaceId={spaceId!}
            timeRange={timeRange}
            showHeatmap
            refreshInterval={refreshInterval}
            onError={(error) => {
              console.error('Dashboard error:', error);
            }}
          />
        </Box>
      </DashboardLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
OccupancyPage.displayName = 'OccupancyPage';

export default OccupancyPage;