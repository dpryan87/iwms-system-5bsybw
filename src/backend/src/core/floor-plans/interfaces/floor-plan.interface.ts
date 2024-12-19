// @package inversify v6.0.1
import { IBaseService } from '../../../common/interfaces/service.interface';

/**
 * Defines physical dimensions of a floor plan with scale factor
 */
export interface IFloorPlanDimensions {
  width: number;
  height: number;
  scale: number;  // Scale factor for rendering (e.g., 1:100)
}

/**
 * Configuration for integration with Building Management Systems
 */
export interface IBMSIntegration {
  systemId: string;  // Unique identifier for the BMS system
  sensorMappings: string;  // JSON mapping of sensors to floor plan coordinates
  enabled: boolean;  // Integration status flag
  config: IIntegrationConfig;  // Additional BMS-specific configuration
}

/**
 * Integration configuration for external systems
 */
export interface IIntegrationConfig {
  endpoint: string;
  credentials: {
    apiKey: string;
    secret?: string;
  };
  refreshInterval: number;  // Refresh interval in milliseconds
  retryPolicy: {
    attempts: number;
    backoff: number;
  };
}

/**
 * Validation rules for floor plan data integrity
 */
export interface IValidationRules {
  minArea: number;  // Minimum allowed area in square meters
  maxArea: number;  // Maximum allowed area in square meters
  requiredFields: string[];  // List of mandatory fields
  customRules: Record<string, string>;  // Custom validation rules
}

/**
 * Enhanced metadata for floor plan management
 */
export interface IFloorPlanMetadata {
  name: string;
  level: number;  // Floor level number
  totalArea: number;  // Total area in square meters
  dimensions: IFloorPlanDimensions;
  fileUrl: string;  // URL to floor plan file in storage
  fileHash: string;  // SHA-256 hash of the file for integrity
  bmsConfig: IBMSIntegration;
  validationRules: IValidationRules;
  customAttributes: Record<string, unknown>;  // Extensible custom attributes
}

/**
 * Version control information for floor plans
 */
export interface IVersionInfo {
  major: number;
  minor: number;
  revision: number;
  changelog: string;
  previousVersion?: string;
  isLatest: boolean;
}

/**
 * Audit information for tracking changes
 */
export interface IAuditInfo {
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  comments: string[];
}

/**
 * Validation result interface for floor plan data
 */
export interface IValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

/**
 * Enhanced enumeration of possible floor plan statuses
 */
export enum FloorPlanStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  REJECTED = 'REJECTED',
  DEPRECATED = 'DEPRECATED'
}

/**
 * Main floor plan interface with comprehensive tracking and validation
 */
export interface IFloorPlan {
  id: string;  // Unique identifier
  propertyId: string;  // Reference to parent property
  version: string;  // Semantic version string
  status: FloorPlanStatus;
  metadata: IFloorPlanMetadata;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;  // User ID of creator
  updatedBy: string;  // User ID of last modifier
  versionInfo: IVersionInfo;
  auditInfo: IAuditInfo;
}

/**
 * Enhanced service interface for floor plan operations
 * Extends base service with specialized floor plan management capabilities
 */
export interface IFloorPlanService extends IBaseService {
  /**
   * Creates a new floor plan with validation
   * @param data Floor plan data to create
   * @returns Promise resolving to created floor plan
   */
  createFloorPlan(data: IFloorPlan): Promise<IFloorPlan>;

  /**
   * Updates an existing floor plan with version control
   * @param id Floor plan identifier
   * @param data Partial floor plan data to update
   * @returns Promise resolving to updated floor plan
   */
  updateFloorPlan(id: string, data: Partial<IFloorPlan>): Promise<IFloorPlan>;

  /**
   * Creates multiple floor plans in a transaction
   * @param data Array of floor plan data to create
   * @returns Promise resolving to array of created floor plans
   */
  bulkCreateFloorPlans(data: IFloorPlan[]): Promise<IFloorPlan[]>;

  /**
   * Validates floor plan data against defined rules
   * @param data Floor plan data to validate
   * @returns Promise resolving to validation results
   */
  validateFloorPlan(data: IFloorPlan): Promise<IValidationResult>;
}

// Export all interfaces and types for floor plan management
export {
  IFloorPlan,
  IFloorPlanService,
  IFloorPlanMetadata,
  IFloorPlanDimensions,
  IBMSIntegration,
  IValidationRules,
  IVersionInfo,
  IAuditInfo,
  IValidationResult,
  FloorPlanStatus
};