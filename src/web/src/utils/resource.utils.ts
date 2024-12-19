// date-fns version ^2.30.0 - Date formatting utilities
import { format } from 'date-fns';

// Internal imports
import { Resource, ResourceType, ResourceStatus } from '../types/resource.types';
import { validateRequired } from './validation.utils';

/**
 * Interface for validation result with detailed error reporting
 */
interface ValidationResult {
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
 * WCAG 2.1 compliant color codes for resource status visualization
 * Ensures minimum contrast ratio of 4.5:1 for normal text
 */
const STATUS_COLORS = {
  AVAILABLE: '#4CAF50',  // Green with sufficient contrast
  OCCUPIED: '#F44336',   // Red with sufficient contrast
  MAINTENANCE: '#FFC107', // Amber with sufficient contrast
  RESERVED: '#2196F3',   // Blue with sufficient contrast
  OUT_OF_SERVICE: '#757575', // Grey with sufficient contrast
  CLEANING: '#9C27B0'    // Purple with sufficient contrast
} as const;

/**
 * Material Design icon mappings for resource types
 * Ensures consistent visual representation across the application
 */
const TYPE_ICONS = {
  WORKSTATION: 'desktop_windows',
  MEETING_ROOM: 'meeting_room',
  SHARED_SPACE: 'group_work',
  AMENITY: 'local_cafe',
  PHONE_BOOTH: 'phone',
  COLLABORATION_AREA: 'groups',
  STORAGE: 'inventory',
  PARKING: 'local_parking'
} as const;

/**
 * Validates resource data with comprehensive error checking and type safety
 * @param resource - Resource object to validate
 * @returns Detailed validation result with status, errors, and warnings
 */
export const validateResource = (resource: Resource): ValidationResult => {
  const errors: ValidationResult['errors'] = [];
  const warnings: ValidationResult['warnings'] = [];

  // Required field validation
  const requiredFields = ['id', 'type', 'status', 'spaceId'];
  requiredFields.forEach(field => {
    if (!validateRequired(resource[field as keyof Resource])) {
      errors.push({
        field,
        message: `${field} is required`,
        code: 'REQUIRED_FIELD_MISSING'
      });
    }
  });

  // Type validation
  if (resource.type && !Object.values(ResourceType).includes(resource.type)) {
    errors.push({
      field: 'type',
      message: `Invalid resource type: ${resource.type}`,
      code: 'INVALID_RESOURCE_TYPE'
    });
  }

  // Status validation
  if (resource.status && !Object.values(ResourceStatus).includes(resource.status)) {
    errors.push({
      field: 'status',
      message: `Invalid resource status: ${resource.status}`,
      code: 'INVALID_RESOURCE_STATUS'
    });
  }

  // Capacity validation
  if (resource.capacity !== undefined) {
    if (resource.capacity < 0) {
      errors.push({
        field: 'capacity',
        message: 'Capacity cannot be negative',
        code: 'INVALID_CAPACITY'
      });
    } else if (resource.capacity === 0) {
      warnings.push({
        field: 'capacity',
        message: 'Resource has zero capacity',
        code: 'ZERO_CAPACITY'
      });
    }
  }

  // Attributes validation
  if (resource.attributes) {
    if (!resource.attributes.name) {
      errors.push({
        field: 'attributes.name',
        message: 'Resource name is required',
        code: 'MISSING_RESOURCE_NAME'
      });
    }
    
    if (resource.attributes.equipment && !Array.isArray(resource.attributes.equipment)) {
      errors.push({
        field: 'attributes.equipment',
        message: 'Equipment must be an array',
        code: 'INVALID_EQUIPMENT_FORMAT'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Formats resource dates with localization and timezone support
 * @param date - Date to format
 * @param locale - Optional locale string (defaults to 'en-US')
 * @returns Formatted date string
 */
export const formatResourceDate = (date: Date, locale: string = 'en-US'): string => {
  try {
    return format(date, 'PPpp', { locale });
  } catch (error) {
    console.error('Error formatting resource date:', error);
    return date.toISOString(); // Fallback to ISO format
  }
};

/**
 * Returns WCAG-compliant color code for resource status visualization
 * @param status - Resource status
 * @returns Accessible color code for status
 */
export const getResourceStatusColor = (status: ResourceStatus): string => {
  const color = STATUS_COLORS[status];
  if (!color) {
    console.warn(`No color defined for status: ${status}`);
    return STATUS_COLORS.OUT_OF_SERVICE; // Fallback color
  }
  return color;
};

/**
 * Returns consistent icon mapping for resource types with accessibility support
 * @param type - Resource type
 * @returns Material icon name for resource type
 */
export const getResourceTypeIcon = (type: ResourceType): string => {
  const icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS];
  if (!icon) {
    console.warn(`No icon defined for type: ${type}`);
    return 'help_outline'; // Fallback icon
  }
  return icon;
};

/**
 * Formats resource capacity for display with accessibility considerations
 * @param capacity - Resource capacity number
 * @returns Formatted capacity string with accessibility enhancements
 */
export const formatResourceCapacity = (capacity: number): string => {
  if (capacity === 0) {
    return 'Not applicable';
  }
  return `Capacity: ${capacity} ${capacity === 1 ? 'person' : 'people'}`;
};

/**
 * Generates an accessibility description for a resource
 * @param resource - Resource object
 * @returns Accessible description string
 */
export const getResourceAccessibilityDescription = (resource: Resource): string => {
  const status = resource.status.toLowerCase().replace('_', ' ');
  const type = resource.type.toLowerCase().replace('_', ' ');
  const capacity = resource.capacity || 0;
  
  return `${type} - ${status}, ${formatResourceCapacity(capacity)}. ${
    resource.attributes?.description || ''
  }`.trim();
};