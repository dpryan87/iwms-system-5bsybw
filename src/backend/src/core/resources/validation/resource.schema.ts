// @package joi v17.9.0
import Joi from 'joi';
import { ResourceType, ResourceStatus } from '../interfaces/resource.interface';

/**
 * Validation messages for resource-related operations
 * Provides detailed, user-friendly error messages for validation failures
 */
export const RESOURCE_VALIDATION_MESSAGES = {
  INVALID_TYPE: 'Invalid resource type. Must be one of: WORKSTATION, MEETING_ROOM, SHARED_SPACE, AMENITY',
  INVALID_STATUS: 'Invalid resource status. Must be one of: AVAILABLE, OCCUPIED, MAINTENANCE, RESERVED',
  INVALID_CAPACITY: 'Capacity must be a positive number between 1 and 1000',
  REQUIRED_SPACE: 'Valid space ID (UUID format) is required',
  INVALID_ATTRIBUTES: 'Invalid resource attributes. Please check the required fields for the resource type',
  INVALID_NAME: 'Resource name must be between 2 and 100 characters',
  INVALID_LOCATION: 'Location must contain only uppercase letters, numbers, and hyphens',
  INVALID_EQUIPMENT: 'Equipment list cannot exceed 50 items',
  INVALID_CUSTOM_FIELDS: 'Custom field names must contain only letters, numbers, and underscores',
  INVALID_MAINTENANCE: 'Invalid maintenance schedule format',
  INVALID_DIMENSIONS: 'Resource dimensions must be positive numbers',
  INVALID_ENVIRONMENTAL: 'Environmental control values must be within valid ranges',
  INVALID_ACCESSIBILITY: 'Accessibility features must be properly specified',
  INVALID_RESERVATION: 'Reservation constraints must be properly defined',
  INVALID_METRICS: 'Usage metrics must contain valid statistical data'
};

/**
 * Validation schema for resource dimensions
 */
export const dimensionsSchema = Joi.object({
  width: Joi.number().positive().required(),
  length: Joi.number().positive().required(),
  height: Joi.number().positive().optional(),
  area: Joi.number().positive().required()
}).required();

/**
 * Validation schema for environmental controls
 */
export const environmentalControlsSchema = Joi.object({
  temperature: Joi.number().min(15).max(30).optional(),
  lighting: Joi.number().min(0).max(100).optional(),
  ventilation: Joi.boolean().optional(),
  noiseLevel: Joi.number().min(0).max(100).optional()
});

/**
 * Validation schema for accessibility features
 */
export const accessibilitySchema = Joi.object({
  wheelchairAccessible: Joi.boolean().required(),
  hearingLoop: Joi.boolean().optional(),
  brailleSignage: Joi.boolean().optional(),
  adjustableHeight: Joi.boolean().optional(),
  proximityToBathroom: Joi.number().min(0).optional()
});

/**
 * Validation schema for reservation constraints
 */
export const reservationConstraintsSchema = Joi.object({
  minDuration: Joi.number().min(15).required(),
  maxDuration: Joi.number().min(Joi.ref('minDuration')).required(),
  advanceBookingLimit: Joi.number().min(0).required(),
  allowRecurring: Joi.boolean().required(),
  requiresApproval: Joi.boolean().required(),
  restrictedHours: Joi.object({
    start: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    end: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
  }).optional()
});

/**
 * Validation schema for maintenance schedule
 */
export const maintenanceScheduleSchema = Joi.object({
  lastMaintenance: Joi.date().iso().required(),
  nextScheduled: Joi.date().iso().greater(Joi.ref('lastMaintenance')).required(),
  maintenanceHistory: Joi.array().items(Joi.string()).required(),
  maintenanceProvider: Joi.string().required(),
  maintenanceNotes: Joi.object().pattern(/^[a-zA-Z0-9_]+$/, Joi.any()).optional()
});

/**
 * Validation schema for usage metrics
 */
export const usageMetricsSchema = Joi.object({
  utilizationRate: Joi.number().min(0).max(100).required(),
  averageOccupancyTime: Joi.number().min(0).required(),
  peakUsageTime: Joi.number().min(0).required(),
  popularTimeSlots: Joi.array().items(Joi.object({
    startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    utilization: Joi.number().min(0).max(100)
  })),
  usageStatistics: Joi.object().pattern(/^[a-zA-Z0-9_]+$/, Joi.number())
});

