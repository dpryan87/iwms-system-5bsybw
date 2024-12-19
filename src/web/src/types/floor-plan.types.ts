// @ts-check
import { UUID } from 'crypto'; // version: latest

/**
 * Defines physical dimensions of a floor plan with support for multiple measurement systems
 * @interface Dimensions
 */
export interface Dimensions {
  /** Width in meters/feet with support for decimal precision */
  width: number;
  /** Height in meters/feet with support for decimal precision */
  height: number;
  /** Scale factor for rendering (1:N ratio) */
  scale: number;
  /** Unit system used (METRIC/IMPERIAL) */
  unit: MeasurementUnit;
}

/**
 * Enhanced 2D/3D coordinates for precise space positioning
 * @interface Coordinates
 */
export interface Coordinates {
  /** X coordinate in plan space */
  x: number;
  /** Y coordinate in plan space */
  y: number;
  /** Optional Z coordinate for 3D support */
  z: number | null;
}

/**
 * Comprehensive metadata about the floor plan including usage and tracking information
 * @interface FloorPlanMetadata
 */
export interface FloorPlanMetadata {
  /** Display name of the floor plan */
  name: string;
  /** Floor level number with support for sub-levels */
  level: number;
  /** Total floor area in specified unit system */
  totalArea: number;
  /** Net usable area excluding structural elements */
  usableArea: number;
  /** Physical dimensions with unit system */
  dimensions: Dimensions;
  /** URL to floor plan file in document storage */
  fileUrl: string;
  /** Last modification timestamp */
  lastModified: Date;
  /** Semantic version number */
  version: string;
  /** Extensible custom metadata fields */
  customFields: Record<string, unknown>;
}

/**
 * Resource definition within a space
 * @interface SpaceResource
 */
export interface SpaceResource {
  /** Unique identifier for the resource */
  id: UUID;
  /** Resource type identifier */
  type: string;
  /** Current status of the resource */
  status: string;
  /** Resource location coordinates */
  position: Coordinates;
}

/**
 * Comprehensive space definition within a floor plan
 * @interface FloorPlanSpace
 */
export interface FloorPlanSpace {
  /** Unique space identifier */
  id: UUID;
  /** Space name */
  name: string;
  /** Type of space */
  type: SpaceType;
  /** Boundary coordinates forming space polygon */
  coordinates: Coordinates[];
  /** Calculated area in specified unit system */
  area: number;
  /** Maximum occupancy based on regulations */
  capacity: number;
  /** Assigned business unit identifier */
  assignedBusinessUnit: string | null;
  /** Associated resources and assets */
  resources: SpaceResource[];
  /** Current occupancy status */
  occupancyStatus: OccupancyStatus;
}

/**
 * Main floor plan data structure with enhanced metadata and space management
 * @interface FloorPlan
 */
export interface FloorPlan {
  /** Unique identifier for the floor plan */
  id: UUID;
  /** Comprehensive floor plan metadata */
  metadata: FloorPlanMetadata;
  /** Collection of spaces within the floor plan */
  spaces: FloorPlanSpace[];
  /** Current status of the floor plan */
  status: FloorPlanStatus;
}

/**
 * Possible states of a floor plan
 * @enum {string}
 */
export enum FloorPlanStatus {
  DRAFT = 'DRAFT',
  REVIEW = 'REVIEW',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  DEPRECATED = 'DEPRECATED'
}

/**
 * Comprehensive list of space types
 * @enum {string}
 */
export enum SpaceType {
  OFFICE = 'OFFICE',
  MEETING_ROOM = 'MEETING_ROOM',
  COMMON_AREA = 'COMMON_AREA',
  STORAGE = 'STORAGE',
  FACILITY = 'FACILITY',
  RECEPTION = 'RECEPTION',
  BREAKOUT = 'BREAKOUT',
  UTILITY = 'UTILITY',
  OTHER = 'OTHER'
}

/**
 * Supported measurement systems
 * @enum {string}
 */
export enum MeasurementUnit {
  METRIC = 'METRIC',
  IMPERIAL = 'IMPERIAL'
}

/**
 * Space occupancy states
 * @enum {string}
 */
export enum OccupancyStatus {
  VACANT = 'VACANT',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  MAINTENANCE = 'MAINTENANCE'
}