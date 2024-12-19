/**
 * @fileoverview Web Worker for processing occupancy data and analytics
 * @version 1.0.0
 * @package lodash@4.17.21
 * @package simple-statistics@7.8.0
 */

import { throttle } from 'lodash';
import { 
  mean, 
  standardDeviation, 
  linearRegression,
  quantile 
} from 'simple-statistics';

import { 
  OccupancyData, 
  OccupancyTrend,
  OccupancyAlertType,
  AlertSeverity,
  OccupancyAlert,
  isOccupancyData 
} from '../types/occupancy.types';

// Declare worker context
declare const self: DedicatedWorkerGlobalScope;

// Constants for configuration
const UPDATE_INTERVAL = 30000; // 30 seconds
const CACHE_DURATION = 300000; // 5 minutes
const ANOMALY_THRESHOLD = 0.2; // 20% deviation threshold
const BATCH_SIZE = 100;
const MAX_BUFFER_SIZE = 1000;

// Global state management with TypeScript types
const occupancyCache = new Map<string, { 
  data: OccupancyData; 
  timestamp: number; 
}>();

const statisticsBuffer = new Map<string, OccupancyData[]>();

/**
 * Interface for worker thread message communication
 */
interface OccupancyWorkerMessage {
  type: 'PROCESS_DATA' | 'CALCULATE_TRENDS' | 'DETECT_ANOMALIES';
  payload: any;
  timestamp: string;
  correlationId: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
}

/**
 * Processes raw occupancy data with validation and enrichment
 * @param data Raw occupancy data to process
 * @returns Processed and validated occupancy data
 */
const processOccupancyData = throttle((data: OccupancyData) => {
  try {
    // Validate data structure
    if (!isOccupancyData(data)) {
      throw new Error('Invalid occupancy data structure');
    }

    // Sanitize input values
    const sanitizedData = {
      ...data,
      occupantCount: Math.max(0, Math.floor(data.occupantCount)),
      capacity: Math.max(1, Math.floor(data.capacity))
    };

    // Calculate utilization metrics
    const utilizationRate = (sanitizedData.occupantCount / sanitizedData.capacity) * 100;
    const densityMetric = sanitizedData.occupantCount / (sanitizedData.capacity * 0.75); // 75% baseline

    // Update cache with TTL
    occupancyCache.set(data.spaceId, {
      data: {
        ...sanitizedData,
        utilizationRate: Math.min(100, utilizationRate)
      },
      timestamp: Date.now()
    });

    // Maintain statistics buffer
    const spaceBuffer = statisticsBuffer.get(data.spaceId) || [];
    spaceBuffer.push(sanitizedData);
    if (spaceBuffer.length > MAX_BUFFER_SIZE) {
      spaceBuffer.shift();
    }
    statisticsBuffer.set(data.spaceId, spaceBuffer);

    return {
      ...sanitizedData,
      utilizationRate,
      densityMetric,
      confidenceScore: calculateConfidenceScore(sanitizedData)
    };
  } catch (error) {
    console.error('Error processing occupancy data:', error);
    throw error;
  }
}, 100);

/**
 * Calculates occupancy trends with statistical analysis
 * @param dataPoints Array of occupancy data points
 * @param timeRange Time range for trend analysis
 * @returns Trend analysis results
 */
const calculateTrends = (dataPoints: OccupancyData[], timeRange: { start: Date; end: Date }): OccupancyTrend => {
  // Filter data points within time range
  const filteredPoints = dataPoints.filter(point => 
    point.timestamp >= timeRange.start && point.timestamp <= timeRange.end
  );

  // Calculate basic statistics
  const utilizationRates = filteredPoints.map(p => p.utilizationRate);
  const avgUtilization = mean(utilizationRates);
  const stdDev = standardDeviation(utilizationRates);

  // Perform trend analysis
  const timeSeriesData = filteredPoints.map((point, index) => [
    index,
    point.utilizationRate
  ]);
  const trend = linearRegression(timeSeriesData);

  // Calculate percentiles for distribution analysis
  const percentiles = {
    p25: quantile(utilizationRates, 0.25),
    p50: quantile(utilizationRates, 0.50),
    p75: quantile(utilizationRates, 0.75)
  };

  return {
    spaceId: dataPoints[0].spaceId,
    timeRange,
    averageUtilization: avgUtilization,
    peakOccupancy: Math.max(...filteredPoints.map(p => p.occupantCount)),
    dataPoints: filteredPoints,
    statistics: {
      standardDeviation: stdDev,
      trend: trend.m, // slope indicates trend direction
      percentiles,
      confidenceInterval: calculateConfidenceInterval(avgUtilization, stdDev, filteredPoints.length)
    }
  };
};

