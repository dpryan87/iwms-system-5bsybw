/**
 * @fileoverview Comprehensive validation schemas for IWMS API Gateway
 * Implements strict validation rules for all API endpoints with enhanced security and performance
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.9.0
import { validateSchema, ValidationError } from '../../common/utils/validation.util';

// Constants for validation patterns and limits
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_PATTERN = /^\+?[1-9]\d{1,14}$/;

const FILE_SIZE_LIMITS = {
  FLOOR_PLAN: '50MB',
  DOCUMENT: '15MB',
  IMAGE: '10MB'
} as const;

/**
 * Base validation schema class with common validation rules
 */
class BaseValidationSchema {
  protected readonly idSchema = Joi.string().pattern(UUID_PATTERN).required();
  protected readonly timestampSchema = Joi.date().iso().required();
  protected readonly metadataSchema = Joi.object({
    createdBy: Joi.string().pattern(UUID_PATTERN).required(),
    updatedBy: Joi.string().pattern(UUID_PATTERN).required(),
    version: Joi.number().integer().min(1).required()
  });

  protected readonly paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'name').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  });
}

/**
 * Floor Plan validation schemas
 */
export const floorPlanSchemas = {
  createFloorPlan: Joi.object({
    propertyId: Joi.string().pattern(UUID_PATTERN).required(),
    name: Joi.string().min(1).max(100).required(),
    level: Joi.number().integer().min(-5).max(200).required(),
    totalArea: Joi.number().positive().max(1000000).required(), // in square feet
    status: Joi.string().valid('draft', 'active', 'archived').required(),
    metadata: Joi.object({
      scale: Joi.string().required(),
      unit: Joi.string().valid('ft', 'm').required(),
      orientation: Joi.string().valid('north', 'south', 'east', 'west').required()
    }).required()
  }),

  updateFloorPlan: Joi.object({
    id: Joi.string().pattern(UUID_PATTERN).required(),
    name: Joi.string().min(1).max(100),
    status: Joi.string().valid('draft', 'active', 'archived'),
    metadata: Joi.object({
      scale: Joi.string(),
      unit: Joi.string().valid('ft', 'm'),
      orientation: Joi.string().valid('north', 'south', 'east', 'west')
    })
  }),

  uploadFloorPlanFile: Joi.object({
    file: Joi.object({
      size: Joi.number().max(parseInt(FILE_SIZE_LIMITS.FLOOR_PLAN)),
      mimetype: Joi.string().valid('application/pdf', 'image/png', 'application/vnd.autocad.dwg'),
      encoding: Joi.string().required()
    }).required()
  })
};

/**
 * Lease validation schemas
 */
export const leaseSchemas = {
  createLease: Joi.object({
    propertyId: Joi.string().pattern(UUID_PATTERN).required(),
    tenantId: Joi.string().pattern(UUID_PATTERN).required(),
    spaceIds: Joi.array().items(Joi.string().pattern(UUID_PATTERN)).min(1).required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
    terms: Joi.object({
      baseRent: Joi.number().positive().required(),
      rentCurrency: Joi.string().length(3).required(),
      paymentFrequency: Joi.string().valid('monthly', 'quarterly', 'annually').required(),
      escalationRate: Joi.number().min(0).max(100),
      securityDeposit: Joi.number().min(0)
    }).required(),
    documents: Joi.array().items(Joi.object({
      type: Joi.string().valid('lease', 'amendment', 'renewal').required(),
      url: Joi.string().uri().required(),
      version: Joi.number().integer().min(1).required()
    }))
  }),

  updateLease: Joi.object({
    id: Joi.string().pattern(UUID_PATTERN).required(),
    status: Joi.string().valid('active', 'terminated', 'expired'),
    terms: Joi.object({
      baseRent: Joi.number().positive(),
      escalationRate: Joi.number().min(0).max(100),
      securityDeposit: Joi.number().min(0)
    })
  }),

  validateFinancials: Joi.object({
    baseRent: Joi.number().positive().required(),
    totalArea: Joi.number().positive().required(),
    rentPerSqFt: Joi.number().positive().required(),
    annualIncrease: Joi.number().min(0).max(100).required()
  })
};

/**
 * Occupancy validation schemas
 */
export const occupancySchemas = {
  createOccupancyRecord: Joi.object({
    spaceId: Joi.string().pattern(UUID_PATTERN).required(),
    timestamp: Joi.date().iso().required(),
    count: Joi.number().integer().min(0).required(),
    source: Joi.string().valid('sensor', 'manual', 'estimated').required(),
    confidence: Joi.number().min(0).max(100).when('source', {
      is: 'sensor',
      then: Joi.required()
    })
  }),

  updateOccupancyRecord: Joi.object({
    id: Joi.string().pattern(UUID_PATTERN).required(),
    count: Joi.number().integer().min(0),
    source: Joi.string().valid('manual', 'estimated'),
    notes: Joi.string().max(500)
  }),

  validateThresholds: Joi.object({
    spaceId: Joi.string().pattern(UUID_PATTERN).required(),
    capacity: Joi.number().integer().positive().required(),
    warningThreshold: Joi.number().min(0).max(100).required(),
    criticalThreshold: Joi.number().min(0).max(100).greater(Joi.ref('warningThreshold')).required()
  })
};

/**
 * Resource validation schemas
 */
export const resourceSchemas = {
  createResource: Joi.object({
    spaceId: Joi.string().pattern(UUID_PATTERN).required(),
    type: Joi.string().valid('desk', 'meeting_room', 'phone_booth', 'common_area').required(),
    name: Joi.string().min(1).max(100).required(),
    capacity: Joi.number().integer().positive().required(),
    attributes: Joi.object({
      equipment: Joi.array().items(Joi.string()),
      accessibility: Joi.boolean(),
      videoConference: Joi.boolean(),
      windowAccess: Joi.boolean()
    }).required(),
    availability: Joi.object({
      schedule: Joi.array().items(Joi.object({
        dayOfWeek: Joi.number().min(0).max(6).required(),
        startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required()
      })),
      bookable: Joi.boolean().required()
    }).required()
  }),

  updateResource: Joi.object({
    id: Joi.string().pattern(UUID_PATTERN).required(),
    name: Joi.string().min(1).max(100),
    capacity: Joi.number().integer().positive(),
    status: Joi.string().valid('available', 'maintenance', 'reserved', 'inactive'),
    attributes: Joi.object({
      equipment: Joi.array().items(Joi.string()),
      accessibility: Joi.boolean(),
      videoConference: Joi.boolean(),
      windowAccess: Joi.boolean()
    })
  }),

  validateCapacity: Joi.object({
    resourceType: Joi.string().valid('desk', 'meeting_room', 'phone_booth', 'common_area').required(),
    capacity: Joi.number().integer().positive().required(),
    area: Joi.number().positive().required(),
    occupantsPerArea: Joi.number().positive().required()
  })
};

/**
 * Enhanced request schema validation with performance monitoring
 */
export async function validateRequestSchema(data: unknown, schema: Joi.ObjectSchema, options = {}) {
  return validateSchema(data, schema, {
    abortEarly: false,
    stripUnknown: true,
    ...options
  });
}