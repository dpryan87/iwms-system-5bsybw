import React, { memo, useCallback, useEffect, useState } from 'react'; // react version ^18.0.0
import { 
  Grid, 
  Box, 
  Typography, 
  CircularProgress, 
  Card, 
  Alert 
} from '@mui/material'; // @mui/material version ^5.0.0
import { debounce } from 'lodash'; // lodash version ^4.17.21
import OccupancyChart from './OccupancyChart';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useOccupancy } from '../../hooks/useOccupancy';
import { OccupancyData, AlertSeverity } from '../../types/occupancy.types';
import { ERROR_MESSAGES } from '../../constants/error.constants';

// Constants for dashboard configuration
const DASHBOARD_CONFIG = {
  REFRESH_INTERVAL: 30000, // 30 seconds
  DEBOUNCE_DELAY: 500,    // 500ms
  ALERT_THRESHOLDS: {
    HIGH: 85,
    LOW: 15
  }
} as const;

interface OccupancyDashboardProps {
  spaceId: string;
  timeRange: { start: Date; end: Date };
  showHeatmap?: boolean;
  className?: string;
  refreshInterval?: number;
  errorFallback?: React.ReactNode;
  onError?: (error: Error) => void;
}

/**
 * Enhanced OccupancyDashboard component providing real-time occupancy monitoring
 * with comprehensive error handling and accessibility features.
 */
const OccupancyDashboard: React.FC<OccupancyDashboardProps> = memo(({
  spaceId,
  timeRange,
  showHeatmap = false,
  className,
  refreshInterval = DASHBOARD_CONFIG.REFRESH_INTERVAL,
  errorFallback,
  onError
}) => {
  // State for performance metrics
  const [metrics, setMetrics] = useState({
    lastUpdate: new Date(),
    updateCount: 0,
    errorCount: 0
  });

  // Initialize occupancy hook with error handling
  const {
    currentOccupancy,
    occupancyTrend,
    isLoading,
    error: occupancyError,
    refreshData,
    connectionStatus,
    performanceMetrics
  } = useOccupancy(spaceId, {
    minUtilization: 0,
    maxUtilization: 100,
    timeRange
  });

  // Handle occupancy alerts
  const handleOccupancyAlert = useCallback((data: OccupancyData) => {
    if (data.utilizationRate >= DASHBOARD_CONFIG.ALERT_THRESHOLDS.HIGH) {
      return {
        severity: AlertSeverity.WARNING,
        message: `High utilization alert: Space is at ${data.utilizationRate}% capacity`
      };
    }
    if (data.utilizationRate <= DASHBOARD_CONFIG.ALERT_THRESHOLDS.LOW) {
      return {
        severity: AlertSeverity.INFO,
        message: `Low utilization alert: Space is at ${data.utilizationRate}% capacity`
      };
    }
    return null;
  }, []);

  // Debounced refresh function
  const debouncedRefresh = useCallback(
    debounce(() => {
      refreshData();
      setMetrics(prev => ({
        ...prev,
        lastUpdate: new Date(),
        updateCount: prev.updateCount + 1
      }));
    }, DASHBOARD_CONFIG.DEBOUNCE_DELAY),
    [refreshData]
  );

  // Set up automatic refresh interval
  useEffect(() => {
    const intervalId = setInterval(debouncedRefresh, refreshInterval);
    return () => {
      clearInterval(intervalId);
      debouncedRefresh.cancel();
    };
  }, [debouncedRefresh, refreshInterval]);

  // Handle and propagate errors
  useEffect(() => {
    if (occupancyError) {
      setMetrics(prev => ({
        ...prev,
        errorCount: prev.errorCount + 1
      }));
      onError?.(occupancyError);
    }
  }, [occupancyError, onError]);

  // Render loading state
  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={400}
        role="status"
        aria-label="Loading occupancy data"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Render error state
  if (occupancyError) {
    return (
      <Alert 
        severity="error"
        role="alert"
        aria-live="assertive"
      >
        {ERROR_MESSAGES.OCCUPANCY_DATA_ERROR}
      </Alert>
    );
  }

  // Calculate current alert if any
  const currentAlert = currentOccupancy ? handleOccupancyAlert(currentOccupancy) : null;

  return (
    <Box className={className} role="region" aria-label="Occupancy Dashboard">
      <Grid container spacing={3}>
        {/* Current Occupancy Overview */}
        <Grid item xs={12} md={4}>
          <ErrorBoundary fallback={errorFallback}>
            <Card>
              <Box p={2}>
                <Typography variant="h6" gutterBottom>
                  Current Occupancy
                </Typography>
                {currentOccupancy && (
                  <>
                    <Typography variant="h3">
                      {currentOccupancy.occupantCount}/{currentOccupancy.capacity}
                    </Typography>
                    <Typography variant="subtitle1" color="textSecondary">
                      {currentOccupancy.utilizationRate.toFixed(1)}% Utilized
                    </Typography>
                  </>
                )}
              </Box>
            </Card>
          </ErrorBoundary>
        </Grid>

        {/* Occupancy Trend Chart */}
        <Grid item xs={12} md={8}>
          <ErrorBoundary fallback={errorFallback}>
            <Card>
              <Box p={2}>
                <Typography variant="h6" gutterBottom>
                  Occupancy Trend
                </Typography>
                <OccupancyChart
                  spaceId={spaceId}
                  timeRange={timeRange}
                  chartType="line"
                  showLegend
                  accessibility={{
                    description: "Real-time occupancy trend visualization",
                    announceChanges: true
                  }}
                />
              </Box>
            </Card>
          </ErrorBoundary>
        </Grid>

        {/* Alerts and Status */}
        <Grid item xs={12}>
          <ErrorBoundary fallback={errorFallback}>
            {currentAlert && (
              <Alert 
                severity={currentAlert.severity.toLowerCase() as 'warning' | 'info'}
                role="alert"
                aria-live="polite"
              >
                {currentAlert.message}
              </Alert>
            )}
            {connectionStatus !== 'CONNECTED' && (
              <Alert 
                severity="warning"
                role="alert"
                aria-live="polite"
              >
                Connection Status: {connectionStatus}
              </Alert>
            )}
          </ErrorBoundary>
        </Grid>

        {/* Performance Metrics */}
        {process.env.NODE_ENV === 'development' && (
          <Grid item xs={12}>
            <Card>
              <Box p={2}>
                <Typography variant="h6" gutterBottom>
                  Performance Metrics
                </Typography>
                <Typography variant="body2">
                  Last Update: {metrics.lastUpdate.toLocaleTimeString()}
                </Typography>
                <Typography variant="body2">
                  Updates: {metrics.updateCount}
                </Typography>
                <Typography variant="body2">
                  Errors: {metrics.errorCount}
                </Typography>
              </Box>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
});

OccupancyDashboard.displayName = 'OccupancyDashboard';

export default OccupancyDashboard;