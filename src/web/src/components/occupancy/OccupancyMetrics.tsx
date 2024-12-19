import React, { memo, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  LinearProgress,
  Tooltip,
  Alert
} from '@mui/material'; // @version ^5.0.0
import { debounce } from 'lodash'; // @version ^4.17.21

// Internal imports
import Card from '../common/Card';
import { useOccupancy } from '../../hooks/useOccupancy';
import type { OccupancyData } from '../../types/occupancy.types';

// Utilization configuration with thresholds
const UTILIZATION_CONFIG = {
  warningThreshold: 0.75, // 75%
  criticalThreshold: 0.90, // 90%
  colorMapping: {
    low: 'success.main',
    warning: 'warning.main',
    critical: 'error.main'
  }
} as const;

// Props interface
interface OccupancyMetricsProps {
  spaceId: string;
  showTrends?: boolean;
  className?: string;
  onUtilizationChange?: (utilization: number) => void;
  errorBoundaryFallback?: React.ReactNode;
}

/**
 * Formats utilization rate as a percentage string
 * @param rate - Utilization rate between 0 and 1
 * @param locale - Optional locale for number formatting
 */
const formatUtilization = (rate: number, locale: string = 'en-US'): string => {
  if (rate < 0 || rate > 1) return '0%';
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1
  }).format(rate);
};

/**
 * Returns appropriate color based on utilization rate
 * @param rate - Utilization rate between 0 and 1
 */
const getUtilizationColor = (rate: number): string => {
  if (rate >= UTILIZATION_CONFIG.criticalThreshold) {
    return UTILIZATION_CONFIG.colorMapping.critical;
  }
  if (rate >= UTILIZATION_CONFIG.warningThreshold) {
    return UTILIZATION_CONFIG.colorMapping.warning;
  }
  return UTILIZATION_CONFIG.colorMapping.low;
};

/**
 * Component for displaying real-time occupancy metrics with enhanced accessibility
 */
const OccupancyMetrics: React.FC<OccupancyMetricsProps> = memo(({
  spaceId,
  showTrends = false,
  className,
  onUtilizationChange,
  errorBoundaryFallback
}) => {
  const {
    currentOccupancy,
    occupancyTrend,
    isLoading,
    error,
    retry
  } = useOccupancy(spaceId);

  // Debounced callback for utilization changes
  const handleUtilizationChange = useCallback(
    debounce((data: OccupancyData) => {
      onUtilizationChange?.(data.utilizationRate);
    }, 250),
    [onUtilizationChange]
  );

  // Effect to handle utilization changes
  useEffect(() => {
    if (currentOccupancy && onUtilizationChange) {
      handleUtilizationChange(currentOccupancy);
    }
  }, [currentOccupancy, handleUtilizationChange]);

  // Error state
  if (error) {
    return errorBoundaryFallback || (
      <Alert 
        severity="error"
        action={
          <Typography
            component="button"
            onClick={retry}
            sx={{ cursor: 'pointer', textDecoration: 'underline' }}
          >
            Retry
          </Typography>
        }
      >
        Failed to load occupancy data: {error.message}
      </Alert>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress aria-label="Loading occupancy data" />
      </Box>
    );
  }

  // No data state
  if (!currentOccupancy) {
    return (
      <Alert severity="info">
        No occupancy data available for this space
      </Alert>
    );
  }

  const utilizationRate = currentOccupancy.utilizationRate / 100;
  const utilizationColor = getUtilizationColor(utilizationRate);

  return (
    <Card 
      className={className}
      role="region"
      aria-label="Occupancy metrics"
    >
      <Box sx={{ p: 2 }}>
        {/* Current Occupancy */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            Current Occupancy
          </Typography>
          <Box display="flex" alignItems="center" mb={1}>
            <Typography variant="h4" component="span">
              {currentOccupancy.occupantCount}
            </Typography>
            <Typography variant="body2" color="text.secondary" ml={1}>
              / {currentOccupancy.capacity} people
            </Typography>
          </Box>
          <Tooltip 
            title={`${formatUtilization(utilizationRate)} utilized`}
            arrow
          >
            <Box sx={{ width: '100%', mt: 1 }}>
              <LinearProgress
                variant="determinate"
                value={utilizationRate * 100}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: utilizationColor
                  }
                }}
                aria-label="Space utilization"
              />
            </Box>
          </Tooltip>
        </Box>

        {/* Trend Information */}
        {showTrends && occupancyTrend && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Utilization Trends
            </Typography>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Peak Today:
                <Typography component="span" ml={1} fontWeight="medium">
                  {occupancyTrend.peakOccupancy} people
                </Typography>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average:
                <Typography component="span" ml={1} fontWeight="medium">
                  {formatUtilization(occupancyTrend.averageUtilization / 100)}
                </Typography>
              </Typography>
            </Box>
          </Box>
        )}

        {/* Last Updated Timestamp */}
        <Typography 
          variant="caption" 
          color="text.secondary"
          sx={{ display: 'block', mt: 2 }}
        >
          Last updated: {new Date(currentOccupancy.timestamp).toLocaleTimeString()}
        </Typography>
      </Box>
    </Card>
  );
});

OccupancyMetrics.displayName = 'OccupancyMetrics';

export default OccupancyMetrics;