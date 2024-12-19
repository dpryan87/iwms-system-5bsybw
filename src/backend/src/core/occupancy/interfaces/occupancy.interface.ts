/**
 * @fileoverview Core interfaces for occupancy tracking and space utilization monitoring
 * @version 1.0.0
 * @package @core/occupancy
 */

import { TimeRange } from '@types/node'; // v18.x

/**
 * Represents metadata for occupancy sensors
 */
interface ISensorMetadata {
  sensorId: string;
  sensorType: string;
  accuracy: number;
  lastCalibration: Date;
  manufacturer: string;
  firmwareVersion: string;
  batteryLevel?: number;
  connectionStatus: 'online' | 'offline' | 'degraded';
}

/**
 * Represents metadata for trend analysis
 */
interface ITrendMetadata {
  confidenceLevel: number;
  dataQuality: 'high' | 'medium' | 'low';
  samplingRate: string;
  analysisMethod: string;
  seasonalityAdjusted: boolean;
  outlierFiltered: boolean;
}

/**
 * Represents an occupancy anomaly detection
 */
interface IOccupancyAnomaly {
  timestamp: Date;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

/**
 * Result wrapper for error handling
 */
interface Result<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Options for occupancy data retrieval
 */
interface IOccupancyOptions {
  includeMetadata?: boolean;
  validateData?: boolean;
  source?: string[];
}

/**
 * Options for trend analysis
 */
interface IAnalysisOptions {
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly';
  includeAnomalies?: boolean;
  smoothing?: boolean;
  confidenceLevel?: number;
}

/**
 * Result of batch occupancy updates
 */
interface BatchUpdateResult {
  successCount: number;
  failureCount: number;
  errors: Array<{
    spaceId: string;
    error: string;
  }>;
}

/**
 * Represents a single occupancy data point with enhanced metadata support
 */
export interface IOccupancyData {
  spaceId: string;
  timestamp: Date;
  occupantCount: number;
  capacity: number;
  utilizationRate: number;
  sensorMetadata: ISensorMetadata;
  dataSource: string;
  isValidated: boolean;
}

/**
 * Represents occupancy trend analysis with enhanced trend metadata
 */
export interface IOccupancyTrend {
  spaceId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  averageUtilization: number;
  peakOccupancy: number;
  dataPoints: IOccupancyData[];
  dataInterval: 'hourly' | 'daily' | 'weekly' | 'monthly';
  trendMetadata: ITrendMetadata;
  anomalies: IOccupancyAnomaly[];
}

/**
 * Service contract for occupancy tracking and analysis with enhanced error handling
 */
export interface IOccupancyService {
  /**
   * Retrieves current occupancy data for a specific space
   * @param spaceId - Unique identifier of the space
   * @param options - Optional parameters for data retrieval
   * @returns Promise containing occupancy data or error
   */
  getCurrentOccupancy(
    spaceId: string,
    options?: IOccupancyOptions
  ): Promise<Result<IOccupancyData>>;

  /**
   * Retrieves and analyzes occupancy trends for a specific space
   * @param spaceId - Unique identifier of the space
   * @param timeRange - Time range for trend analysis
   * @param analysisOptions - Optional parameters for trend analysis
   * @returns Promise containing trend analysis or error
   */
  getOccupancyTrends(
    spaceId: string,
    timeRange: TimeRange,
    analysisOptions?: IAnalysisOptions
  ): Promise<Result<IOccupancyTrend>>;

  /**
   * Updates occupancy data for a specific space
   * @param occupancyData - New occupancy data
   * @param validationOptions - Optional parameters for data validation
   * @returns Promise indicating success or failure
   */
  updateOccupancyData(
    occupancyData: IOccupancyData,
    validationOptions?: {
      validateSensor?: boolean;
      requireMetadata?: boolean;
    }
  ): Promise<Result<void>>;

  /**
   * Performs batch updates of occupancy data from multiple sensors
   * @param occupancyDataArray - Array of occupancy data points
   * @param batchOptions - Optional parameters for batch processing
   * @returns Promise containing batch update results
   */
  batchUpdateOccupancy(
    occupancyDataArray: IOccupancyData[],
    batchOptions?: {
      validateAll?: boolean;
      continueOnError?: boolean;
      maxConcurrent?: number;
    }
  ): Promise<Result<BatchUpdateResult>>;
}