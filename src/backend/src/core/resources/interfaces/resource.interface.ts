// @package inversify v6.0.1
import { IBaseService } from '../../../common/interfaces/service.interface';

/**
 * Defines possible resource types in the workplace management system
 */
export enum ResourceType {
  WORKSTATION = 'WORKSTATION',
  MEETING_ROOM = 'MEETING_ROOM',
  SHARED_SPACE = 'SHARED_SPACE',
  AMENITY = 'AMENITY',
  PARKING_SPACE = 'PARKING_SPACE',
  STORAGE_UNIT = 'STORAGE_UNIT',
  COLLABORATION_AREA = 'COLLABORATION_AREA',
  QUIET_ROOM = 'QUIET_ROOM',
  PHONE_BOOTH = 'PHONE_BOOTH'
}

/**
 * Defines possible resource statuses for tracking availability
 */
export enum ResourceStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  MAINTENANCE = 'MAINTENANCE',
  RESERVED = 'RESERVED',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
  CLEANING = 'CLEANING',
  PENDING_APPROVAL = 'PENDING_APPROVAL'
}

/**
 * Interface for tracking resource dimensions
 */
export interface IResourceDimensions {
  width: number;
  length: number;
  height?: number;
  area: number;
}

/**
 * Interface for environmental control settings
 */
export interface IEnvironmentalControls {
  temperature?: number;
  lighting?: number;
  ventilation?: boolean;
  noiseLevel?: number;
}

/**
 * Interface for accessibility features
 */
export interface IAccessibilityFeatures {
  wheelchairAccessible: boolean;
  hearingLoop?: boolean;
  brailleSignage?: boolean;
  adjustableHeight?: boolean;
  proximityToBathroom?: number;
}

/**
 * Interface for reservation constraints
 */
export interface IReservationConstraints {
  minDuration: number;
  maxDuration: number;
  advanceBookingLimit: number;
  allowRecurring: boolean;
  requiresApproval: boolean;
  restrictedHours?: { start: string; end: string };
}

/**
 * Interface for time slot tracking
 */
export interface ITimeSlot {
  startTime: string;
  endTime: string;
  utilization: number;
}

/**
 * Interface for resource availability
 */
export interface IResourceAvailability {
  currentStatus: ResourceStatus;
  nextAvailable?: Date;
  scheduledDowntime?: Array<{ start: Date; end: Date; reason: string }>;
  operatingHours: { [key: string]: { start: string; end: string } };
}

/**
 * Interface for resource cost tracking
 */
export interface IResourceCosts {
  hourlyRate?: number;
  dailyRate?: number;
  monthlyRate?: number;
  maintenanceCosts: number;
  utilityCosts?: number;
  totalCostYear: number;
}

/**
 * Interface for maintenance schedule tracking
 */
export interface IMaintenanceSchedule {
  lastMaintenance: Date;
  nextScheduled: Date;
  maintenanceHistory: string[];
  maintenanceProvider: string;
  maintenanceNotes: Record<string, any>;
}

/**
 * Interface for usage metrics tracking
 */
export interface IUsageMetrics {
  utilizationRate: number;
  averageOccupancyTime: number;
  peakUsageTime: number;
  popularTimeSlots: ITimeSlot[];
  usageStatistics: Record<string, number>;
}

/**
 * Interface for comprehensive resource attributes
 */
export interface IResourceAttributes {
  name: string;
  description: string;
  equipment: string[];
  location: string;
  customFields: Record<string, any>;
  maintenanceSchedule: IMaintenanceSchedule;
  usageMetrics: IUsageMetrics;
  accessibility: IAccessibilityFeatures;
  reservationRules: IReservationConstraints;
  labels: Record<string, string>;
  isBookable: boolean;
  supportedActivities: string[];
  dimensions: IResourceDimensions;
  environmentalControls: IEnvironmentalControls;
}

/**
 * Main resource interface with enhanced tracking capabilities
 */
export interface IResource {
  id: string;
  type: ResourceType;
  status: ResourceStatus;
  capacity: number;
  attributes: IResourceAttributes;
  spaceId: string;
  floorId: string;
  buildingId: string;
  createdAt: Date;
  updatedAt: Date;
  lastModifiedBy: string;
  availability: IResourceAvailability;
  costs: IResourceCosts;
}

/**
 * Interface for resource fetch options
 */
export interface IResourceFetchOptions {
  includeMetrics?: boolean;
  includeMaintenanceHistory?: boolean;
  includeReservations?: boolean;
  includeCustomFields?: boolean;
}

/**
 * Interface for resource search criteria
 */
export interface IResourceSearchCriteria {
  types?: ResourceType[];
  statuses?: ResourceStatus[];
  capacityRange?: { min: number; max: number };
  location?: { buildingId?: string; floorId?: string; spaceId?: string };
  features?: string[];
  availability?: { from: Date; to: Date };
  labels?: Record<string, string>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Interface for resource search results
 */
export interface IResourceSearchResult {
  items: IResource[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Interface for resource optimization criteria
 */
export interface IOptimizationCriteria {
  targetUtilization: number;
  costEfficiency: boolean;
  energyEfficiency: boolean;
  timeRange: { start: Date; end: Date };
}

/**
 * Interface for optimization results
 */
export interface IOptimizationResult {
  recommendations: Array<{
    resourceId: string;
    currentUtilization: number;
    recommendedChanges: string[];
    potentialSavings: number;
  }>;
  summary: {
    totalResources: number;
    underutilized: number;
    overutilized: number;
    potentialCostSavings: number;
  };
}

/**
 * Enhanced service interface for resource operations
 */
export interface IResourceService extends IBaseService {
  /**
   * Creates a new resource with validation
   */
  createResource(data: IResource): Promise<IResource>;

  /**
   * Updates an existing resource with change tracking
   */
  updateResource(id: string, data: Partial<IResource>): Promise<IResource>;

  /**
   * Retrieves a resource by ID with optional related data
   */
  getResource(id: string, options: IResourceFetchOptions): Promise<IResource>;

  /**
   * Advanced resource search with multiple criteria
   */
  searchResources(criteria: IResourceSearchCriteria): Promise<IResourceSearchResult>;

  /**
   * Optimizes resource allocation based on usage patterns
   */
  optimizeResources(criteria: IOptimizationCriteria): Promise<IOptimizationResult>;
}