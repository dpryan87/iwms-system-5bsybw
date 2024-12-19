import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'; // react version ^18.0.0
import { useTheme } from '@mui/material/styles'; // @mui/material version ^5.0.0
import Chart from '../common/Chart';
import { useOccupancy } from '../../hooks/useOccupancy';
import { OccupancyData, OccupancyTrend, AlertSeverity } from '../../types/occupancy.types';

// Constants for chart configuration
const CHART_CONFIG = {
  ANIMATION_DURATION: 300,
  UPDATE_INTERVAL: 5000,
  MIN_HEIGHT: 300,
  ASPECT_RATIO: 16/9,
  ALERT_THRESHOLDS: {
    HIGH: 85,
    LOW: 15
  }
} as const;

interface OccupancyChartProps {
  spaceId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  chartType: 'line' | 'bar' | 'area';
  showLegend?: boolean;
  animate?: boolean;
  style?: React.CSSProperties;
  accessibility?: {
    description?: string;
    announceChanges?: boolean;
  };
  onError?: (error: Error) => void;
  performance?: {
    throttleUpdates?: boolean;
    updateInterval?: number;
  };
}

/**
 * Enhanced OccupancyChart component for visualizing real-time occupancy data
 * with comprehensive error handling and accessibility features.
 */
const OccupancyChart: React.FC<OccupancyChartProps> = memo(({
  spaceId,
  timeRange,
  chartType = 'line',
  showLegend = true,
  animate = true,
  style,
  accessibility = {
    announceChanges: true,
    description: 'Real-time space occupancy visualization'
  },
  onError,
  performance = {
    throttleUpdates: true,
    updateInterval: CHART_CONFIG.UPDATE_INTERVAL
  }
}) => {
  const theme = useTheme();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [errorState, setErrorState] = useState<Error | null>(null);

  // Initialize occupancy hook with error handling
  const {
    currentOccupancy,
    occupancyTrend,
    isLoading,
    error: occupancyError,
    connectionStatus,
    performanceMetrics
  } = useOccupancy(spaceId, {
    minUtilization: 0,
    maxUtilization: 100,
    timeRange
  });

  // Handle and propagate errors
  useEffect(() => {
    if (occupancyError) {
      const error = new Error(`Occupancy data error: ${occupancyError.message}`);
      setErrorState(error);
      onError?.(error);
    }
  }, [occupancyError, onError]);

  // Format chart data with validation
  const formatChartData = useCallback((data: OccupancyData[]): any[] => {
    if (!Array.isArray(data) || data.length === 0) return [];

    return data.map(point => ({
      x: new Date(point.timestamp).getTime(),
      y: point.utilizationRate,
      occupantCount: point.occupantCount,
      capacity: point.capacity
    }));
  }, []);

  // Memoize chart configuration
  const chartConfig = useMemo(() => ({
    type: chartType,
    xAxis: {
      label: 'Time',
      tickFormat: (value: number) => new Date(value).toLocaleTimeString(),
      gridLines: true
    },
    yAxis: {
      label: 'Utilization (%)',
      tickFormat: (value: number) => `${value}%`,
      gridLines: true
    },
    animate: animate ? {
      duration: CHART_CONFIG.ANIMATION_DURATION,
      easing: 'easeInOut'
    } : undefined,
    accessibility: {
      role: 'img',
      ariaLabel: 'Occupancy chart',
      description: accessibility.description,
      announceDataChanges: accessibility.announceChanges
    },
    responsive: {
      aspectRatio: CHART_CONFIG.ASPECT_RATIO,
      minHeight: CHART_CONFIG.MIN_HEIGHT
    }
  }), [chartType, animate, accessibility]);

  // Generate alert message based on occupancy
  const generateAlertMessage = useCallback((data: OccupancyData): string | null => {
    if (data.utilizationRate >= CHART_CONFIG.ALERT_THRESHOLDS.HIGH) {
      return `High utilization alert: Space is at ${data.utilizationRate}% capacity`;
    }
    if (data.utilizationRate <= CHART_CONFIG.ALERT_THRESHOLDS.LOW) {
      return `Low utilization alert: Space is at ${data.utilizationRate}% capacity`;
    }
    return null;
  }, []);

  // Update chart data with throttling if enabled
  useEffect(() => {
    if (!currentOccupancy || !performance.throttleUpdates) return;

    const timeSinceLastUpdate = Date.now() - lastUpdate.getTime();
    if (timeSinceLastUpdate < (performance.updateInterval ?? CHART_CONFIG.UPDATE_INTERVAL)) {
      return;
    }

    setLastUpdate(new Date());
    const alertMessage = generateAlertMessage(currentOccupancy);
    if (alertMessage && accessibility.announceChanges) {
      const announcement = new CustomEvent('announce', { detail: alertMessage });
      document.dispatchEvent(announcement);
    }
  }, [currentOccupancy, performance, lastUpdate, generateAlertMessage, accessibility]);

  // Render loading state
  if (isLoading) {
    return (
      <div 
        role="alert" 
        aria-busy="true"
        style={{ ...style, minHeight: CHART_CONFIG.MIN_HEIGHT }}
      >
        Loading occupancy data...
      </div>
    );
  }

  // Render error state
  if (errorState) {
    return (
      <div 
        role="alert" 
        aria-live="assertive"
        style={{ ...style, color: theme.palette.error.main }}
      >
        Error loading occupancy data: {errorState.message}
      </div>
    );
  }

  // Render chart
  return (
    <div style={style}>
      <Chart
        {...chartConfig}
        data={formatChartData(occupancyTrend?.dataPoints ?? [])}
        colors={[theme.palette.primary.main]}
      />
      {showLegend && (
        <div role="complementary" aria-label="Chart legend">
          <div>Current Occupancy: {currentOccupancy?.occupantCount ?? 0}</div>
          <div>Capacity: {currentOccupancy?.capacity ?? 0}</div>
          <div>Utilization: {currentOccupancy?.utilizationRate.toFixed(1)}%</div>
        </div>
      )}
      {connectionStatus !== 'CONNECTED' && (
        <div 
          role="alert" 
          aria-live="polite"
          style={{ color: theme.palette.warning.main }}
        >
          Connection Status: {connectionStatus}
        </div>
      )}
    </div>
  );
});

OccupancyChart.displayName = 'OccupancyChart';

export default OccupancyChart;