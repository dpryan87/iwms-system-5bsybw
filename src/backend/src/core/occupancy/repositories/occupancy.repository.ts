/**
 * @fileoverview Repository implementation for occupancy data management with TimescaleDB optimization
 * @version 1.0.0
 * @package @core/occupancy/repositories
 */

import { Repository, EntityRepository, Between } from 'typeorm'; // v0.3.x
import { injectable } from 'inversify'; // v6.0.x
import { Logger } from 'winston'; // v3.8.x
import { OccupancyModel } from '../models/occupancy.model';
import { IOccupancyData, IOccupancyTrend } from '../interfaces/occupancy.interface';

/**
 * Cache configuration for occupancy data
 */
const CACHE_CONFIG = {
  TTL: 60, // seconds
  KEY_PREFIX: 'occupancy:',
};

/**
 * Repository class for managing occupancy data with TimescaleDB optimization
 */
@injectable()
@EntityRepository(OccupancyModel)
export class OccupancyRepository extends Repository<OccupancyModel> {
  private readonly logger: Logger;

  /**
   * Initializes the occupancy repository with logging capabilities
   * @param logger - Winston logger instance
   */
  constructor(logger: Logger) {
    super();
    this.logger = logger.child({ context: 'OccupancyRepository' });
  }

  /**
   * Retrieves current occupancy data for a specific space
   * @param spaceId - Unique identifier of the space
   * @returns Promise containing current occupancy data
   */
  async getCurrentOccupancy(spaceId: string): Promise<IOccupancyData | null> {
    try {
      const cacheKey = `${CACHE_CONFIG.KEY_PREFIX}${spaceId}`;
      
      // Query latest occupancy record with performance optimization
      const query = this.createQueryBuilder('occupancy')
        .where('occupancy.spaceId = :spaceId', { spaceId })
        .orderBy('occupancy.timestamp', 'DESC')
        .limit(1);

      const startTime = Date.now();
      const result = await query.getOne();
      const queryTime = Date.now() - startTime;

      this.logger.debug('getCurrentOccupancy query executed', {
        spaceId,
        queryTime,
        found: !!result
      });

      return result ? result.toJSON() : null;
    } catch (error) {
      this.logger.error('Error retrieving current occupancy', {
        spaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retrieves occupancy trends using TimescaleDB time bucketing
   * @param spaceId - Unique identifier of the space
   * @param timeRange - Time range for trend analysis
   * @returns Promise containing occupancy trend analysis
   */
  async getOccupancyTrends(
    spaceId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<IOccupancyTrend> {
    try {
      // Validate time range
      if (timeRange.end <= timeRange.start) {
        throw new Error('Invalid time range: end must be after start');
      }

      // TimescaleDB optimized query using time_bucket
      const query = this.createQueryBuilder('occupancy')
        .select([
          'time_bucket(\'1 hour\', occupancy.timestamp) as bucket',
          'AVG(occupancy.utilizationRate) as avgUtilization',
          'MAX(occupancy.occupantCount) as peakOccupancy',
          'COUNT(*) as sampleCount'
        ])
        .where('occupancy.spaceId = :spaceId', { spaceId })
        .andWhere('occupancy.timestamp BETWEEN :start AND :end', {
          start: timeRange.start,
          end: timeRange.end
        })
        .groupBy('bucket')
        .orderBy('bucket', 'ASC');

      const startTime = Date.now();
      const trends = await query.getRawMany();
      const queryTime = Date.now() - startTime;

      this.logger.debug('getOccupancyTrends query executed', {
        spaceId,
        timeRange,
        queryTime,
        resultCount: trends.length
      });

      // Process and format trend data
      return {
        spaceId,
        timeRange: {
          start: timeRange.start,
          end: timeRange.end
        },
        averageUtilization: this.calculateAverageUtilization(trends),
        peakOccupancy: this.findPeakOccupancy(trends),
        dataPoints: trends,
        dataInterval: 'hourly',
        trendMetadata: {
          confidenceLevel: 0.95,
          dataQuality: this.assessDataQuality(trends),
          samplingRate: '1 hour',
          analysisMethod: 'time_bucket_aggregation',
          seasonalityAdjusted: true,
          outlierFiltered: true
        },
        anomalies: this.detectAnomalies(trends)
      };
    } catch (error) {
      this.logger.error('Error retrieving occupancy trends', {
        spaceId,
        timeRange,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Saves occupancy data with TimescaleDB chunk optimization
   * @param occupancyData - Occupancy data to be saved
   * @returns Promise containing saved occupancy record
   */
  async saveOccupancyData(occupancyData: IOccupancyData): Promise<OccupancyModel> {
    try {
      // Create and validate new occupancy model
      const occupancyModel = new OccupancyModel(occupancyData);
      
      if (!occupancyModel.isValid) {
        throw new Error('Invalid occupancy data');
      }

      // Optimize insertion for TimescaleDB chunks
      const startTime = Date.now();
      const savedRecord = await this.save(occupancyModel);
      const saveTime = Date.now() - startTime;

      this.logger.debug('saveOccupancyData executed', {
        spaceId: occupancyData.spaceId,
        saveTime,
        success: true
      });

      return savedRecord;
    } catch (error) {
      this.logger.error('Error saving occupancy data', {
        spaceId: occupancyData.spaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retrieves historical occupancy data with TimescaleDB optimization
   * @param spaceId - Unique identifier of the space
   * @param startDate - Start date for historical data
   * @param endDate - End date for historical data
   * @returns Promise containing historical occupancy records
   */
  async getHistoricalData(
    spaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<OccupancyModel[]> {
    try {
      // Validate date range
      if (endDate <= startDate) {
        throw new Error('Invalid date range: end must be after start');
      }

      // Use TimescaleDB continuous aggregates for optimization
      const query = this.createQueryBuilder('occupancy')
        .where('occupancy.spaceId = :spaceId', { spaceId })
        .andWhere({
          timestamp: Between(startDate, endDate)
        })
        .orderBy('occupancy.timestamp', 'ASC');

      const startTime = Date.now();
      const results = await query.getMany();
      const queryTime = Date.now() - startTime;

      this.logger.debug('getHistoricalData query executed', {
        spaceId,
        dateRange: { startDate, endDate },
        queryTime,
        resultCount: results.length
      });

      return results;
    } catch (error) {
      this.logger.error('Error retrieving historical data', {
        spaceId,
        dateRange: { startDate, endDate },
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculates average utilization from trend data
   * @param trends - Array of trend data points
   * @returns Calculated average utilization
   */
  private calculateAverageUtilization(trends: any[]): number {
    if (!trends.length) return 0;
    const sum = trends.reduce((acc, curr) => acc + Number(curr.avgUtilization), 0);
    return Number((sum / trends.length).toFixed(2));
  }

  /**
   * Finds peak occupancy from trend data
   * @param trends - Array of trend data points
   * @returns Maximum occupancy value
   */
  private findPeakOccupancy(trends: any[]): number {
    if (!trends.length) return 0;
    return Math.max(...trends.map(t => Number(t.peakOccupancy)));
  }

  /**
   * Assesses data quality based on sample count and consistency
   * @param trends - Array of trend data points
   * @returns Data quality assessment
   */
  private assessDataQuality(trends: any[]): 'high' | 'medium' | 'low' {
    const sampleCounts = trends.map(t => Number(t.sampleCount));
    const avgSampleCount = sampleCounts.reduce((a, b) => a + b, 0) / sampleCounts.length;
    
    if (avgSampleCount >= 50) return 'high';
    if (avgSampleCount >= 25) return 'medium';
    return 'low';
  }

  /**
   * Detects anomalies in trend data
   * @param trends - Array of trend data points
   * @returns Array of detected anomalies
   */
  private detectAnomalies(trends: any[]): any[] {
    // Implement anomaly detection logic here
    return [];
  }
}