/**
 * Comprehensive validation schema for resource attributes
 */
export const resourceAttributesSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(2)
    .max(100)
    .trim()
    .messages({
      'string.empty': RESOURCE_VALIDATION_MESSAGES.INVALID_NAME,
      'string.min': RESOURCE_VALIDATION_MESSAGES.INVALID_NAME,
      'string.max': RESOURCE_VALIDATION_MESSAGES.INVALID_NAME
    }),

  description: Joi.string()
    .max(500)
    .trim()
    .allow('')
    .optional(),

  equipment: Joi.array()
    .items(Joi.string())
    .max(50)
    .messages({
      'array.max': RESOURCE_VALIDATION_MESSAGES.INVALID_EQUIPMENT
    }),

  location: Joi.string()
    .required()
    .pattern(/^[A-Z0-9-]+$/)
    .messages({
      'string.pattern.base': RESOURCE_VALIDATION_MESSAGES.INVALID_LOCATION
    }),

  customFields: Joi.object()
    .pattern(/^[a-zA-Z0-9_]+$/, Joi.any())
    .messages({
      'object.pattern.match': RESOURCE_VALIDATION_MESSAGES.INVALID_CUSTOM_FIELDS
    }),

  maintenanceSchedule: maintenanceScheduleSchema,
  usageMetrics: usageMetricsSchema,
  accessibility: accessibilitySchema,
  reservationRules: reservationConstraintsSchema,
  dimensions: dimensionsSchema,
  environmentalControls: environmentalControlsSchema,

  labels: Joi.object()
    .pattern(/^[a-zA-Z0-9_]+$/, Joi.string()),

  isBookable: Joi.boolean().required(),

  supportedActivities: Joi.array()
    .items(Joi.string())
    .min(1)
    .required()
});

/**
 * Main resource validation schema
 */
export const resourceSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(ResourceType))
    .required()
    .messages({
      'any.only': RESOURCE_VALIDATION_MESSAGES.INVALID_TYPE
    }),

  status: Joi.string()
    .valid(...Object.values(ResourceStatus))
    .required()
    .messages({
      'any.only': RESOURCE_VALIDATION_MESSAGES.INVALID_STATUS
    }),

  capacity: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'number.base': RESOURCE_VALIDATION_MESSAGES.INVALID_CAPACITY,
      'number.min': RESOURCE_VALIDATION_MESSAGES.INVALID_CAPACITY,
      'number.max': RESOURCE_VALIDATION_MESSAGES.INVALID_CAPACITY
    }),

  attributes: resourceAttributesSchema.required(),

  spaceId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': RESOURCE_VALIDATION_MESSAGES.REQUIRED_SPACE
    }),

  floorId: Joi.string()
    .uuid()
    .required(),

  buildingId: Joi.string()
    .uuid()
    .required()
});

/**
 * Validates resource attributes based on resource type with enhanced validation rules
 * @param attributes - Resource attributes to validate
 * @param type - Resource type
 * @returns Validation result with detailed error messages
 */
export const validateResourceAttributes = (
  attributes: Record<string, any>,
  type: ResourceType
): Joi.ValidationResult => {
  const schema = resourceAttributesSchema;
  
  // Add type-specific validation rules
  switch (type) {
    case ResourceType.MEETING_ROOM:
      schema.append({
        capacity: Joi.number().min(2).required(),
        equipment: Joi.array().min(1).required()
      });
      break;
    case ResourceType.WORKSTATION:
      schema.append({
        dimensions: dimensionsSchema.required(),
        environmentalControls: environmentalControlsSchema.required()
      });
      break;
    case ResourceType.SHARED_SPACE:
      schema.append({
        supportedActivities: Joi.array().min(2).required()
      });
      break;
    case ResourceType.AMENITY:
      schema.append({
        maintenanceSchedule: maintenanceScheduleSchema.required()
      });
      break;
  }

  return schema.validate(attributes, { abortEarly: false });
};