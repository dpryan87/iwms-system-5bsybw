/**
 * @fileoverview Occupancy data model with time-series capabilities using TypeORM and TimescaleDB
 * @version 1.0.0
 * @package @core/occupancy/models
 */

import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  Index 
} from 'typeorm'; // v0.3.x
import { IOccupancyData } from '../interfaces/occupancy.interface';
import { validate as uuidValidate } from 'uuid'; // v9.x

/**
 * Entity model for storing and managing occupancy data with time-series capabilities
 * using TimescaleDB extension for efficient time-series data management
 */
@Entity('occupancy_data')
@Index(['spaceId', 'timestamp'], { unique: true })
@Index(['timestamp'])
@Index(['spaceId'])
export class OccupancyModel implements Partial<IOccupancyData> {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  spaceId: string;

  @Column('timestamp with time zone')
  timestamp: Date;

  @Column('integer')
  occupantCount: number;

  @Column('integer')
  capacity: number;

  @Column('decimal', { precision: 5, scale: 2 })
  utilizationRate: number;

  @Column('timestamp with time zone', { default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column('timestamp with time zone', { default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column('boolean', { default: true })
  isValid: boolean;

  /**
   * Initializes a new occupancy data record with validation
   * @param data - Occupancy data input conforming to IOccupancyData interface
   */
  constructor(data?: Partial<IOccupancyData>) {
    if (data) {
      this.spaceId = data.spaceId;
      this.timestamp = data.timestamp || new Date();
      this.occupantCount = data.occupantCount;
      this.capacity = data.capacity;
      this.utilizationRate = this.calculateUtilizationRate();
      this.createdAt = new Date();
      this.updatedAt = new Date();
      this.isValid = this.validateData();
    }
  }

  /**
   * Converts the model instance to a plain JSON object with formatted values
   * @returns Formatted object representation of occupancy data
   */
  toJSON(): Partial<IOccupancyData> & { isValid: boolean } {
    return {
      id: this.id,
      spaceId: this.spaceId,
      timestamp: this.timestamp.toISOString(),
      occupantCount: this.occupantCount,
      capacity: this.capacity,
      utilizationRate: Number(this.utilizationRate.toFixed(2)),
      isValid: this.isValid,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * Calculates the space utilization rate with validation
   * @returns Calculated utilization rate as percentage
   * @throws Error if capacity is invalid
   */
  private calculateUtilizationRate(): number {
    if (this.capacity <= 0) {
      throw new Error('Invalid capacity value: must be greater than zero');
    }

    if (this.occupantCount < 0) {
      throw new Error('Invalid occupant count: cannot be negative');
    }

    const rate = (this.occupantCount / this.capacity) * 100;
    return Number(Math.min(100, Math.max(0, rate)).toFixed(2));
  }

  /**
   * Validates all occupancy data fields
   * @returns Boolean indicating if the data is valid
   */
  private validateData(): boolean {
    try {
      // Validate spaceId is a valid UUID
      if (!this.spaceId || !uuidValidate(this.spaceId)) {
        return false;
      }

      // Validate timestamp
      if (!(this.timestamp instanceof Date) || isNaN(this.timestamp.getTime())) {
        return false;
      }

      // Validate occupantCount
      if (typeof this.occupantCount !== 'number' || 
          this.occupantCount < 0 || 
          !Number.isInteger(this.occupantCount)) {
        return false;
      }

      // Validate capacity
      if (typeof this.capacity !== 'number' || 
          this.capacity <= 0 || 
          !Number.isInteger(this.capacity)) {
        return false;
      }

      // Validate utilizationRate
      if (typeof this.utilizationRate !== 'number' || 
          this.utilizationRate < 0 || 
          this.utilizationRate > 100) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Updates the model's timestamp and validation status
   * @param data - Partial occupancy data for update
   */
  update(data: Partial<IOccupancyData>): void {
    if (data.occupantCount !== undefined) {
      this.occupantCount = data.occupantCount;
    }
    if (data.capacity !== undefined) {
      this.capacity = data.capacity;
    }
    
    this.utilizationRate = this.calculateUtilizationRate();
    this.updatedAt = new Date();
    this.isValid = this.validateData();
  }
}