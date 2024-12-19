// @package typeorm v0.3.0
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index
} from 'typeorm';

import { 
  IResource, 
  ResourceType, 
  ResourceStatus, 
  IResourceAttributes 
} from '../interfaces/resource.interface';

/**
 * TypeORM entity model for workplace resources
 * Handles persistence and validation of resource data
 */
@Entity('resources')
@Index(['type', 'status'])
@Index(['spaceId'])
export class ResourceModel implements IResource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ResourceType,
    nullable: false
  })
  type: ResourceType;

  @Column({
    type: 'enum',
    enum: ResourceStatus,
    nullable: false
  })
  status: ResourceStatus;

  @Column({
    type: 'integer',
    nullable: false
  })
  capacity: number;

  @Column({
    type: 'jsonb',
    nullable: false
  })
  attributes: IResourceAttributes;

  @Column({
    type: 'uuid',
    nullable: false
  })
  spaceId: string;

  @Column({
    type: 'uuid',
    nullable: false
  })
  floorId: string;

  @Column({
    type: 'uuid',
    nullable: false
  })
  buildingId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({
    type: 'boolean',
    default: false
  })
  isDeleted: boolean;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false
  })
  lastModifiedBy: string;

  @Column({
    type: 'jsonb',
    nullable: false
  })
  availability: IResourceAvailability;

  @Column({
    type: 'jsonb',
    nullable: false
  })
  costs: IResourceCosts;

  /**
   * Creates a new resource model instance
   * @param data - Initial resource data
   */
  constructor(data?: Partial<IResource>) {
    if (data) {
      Object.assign(this, data);
    }
    this.isDeleted = false;
    this.validate();
  }

  /**
   * Validates resource data against business rules
   * @throws Error if validation fails
   */
  validate(): boolean {
    // Required field validation
    if (!this.type || !this.status || !this.spaceId || !this.floorId || !this.buildingId) {
      throw new Error('Missing required resource fields');
    }

    // Capacity validation
    if (this.capacity < 0) {
      throw new Error('Resource capacity cannot be negative');
    }

    // Attributes validation
    if (!this.attributes || !this.attributes.name || !this.attributes.description) {
      throw new Error('Resource attributes must include name and description');
    }

    // Dimensions validation
    if (this.attributes.dimensions) {
      const { width, length, area } = this.attributes.dimensions;
      if (width <= 0 || length <= 0 || area <= 0) {
        throw new Error('Resource dimensions must be positive values');
      }
    }

    // Reservation rules validation
    if (this.attributes.reservationRules) {
      const { minDuration, maxDuration } = this.attributes.reservationRules;
      if (minDuration > maxDuration) {
        throw new Error('Minimum duration cannot exceed maximum duration');
      }
    }

    return true;
  }

  /**
   * Converts model instance to plain JSON object
   * @returns IResource compliant object
   */
  toJSON(): IResource {
    const {
      isDeleted,
      ...resourceData
    } = this;

    return {
      ...resourceData,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      attributes: {
        ...this.attributes,
        maintenanceSchedule: {
          ...this.attributes.maintenanceSchedule,
          lastMaintenance: this.attributes.maintenanceSchedule.lastMaintenance.toISOString(),
          nextScheduled: this.attributes.maintenanceSchedule.nextScheduled.toISOString()
        }
      }
    };
  }

  /**
   * Creates a new model instance from JSON data
   * @param data - Resource data in JSON format
   * @returns New resource model instance
   */
  static fromJSON(data: Partial<IResource>): ResourceModel {
    // Parse dates from ISO strings
    if (data.attributes?.maintenanceSchedule) {
      data.attributes.maintenanceSchedule.lastMaintenance = new Date(data.attributes.maintenanceSchedule.lastMaintenance);
      data.attributes.maintenanceSchedule.nextScheduled = new Date(data.attributes.maintenanceSchedule.nextScheduled);
    }

    if (data.availability?.scheduledDowntime) {
      data.availability.scheduledDowntime = data.availability.scheduledDowntime.map(dt => ({
        ...dt,
        start: new Date(dt.start),
        end: new Date(dt.end)
      }));
    }

    const resource = new ResourceModel(data);
    resource.validate();
    return resource;
  }

  /**
   * Updates resource status with validation
   * @param newStatus - New resource status
   * @param modifiedBy - User ID making the change
   */
  updateStatus(newStatus: ResourceStatus, modifiedBy: string): void {
    // Validate status transition
    const invalidTransitions = {
      [ResourceStatus.OUT_OF_SERVICE]: [ResourceStatus.OCCUPIED, ResourceStatus.RESERVED],
      [ResourceStatus.MAINTENANCE]: [ResourceStatus.OCCUPIED, ResourceStatus.RESERVED]
    };

    if (invalidTransitions[this.status]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
    }

    this.status = newStatus;
    this.lastModifiedBy = modifiedBy;
    this.updatedAt = new Date();
  }

  /**
   * Updates resource attributes with validation
   * @param updates - Partial attribute updates
   * @param modifiedBy - User ID making the change
   */
  updateAttributes(updates: Partial<IResourceAttributes>, modifiedBy: string): void {
    this.attributes = {
      ...this.attributes,
      ...updates
    };
    this.lastModifiedBy = modifiedBy;
    this.updatedAt = new Date();
    this.validate();
  }
}