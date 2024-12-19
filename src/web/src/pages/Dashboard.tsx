import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Grid,
  Box,
  Typography,
  Card,
  CardContent,
  Skeleton,
  useTheme
} from '@mui/material'; // @version ^5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // @version ^3.1.4

// Internal imports
import Layout from '../components/common/Layout';
import OccupancyDashboard from '../components/occupancy/OccupancyDashboard';
import { useAuth } from '../hooks/useAuth';
import { ERROR_MESSAGES } from '../constants/error.constants';

// Interfaces
interface DashboardMetrics {
  totalSpaces: number;
  occupiedSpaces: number;
  utilizationRate: number;
  activeLeases: number;
  upcomingRenewals: number;
  lastUpdated: Date;
}

interface DashboardProps {
  userId: string;
  userRole: string;
  refreshInterval?: number;
}

/**
 * Main dashboard page component that provides an overview of key workplace management metrics
 * including occupancy data, lease information, and resource utilization.
 */
const Dashboard: React.FC<DashboardProps> = ({
  userId,
  userRole,
  refreshInterval = 30000 // 30 seconds default refresh
}) => {
  const theme = useTheme();
  const { state: authState } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Time range for occupancy data
  const timeRange = useMemo(() => ({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date()
  }), []);

  /**
   * Fetches dashboard metrics with error handling
   */
  const fetchDashboardMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      // API call would go here
      const mockMetrics: DashboardMetrics = {
        totalSpaces: 100,
        occupiedSpaces: 75,
        utilizationRate: 75,
        activeLeases: 12,
        upcomingRenewals: 3,
        lastUpdated: new Date()
      };
      setMetrics(mockMetrics);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize dashboard data
  useEffect(() => {
    fetchDashboardMetrics();
  }, [fetchDashboardMetrics]);

  // Set up refresh interval
  useEffect(() => {
    const intervalId = setInterval(fetchDashboardMetrics, refreshInterval);
    return () => clearInterval(intervalId);
  }, [fetchDashboardMetrics, refreshInterval]);

  /**
   * Handles errors from child components
   */
  const handleError = useCallback((error: Error) => {
    console.error('Dashboard Error:', error);
    setError(error);
  }, []);

  // Loading state
  if (isLoading && !metrics) {
    return (
      <Layout title="Dashboard" isLoading>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={12} md={6} lg={3} key={item}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="rectangular" height={118} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Layout>
    );
  }

  return (
    <Layout
      title="Workplace Management Dashboard"
      subtitle="Real-time overview of space utilization and occupancy"
      showBreadcrumbs
    >
      <Box sx={{ flexGrow: 1 }}>
        <Grid container spacing={3}>
          {/* Summary Cards */}
          <Grid item xs={12} md={6} lg={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Space Utilization
                </Typography>
                <Typography variant="h3">
                  {metrics?.utilizationRate ?? 0}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {metrics?.occupiedSpaces ?? 0} of {metrics?.totalSpaces ?? 0} spaces occupied
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Active Leases
                </Typography>
                <Typography variant="h3">
                  {metrics?.activeLeases ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {metrics?.upcomingRenewals ?? 0} upcoming renewals
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Occupancy Dashboard */}
          <Grid item xs={12}>
            <ErrorBoundary
              fallback={
                <Card>
                  <CardContent>
                    <Typography color="error">
                      {ERROR_MESSAGES.OCCUPANCY_DATA_ERROR}
                    </Typography>
                  </CardContent>
                </Card>
              }
              onError={handleError}
            >
              <OccupancyDashboard
                spaceId="all"
                timeRange={timeRange}
                showHeatmap
                refreshInterval={refreshInterval}
                onError={handleError}
              />
            </ErrorBoundary>
          </Grid>
        </Grid>

        {/* Error Display */}
        {error && (
          <Box sx={{ mt: 2 }}>
            <Typography color="error" variant="body2">
              {error.message}
            </Typography>
          </Box>
        )}

        {/* Last Updated Timestamp */}
        <Box sx={{ mt: 2, textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary">
            Last updated: {metrics?.lastUpdated.toLocaleTimeString()}
          </Typography>
        </Box>
      </Box>
    </Layout>
  );
};

export default Dashboard;