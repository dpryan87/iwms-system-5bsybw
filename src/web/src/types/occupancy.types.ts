/**
 * @fileoverview TypeScript type definitions for occupancy tracking and space utilization features
 * @version 1.0.0
 * @package @types/node@18.x
 */

import { TimeRange } from '@types/node';

/**
 * Interface defining the structure of occupancy data points with validation constraints
 * @interface OccupancyData
 */
export interface OccupancyData {
  /** Unique identifier for the space being monitored */
  spaceId: string;
  
  /** Timestamp when the occupancy data was recorded */
  timestamp: Date;
  
  /** Current number of occupants in the space */
  occupantCount: number;
  
  /** Maximum capacity of the space */
  capacity: number;
  
  /** Current utilization rate as a percentage (0-100) */
  utilizationRate: number;
}

/**
 * Interface for analyzing occupancy trends over time with immutable data points
 * @interface OccupancyTrend
 */
export interface OccupancyTrend {
  /** Space identifier for trend analysis */
  spaceId: string;
  
  /** Time range for the trend analysis */
  timeRange: {
    start: Date;
    end: Date;
  };
  
  /** Average utilization rate over the time period */
  averageUtilization: number;
  
  /** Peak occupancy count during the time period */
  peakOccupancy: number;
  
  /** Immutable array of occupancy data points */
  readonly dataPoints: readonly OccupancyData[];
}

/**
 * Interface for filtering occupancy data with validation ranges
 * @interface OccupancyFilter
 */
export interface OccupancyFilter {
  /** Space identifier to filter */
  spaceId: string;
  
  /** Time range for filtering */
  timeRange: {
    start: Date;
    end: Date;
  };
  
  /** Minimum utilization rate threshold (0-100) */
  minUtilization: number;
  
  /** Maximum utilization rate threshold (0-100) */
  maxUtilization: number;
}

/**
 * Enumeration of possible occupancy alert types
 * @enum {string}
 */
export enum OccupancyAlertType {
  /** Alert for high space utilization */
  HIGH_UTILIZATION = 'HIGH_UTILIZATION',
  
  /** Alert for underutilized spaces */
  LOW_UTILIZATION = 'LOW_UTILIZATION',
  
  /** Alert when space capacity is exceeded */
  CAPACITY_EXCEEDED = 'CAPACITY_EXCEEDED',
  
  /** Alert for occupancy sensor malfunction */
  SENSOR_ERROR = 'SENSOR_ERROR'
}

/**
 * Enumeration of alert severity levels
 * @enum {string}
 */
export enum AlertSeverity {
  /** Informational alerts */
  INFO = 'INFO',
  
  /** Warning alerts requiring attention */
  WARNING = 'WARNING',
  
  /** Critical alerts requiring immediate action */
  CRITICAL = 'CRITICAL'
}

/**
 * Interface for occupancy-related alerts with severity levels
 * @interface OccupancyAlert
 */
export interface OccupancyAlert {
  /** Space identifier where alert was triggered */
  spaceId: string;
  
  /** Timestamp when the alert was generated */
  timestamp: Date;
  
  /** Type of occupancy alert */
  alertType: OccupancyAlertType;
  
  /** Human-readable alert message */
  message: string;
  
  /** Threshold value that triggered the alert */
  threshold: number;
  
  /** Alert severity level */
  severity: AlertSeverity;
}

/**
 * Type guard to check if a value is a valid OccupancyData object
 * @param value - Value to check
 * @returns boolean indicating if value is OccupancyData
 */
export function isOccupancyData(value: any): value is OccupancyData {
  return (
    typeof value === 'object' &&
    typeof value.spaceId === 'string' &&
    value.timestamp instanceof Date &&
    typeof value.occupantCount === 'number' &&
    typeof value.capacity === 'number' &&
    typeof value.utilizationRate === 'number' &&
    value.utilizationRate >= 0 &&
    value.utilizationRate <= 100
  );
}

/**
 * Type guard to check if a value is a valid OccupancyAlert object
 * @param value - Value to check
 * @returns boolean indicating if value is OccupancyAlert
 */
export function isOccupancyAlert(value: any): value is OccupancyAlert {
  return (
    typeof value === 'object' &&
    typeof value.spaceId === 'string' &&
    value.timestamp instanceof Date &&
    Object.values(OccupancyAlertType).includes(value.alertType) &&
    typeof value.message === 'string' &&
    typeof value.threshold === 'number' &&
    Object.values(AlertSeverity).includes(value.severity)
  );
}