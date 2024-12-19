/**
 * @fileoverview Utility functions for processing and analyzing occupancy data
 * @version 1.0.0
 * @package lodash@4.17.21
 */

import { memoize, mean, max, min } from 'lodash';
import {
  OccupancyData,
  OccupancyTrend,
  OccupancyFilter,
  OccupancyAlert,
  OccupancyAlertType,
  AlertSeverity,
  isOccupancyData
} from '../types/occupancy.types';
import { DATE_TIME_FORMATS } from '../constants/app.constants';

// Occupancy thresholds for alerts and analysis
const OCCUPANCY_THRESHOLDS = {
  HIGH_UTILIZATION: 85, // 85% threshold for high utilization
  LOW_UTILIZATION: 15,  // 15% threshold for low utilization
  CRITICAL_UTILIZATION: 95, // 95% threshold for critical alerts
  MIN_DATA_POINTS: 3,   // Minimum data points for trend analysis
  TREND_CACHE_TTL: 300000 // 5 minutes cache TTL
};

/**
 * Validates occupancy input parameters
 * @param value - Value to validate
 * @param paramName - Parameter name for error messages
 * @throws {Error} If validation fails
 */
const validateOccupancyInput = (value: number, paramName: string): void => {
  if (typeof value !== 'number' || isNaN(value) || value < 0) {
    throw new Error(`Invalid ${paramName}: must be a non-negative number`);
  }
};

/**
 * Calculates space utilization rate with validation and memoization
 * @param occupantCount - Current number of occupants
 * @param capacity - Maximum space capacity
 * @returns Utilization rate as a percentage (0-100)
 * @throws {Error} If input parameters are invalid
 */
export const calculateUtilizationRate = memoize((occupantCount: number, capacity: number): number => {
  try {
    // Validate input parameters
    validateOccupancyInput(occupantCount, 'occupantCount');
    validateOccupancyInput(capacity, 'capacity');

    if (capacity === 0) {
      throw new Error('Capacity cannot be zero');
    }

    // Calculate utilization rate with bounds checking
    const utilizationRate = (occupantCount / capacity) * 100;
    return Math.min(Math.max(utilizationRate, 0), 100);
  } catch (error) {
    console.error('Error calculating utilization rate:', error);
    throw error;
  }
});

/**
 * Analyzes occupancy trends with performance optimization and caching
 * @param dataPoints - Array of occupancy data points
 * @param filter - Filter criteria for analysis
 * @returns Analyzed occupancy trend data
 * @throws {Error} If input data is invalid or insufficient
 */
export const calculateOccupancyTrend = memoize((
  dataPoints: OccupancyData[],
  filter: OccupancyFilter
): OccupancyTrend => {
  try {
    // Validate input data
    if (!Array.isArray(dataPoints) || dataPoints.length < OCCUPANCY_THRESHOLDS.MIN_DATA_POINTS) {
      throw new Error(`Insufficient data points: minimum ${OCCUPANCY_THRESHOLDS.MIN_DATA_POINTS} required`);
    }

    // Validate each data point
    if (!dataPoints.every(isOccupancyData)) {
      throw new Error('Invalid occupancy data format');
    }

    // Apply filters
    const filteredData = dataPoints.filter(point => {
      const timestamp = point.timestamp.getTime();
      return (
        point.spaceId === filter.spaceId &&
        timestamp >= filter.timeRange.start.getTime() &&
        timestamp <= filter.timeRange.end.getTime() &&
        point.utilizationRate >= filter.minUtilization &&
        point.utilizationRate <= filter.maxUtilization
      );
    });

    if (filteredData.length === 0) {
      throw new Error('No data points match the filter criteria');
    }

    // Calculate trend metrics
    const utilizationRates = filteredData.map(point => point.utilizationRate);
    const occupancyCounts = filteredData.map(point => point.occupantCount);

    const trend: OccupancyTrend = {
      spaceId: filter.spaceId,
      timeRange: {
        start: filter.timeRange.start,
        end: filter.timeRange.end
      },
      averageUtilization: Number(mean(utilizationRates).toFixed(2)),
      peakOccupancy: max(occupancyCounts) || 0,
      dataPoints: Object.freeze([...filteredData]) // Immutable data points
    };

    return trend;
  } catch (error) {
    console.error('Error calculating occupancy trend:', error);
    throw error;
  }
}, (dataPoints, filter) => {
  // Custom cache key generation
  const cacheKey = `${filter.spaceId}-${filter.timeRange.start.getTime()}-${filter.timeRange.end.getTime()}`;
  return cacheKey;
});

/**
 * Generates occupancy alerts based on thresholds
 * @param trend - Analyzed occupancy trend
 * @returns Array of occupancy alerts
 */
export const generateOccupancyAlerts = (trend: OccupancyTrend): OccupancyAlert[] => {
  const alerts: OccupancyAlert[] = [];

  if (trend.averageUtilization >= OCCUPANCY_THRESHOLDS.CRITICAL_UTILIZATION) {
    alerts.push({
      spaceId: trend.spaceId,
      timestamp: new Date(),
      alertType: OccupancyAlertType.CAPACITY_EXCEEDED,
      message: `Critical: Space utilization at ${trend.averageUtilization}%`,
      threshold: OCCUPANCY_THRESHOLDS.CRITICAL_UTILIZATION,
      severity: AlertSeverity.CRITICAL
    });
  } else if (trend.averageUtilization >= OCCUPANCY_THRESHOLDS.HIGH_UTILIZATION) {
    alerts.push({
      spaceId: trend.spaceId,
      timestamp: new Date(),
      alertType: OccupancyAlertType.HIGH_UTILIZATION,
      message: `High utilization detected: ${trend.averageUtilization}%`,
      threshold: OCCUPANCY_THRESHOLDS.HIGH_UTILIZATION,
      severity: AlertSeverity.WARNING
    });
  } else if (trend.averageUtilization <= OCCUPANCY_THRESHOLDS.LOW_UTILIZATION) {
    alerts.push({
      spaceId: trend.spaceId,
      timestamp: new Date(),
      alertType: OccupancyAlertType.LOW_UTILIZATION,
      message: `Low utilization detected: ${trend.averageUtilization}%`,
      threshold: OCCUPANCY_THRESHOLDS.LOW_UTILIZATION,
      severity: AlertSeverity.INFO
    });
  }

  return alerts;
};

// Clear memoization caches periodically to prevent memory leaks
setInterval(() => {
  calculateUtilizationRate.cache.clear();
  calculateOccupancyTrend.cache.clear();
}, OCCUPANCY_THRESHOLDS.TREND_CACHE_TTL);