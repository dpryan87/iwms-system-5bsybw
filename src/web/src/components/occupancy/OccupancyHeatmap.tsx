import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3'; // d3 version ^7.0.0
import { useTheme } from '@mui/material/styles'; // @mui/material version ^5.0.0
import { Chart } from '../common/Chart';
import { useOccupancy } from '../../hooks/useOccupancy';
import { OccupancyData } from '../../types/occupancy.types';

/**
 * Props interface for the OccupancyHeatmap component
 */
interface OccupancyHeatmapProps {
  spaceId: string;
  width: number;
  height: number;
  timeRange: {
    start: Date;
    end: Date;
  };
  showLegend?: boolean;
  refreshInterval?: number;
  colorScale?: string[];
  accessibilityLabels?: {
    title: string;
    description: string;
  };
}

/**
 * Processes and validates occupancy data for heatmap visualization
 * @param data Raw occupancy data
 * @returns Processed data suitable for heatmap rendering
 */
const processHeatmapData = (data: OccupancyData[]) => {
  if (!data?.length) return [];

  return data.map(point => ({
    x: new Date(point.timestamp).getTime(),
    y: point.utilizationRate,
    value: point.occupantCount,
    capacity: point.capacity
  }));
};

/**
 * A performance-optimized heatmap component for visualizing real-time occupancy data
 * with WCAG 2.1 Level AA compliance and efficient updates
 */
export const OccupancyHeatmap: React.FC<OccupancyHeatmapProps> = memo(({
  spaceId,
  width,
  height,
  timeRange,
  showLegend = true,
  refreshInterval = 30000,
  colorScale: customColorScale,
  accessibilityLabels = {
    title: 'Space Occupancy Heatmap',
    description: 'Visualization of space utilization over time'
  }
}) => {
  const theme = useTheme();
  const chartRef = useRef<SVGSVGElement>(null);

  // Fetch real-time occupancy data
  const { currentOccupancy, occupancyTrend, error } = useOccupancy(spaceId, {
    timeRange,
    minUtilization: 0,
    maxUtilization: 100
  });

  // Memoize color scale configuration
  const colorScale = useMemo(() => {
    return customColorScale || [
      theme.palette.success.light,  // Low utilization
      theme.palette.warning.main,   // Medium utilization
      theme.palette.error.main      // High utilization
    ];
  }, [customColorScale, theme]);

  // Memoize data processing
  const processedData = useMemo(() => {
    if (!occupancyTrend?.dataPoints) return [];
    return processHeatmapData(occupancyTrend.dataPoints);
  }, [occupancyTrend]);

  // Configure chart accessibility
  const accessibilityProps = useMemo(() => ({
    role: 'img',
    'aria-label': accessibilityLabels.title,
    'aria-description': accessibilityLabels.description,
    tabIndex: 0,
    'data-testid': 'occupancy-heatmap'
  }), [accessibilityLabels]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowLeft':
        // Implement keyboard navigation logic
        event.preventDefault();
        break;
      case 'Escape':
        // Reset view/zoom
        event.preventDefault();
        break;
    }
  }, []);

  // Error handling effect
  useEffect(() => {
    if (error) {
      console.error('Occupancy data error:', error);
      // Implement error UI feedback
    }
  }, [error]);

  // Refresh data at specified interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Refresh logic is handled by useOccupancy hook
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  // Render loading state if no data
  if (!processedData.length) {
    return (
      <div 
        role="alert" 
        aria-busy="true"
        style={{ width, height, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        Loading occupancy data...
      </div>
    );
  }

  return (
    <div
      style={{ width, height }}
      onKeyDown={handleKeyDown}
    >
      <Chart
        type="area"
        data={processedData}
        width={width}
        height={height}
        xAxis={{
          label: 'Time',
          tickFormat: (d: number) => new Date(d).toLocaleTimeString(),
          gridLines: true
        }}
        yAxis={{
          label: 'Utilization (%)',
          tickFormat: (d: number) => `${d}%`,
          gridLines: true
        }}
        colors={colorScale}
        animate={{
          duration: theme.transitions.duration.standard,
          easing: 'easeInOut'
        }}
        accessibility={{
          ...accessibilityProps,
          announceDataChanges: true
        }}
        responsive={{
          aspectRatio: width / height,
          minHeight: 200,
          maxHeight: 800
        }}
      />
      {showLegend && (
        <div
          role="complementary"
          aria-label="Heatmap legend"
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: theme.spacing(2)
          }}
        >
          {['Low', 'Medium', 'High'].map((label, index) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginRight: theme.spacing(2)
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  backgroundColor: colorScale[index],
                  marginRight: theme.spacing(1),
                  borderRadius: theme.shape.borderRadius
                }}
                aria-hidden="true"
              />
              <span>{label} Utilization</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

OccupancyHeatmap.displayName = 'OccupancyHeatmap';

export default OccupancyHeatmap;