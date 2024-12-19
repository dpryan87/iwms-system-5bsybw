// axios version ^1.4.0
import { AxiosResponse } from 'axios';

/**
 * Enumeration of all available resource types in the workplace management system.
 * Used for categorizing different types of workplace resources.
 */
export enum ResourceType {
    WORKSTATION = 'WORKSTATION',
    MEETING_ROOM = 'MEETING_ROOM',
    SHARED_SPACE = 'SHARED_SPACE',
    AMENITY = 'AMENITY'
}

/**
 * Enumeration of possible resource status states.
 * Used for tracking the current availability and state of resources.
 */
export enum ResourceStatus {
    AVAILABLE = 'AVAILABLE',
    OCCUPIED = 'OCCUPIED',
    MAINTENANCE = 'MAINTENANCE',
    RESERVED = 'RESERVED'
}

/**
 * Interface defining detailed attributes and metadata for resources.
 * Supports extensibility through custom fields for specific resource requirements.
 */
export interface ResourceAttributes {
    /** Display name of the resource */
    name: string;
    
    /** Detailed description of the resource */
    description: string;
    
    /** List of equipment/amenities associated with the resource */
    equipment: string[];
    
    /** Physical location identifier or description */
    location: string;
    
    /** Extensible custom fields for additional resource properties */
    customFields: Record<string, any>;
}

/**
 * Core interface defining the complete structure of a workplace resource.
 * Represents any bookable or manageable resource within the workplace.
 */
export interface Resource {
    /** Unique identifier for the resource */
    id: string;
    
    /** Type categorization of the resource */
    type: ResourceType;
    
    /** Current status of the resource */
    status: ResourceStatus;
    
    /** Maximum capacity of the resource (e.g., number of people) */
    capacity: number;
    
    /** Detailed attributes and metadata */
    attributes: ResourceAttributes;
    
    /** Reference to the space containing this resource */
    spaceId: string;
    
    /** Resource creation timestamp */
    createdAt: Date;
    
    /** Last update timestamp */
    updatedAt: Date;
}

/**
 * Type definition for API responses containing a single resource.
 * Wraps the resource data in a standardized response structure.
 */
export type ResourceResponse = AxiosResponse<{
    data: Resource;
}>;

/**
 * Type definition for API responses containing multiple resources.
 * Wraps the resource array in a standardized response structure.
 */
export type ResourceListResponse = AxiosResponse<{
    data: Resource[];
}>;