/**
 * Detects anomalies in occupancy patterns
 * @param dataPoints Array of occupancy data points
 * @returns Array of detected anomalies
 */
const detectAnomalies = (dataPoints: OccupancyData[]): OccupancyAlert[] => {
  const alerts: OccupancyAlert[] = [];
  const recentPoints = dataPoints.slice(-BATCH_SIZE);

  // Calculate baseline metrics
  const baselineUtilization = mean(recentPoints.map(p => p.utilizationRate));
  const stdDev = standardDeviation(recentPoints.map(p => p.utilizationRate));

  // Analyze latest data point
  const latestPoint = recentPoints[recentPoints.length - 1];
  const deviation = Math.abs(latestPoint.utilizationRate - baselineUtilization);

  // Check for anomalies
  if (deviation > stdDev * 2) {
    alerts.push({
      spaceId: latestPoint.spaceId,
      timestamp: new Date(),
      alertType: latestPoint.utilizationRate > baselineUtilization 
        ? OccupancyAlertType.HIGH_UTILIZATION 
        : OccupancyAlertType.LOW_UTILIZATION,
      message: `Unusual occupancy pattern detected: ${Math.round(deviation)}% deviation from baseline`,
      threshold: baselineUtilization,
      severity: deviation > stdDev * 3 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING
    });
  }

  // Check capacity violations
  if (latestPoint.occupantCount > latestPoint.capacity) {
    alerts.push({
      spaceId: latestPoint.spaceId,
      timestamp: new Date(),
      alertType: OccupancyAlertType.CAPACITY_EXCEEDED,
      message: `Space capacity exceeded: ${latestPoint.occupantCount}/${latestPoint.capacity} occupants`,
      threshold: latestPoint.capacity,
      severity: AlertSeverity.CRITICAL
    });
  }

  return alerts;
};

/**
 * Calculates confidence score for occupancy data
 * @param data Occupancy data point
 * @returns Confidence score between 0 and 1
 */
const calculateConfidenceScore = (data: OccupancyData): number => {
  const factors = [
    data.occupantCount >= 0,
    data.occupantCount <= data.capacity * 1.1, // Allow 10% overflow
    data.timestamp <= new Date(),
    data.utilizationRate >= 0 && data.utilizationRate <= 100
  ];
  return factors.filter(Boolean).length / factors.length;
};

/**
 * Calculates confidence interval for statistical analysis
 * @param mean Mean value
 * @param stdDev Standard deviation
 * @param n Sample size
 * @returns Confidence interval object
 */
const calculateConfidenceInterval = (mean: number, stdDev: number, n: number) => {
  const z = 1.96; // 95% confidence level
  const margin = z * (stdDev / Math.sqrt(n));
  return {
    lower: mean - margin,
    upper: mean + margin
  };
};

// Set up message handler for worker thread
self.addEventListener('message', (event: MessageEvent<OccupancyWorkerMessage>) => {
  const { type, payload, correlationId } = event.data;

  try {
    switch (type) {
      case 'PROCESS_DATA':
        const processedData = processOccupancyData(payload);
        self.postMessage({ type: 'PROCESSED_DATA', payload: processedData, correlationId });
        break;

      case 'CALCULATE_TRENDS':
        const trends = calculateTrends(payload.dataPoints, payload.timeRange);
        self.postMessage({ type: 'TREND_RESULTS', payload: trends, correlationId });
        break;

      case 'DETECT_ANOMALIES':
        const anomalies = detectAnomalies(payload);
        self.postMessage({ type: 'ANOMALY_RESULTS', payload: anomalies, correlationId });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({ 
      type: 'ERROR', 
      payload: { message: error.message, stack: error.stack },
      correlationId 
    });
  }
});

// Periodic cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of occupancyCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      occupancyCache.delete(key);
    }
  }
}, UPDATE_INTERVAL);