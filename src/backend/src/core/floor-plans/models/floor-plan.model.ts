// @package typeorm v0.3.0
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

import {
  IFloorPlan,
  FloorPlanStatus,
  IFloorPlanMetadata,
  IVersionInfo,
  IAuditInfo,
  IBMSIntegration
} from '../interfaces/floor-plan.interface';

/**
 * Enhanced TypeORM entity model for floor plans with comprehensive tracking and validation
 * Implements the IFloorPlan interface with additional database-specific decorators
 */
@Entity('floor_plans')
@Index(['propertyId'])
@Index(['status'])
@Index(['createdAt'])
@Index(['version'])
export class FloorPlanModel implements IFloorPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  propertyId: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  version: string;

  @Column({
    type: 'enum',
    enum: FloorPlanStatus,
    default: FloorPlanStatus.DRAFT
  })
  status: FloorPlanStatus;

  @Column({ type: 'jsonb', nullable: false })
  metadata: IFloorPlanMetadata;

  @Column({ type: 'jsonb', nullable: false })
  versionInfo: IVersionInfo;

  @Column({ type: 'jsonb', nullable: false })
  auditInfo: IAuditInfo;

  @Column({ type: 'jsonb', nullable: true })
  bmsConfig: IBMSIntegration;

  @Column({ type: 'varchar', length: 100, nullable: false })
  createdBy: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  updatedBy: string;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    name: 'created_at'
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    name: 'updated_at'
  })
  updatedAt: Date;

  /**
   * Converts the model instance to a plain object with validation and sanitization
   * @returns IFloorPlan compatible object with sanitized and validated data
   */
  toJSON(): IFloorPlan {
    const {
      id,
      propertyId,
      version,
      status,
      metadata,
      versionInfo,
      auditInfo,
      bmsConfig,
      createdBy,
      updatedBy,
      createdAt,
      updatedAt
    } = this;

    // Ensure all required metadata fields are present
    if (!metadata.name || !metadata.level || !metadata.totalArea) {
      throw new Error('Invalid floor plan metadata');
    }

    // Validate version info structure
    if (!versionInfo.major || !versionInfo.minor || versionInfo.revision === undefined) {
      throw new Error('Invalid version information');
    }

    // Ensure audit trail is complete
    if (!auditInfo.createdAt || !auditInfo.createdBy) {
      throw new Error('Incomplete audit information');
    }

    return {
      id,
      propertyId,
      version,
      status,
      metadata: {
        ...metadata,
        fileHash: metadata.fileHash || '', // Ensure file hash is always present
        dimensions: {
          ...metadata.dimensions,
          scale: metadata.dimensions.scale || 1 // Default scale if not specified
        }
      },
      versionInfo,
      auditInfo: {
        ...auditInfo,
        comments: auditInfo.comments || [] // Ensure comments array exists
      },
      bmsConfig,
      createdBy,
      updatedBy,
      createdAt,
      updatedAt
    };
  }
}