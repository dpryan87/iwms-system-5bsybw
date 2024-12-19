import React, { useEffect, useMemo, useRef, memo } from 'react';
import { useTheme } from '@mui/material/styles'; // @mui/material version ^5.0.0
import useResizeObserver from '@react-hook/resize-observer'; // @react-hook/resize-observer version ^1.2.0
import { useOccupancy } from '../../hooks/useOccupancy';
import { Chart } from '../common/Chart';
import ErrorBoundary from '../common/ErrorBoundary';
import { OccupancyTrend } from '../../types/occupancy.types';

interface OccupancyTrendsProps {
  /** Unique identifier for the space being monitored */
  spaceId: string;
  /** Filter configuration for occupancy data */
  filter?: {
    timeRange: {
      start: Date;
      end: Date;
    };
    minUtilization?: number;
    maxUtilization?: number;
  };
  /** Optional CSS class name for styling */
  className?: string;
  /** Flag to show/hide trendline */
  showTrendline?: boolean;
  /** Accessibility configuration options */
  accessibilityOptions?: {
    ariaLabel?: string;
    description?: string;
    announceChanges?: boolean;
  };
}

/**
 * Component that visualizes occupancy trends over time with enhanced accessibility
 * and real-time updates.
 * 
 * @param props - Component properties
 * @returns React component
 */
const OccupancyTrends: React.FC<OccupancyTrendsProps> = memo(({
  spaceId,
  filter,
  className,
  showTrendline = true,
  accessibilityOptions = {
    ariaLabel: 'Occupancy trends visualization',
    description: 'Interactive chart showing space utilization patterns over time',
    announceChanges: true
  }
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const { occupancyTrend, isLoading, error } = useOccupancy(spaceId, filter);

  // Monitor container size for responsive chart
  const dimensions = useResizeObserver(containerRef);

  /**
   * Transforms occupancy trend data for chart visualization
   * @param trend - Raw occupancy trend data
   * @returns Formatted chart data
   */
  const formatChartData = (trend: OccupancyTrend | null) => {
    if (!trend) return [];

    return trend.dataPoints.map(point => ({
      x: point.timestamp,
      y: point.utilizationRate,
      occupantCount: point.occupantCount,
      capacity: point.capacity
    }));
  };

  /**
   * Calculate moving average for trendline
   * @param data - Chart data points
   * @param period - Moving average period
   * @returns Trendline data points
   */
  const calculateTrendline = useMemo(() => {
    if (!occupancyTrend || !showTrendline) return [];

    const period = 5; // 5-point moving average
    const data = formatChartData(occupancyTrend);
    
    return data.map((point, index) => {
      const start = Math.max(0, index - period + 1);
      const values = data.slice(start, index + 1).map(p => p.y);
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      
      return {
        x: point.x,
        y: average
      };
    });
  }, [occupancyTrend, showTrendline]);

  // Chart configuration with accessibility support
  const chartConfig = useMemo(() => ({
    type: 'line' as const,
    data: formatChartData(occupancyTrend),
    xAxis: {
      label: 'Time',
      tickFormat: (value: Date) => value.toLocaleTimeString(),
      gridLines: true
    },
    yAxis: {
      label: 'Utilization (%)',
      tickFormat: (value: number) => `${value}%`,
      gridLines: true
    },
    colors: [theme.palette.primary.main],
    animate: {
      duration: theme.transitions.duration.standard,
      easing: 'easeInOut'
    },
    accessibility: {
      role: 'img',
      ariaLabel: accessibilityOptions.ariaLabel,
      description: accessibilityOptions.description,
      announceDataChanges: accessibilityOptions.announceChanges
    },
    responsive: {
      aspectRatio: 16/9,
      minHeight: 300,
      maxHeight: 600
    }
  }), [occupancyTrend, theme, accessibilityOptions]);

  // Additional trendline configuration if enabled
  const trendlineConfig = useMemo(() => ({
    ...chartConfig,
    data: calculateTrendline,
    colors: [theme.palette.secondary.main],
    animate: {
      duration: theme.transitions.duration.standard * 1.5,
      easing: 'easeInOut'
    }
  }), [calculateTrendline, theme]);

  return (
    <ErrorBoundary>
      <div 
        ref={containerRef}
        className={className}
        role="region"
        aria-label={accessibilityOptions.ariaLabel}
        aria-busy={isLoading}
      >
        {error ? (
          <div role="alert" aria-live="assertive">
            Error loading occupancy data: {error.message}
          </div>
        ) : (
          <>
            <Chart {...chartConfig} />
            {showTrendline && calculateTrendline.length > 0 && (
              <Chart {...trendlineConfig} />
            )}
          </>
        )}
      </div>
    </ErrorBoundary>
  );
});

OccupancyTrends.displayName = 'OccupancyTrends';

export default OccupancyTrends;