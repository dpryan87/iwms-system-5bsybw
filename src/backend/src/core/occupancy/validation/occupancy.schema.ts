/**
 * @fileoverview Validation schemas for occupancy data structures using Joi
 * @version 1.0.0
 * @package @core/occupancy/validation
 */

import Joi from 'joi'; // v17.9.0
import { IOccupancyData } from '../interfaces/occupancy.interface';

/**
 * Validation schema for sensor metadata
 */
const sensorMetadataSchema = Joi.object({
  sensorId: Joi.string().required()
    .messages({
      'string.empty': 'Sensor ID is required',
      'any.required': 'Sensor ID must be provided'
    }),
  sensorType: Joi.string().required(),
  accuracy: Joi.number().min(0).max(100).required(),
  lastCalibration: Joi.date().iso().required(),
  manufacturer: Joi.string().required(),
  firmwareVersion: Joi.string().required(),
  batteryLevel: Joi.number().min(0).max(100).optional(),
  connectionStatus: Joi.string().valid('online', 'offline', 'degraded').required()
});

/**
 * Validation schema for trend metadata
 */
const trendMetadataSchema = Joi.object({
  confidenceLevel: Joi.number().min(0).max(100).required(),
  dataQuality: Joi.string().valid('high', 'medium', 'low').required(),
  samplingRate: Joi.string().required(),
  analysisMethod: Joi.string().required(),
  seasonalityAdjusted: Joi.boolean().required(),
  outlierFiltered: Joi.boolean().required()
});

/**
 * Core validation schema for occupancy data points
 */
export const occupancyDataSchema = Joi.object<IOccupancyData>({
  spaceId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Space ID must be a valid UUID',
      'any.required': 'Space ID is required'
    }),
  timestamp: Joi.date().iso().required()
    .messages({
      'date.base': 'Timestamp must be a valid date',
      'date.format': 'Timestamp must be in ISO format'
    }),
  occupantCount: Joi.number().integer().min(0).max(10000).required()
    .messages({
      'number.base': 'Occupant count must be a number',
      'number.min': 'Occupant count cannot be negative',
      'number.max': 'Occupant count exceeds maximum allowed value'
    }),
  capacity: Joi.number().integer().min(1).max(10000).required()
    .messages({
      'number.base': 'Capacity must be a number',
      'number.min': 'Capacity must be at least 1',
      'number.max': 'Capacity exceeds maximum allowed value'
    }),
  utilizationRate: Joi.number().min(0).max(100).precision(2).required()
    .messages({
      'number.base': 'Utilization rate must be a number',
      'number.min': 'Utilization rate cannot be negative',
      'number.max': 'Utilization rate cannot exceed 100%'
    }),
  sensorMetadata: sensorMetadataSchema.required(),
  dataSource: Joi.string().valid('sensor', 'manual', 'system').required(),
  isValidated: Joi.boolean().required()
}).custom((value, helpers) => {
  // Custom validation to ensure utilization rate matches occupantCount/capacity
  const calculatedRate = (value.occupantCount / value.capacity) * 100;
  if (Math.abs(calculatedRate - value.utilizationRate) > 0.01) {
    return helpers.error('custom.utilizationRate', {
      message: 'Utilization rate must match occupantCount/capacity calculation'
    });
  }
  return value;
});

/**
 * Validation schema for occupancy trend analysis
 */
export const occupancyTrendSchema = Joi.object({
  spaceId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Space ID must be a valid UUID'
    }),
  timeRange: Joi.object({
    start: Joi.date().iso().required(),
    end: Joi.date().iso().greater(Joi.ref('start')).max('now').required()
  }).required()
    .messages({
      'date.greater': 'End date must be after start date',
      'date.max': 'End date cannot be in the future'
    }),
  averageUtilization: Joi.number().min(0).max(100).precision(2).required(),
  peakOccupancy: Joi.number().integer().min(0).required(),
  dataPoints: Joi.array().items(occupancyDataSchema).max(1000).required()
    .messages({
      'array.max': 'Maximum 1000 data points allowed'
    }),
  dataInterval: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly').required(),
  trendMetadata: trendMetadataSchema.required(),
  anomalies: Joi.array().items(Joi.object({
    timestamp: Joi.date().iso().required(),
    expectedValue: Joi.number().required(),
    actualValue: Joi.number().required(),
    deviation: Joi.number().required(),
    severity: Joi.string().valid('low', 'medium', 'high').required(),
    description: Joi.string().required()
  })).required()
});

/**
 * Validation schema for real-time occupancy updates
 */
export const occupancyUpdateSchema = Joi.object({
  spaceId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Space ID must be a valid UUID'
    }),
  occupantCount: Joi.number().integer().min(0).max(10000).required()
    .messages({
      'number.min': 'Occupant count cannot be negative',
      'number.max': 'Occupant count exceeds maximum allowed value'
    }),
  timestamp: Joi.date().iso().default(Date.now)
    .messages({
      'date.format': 'Timestamp must be in ISO format'
    }),
  source: Joi.string().valid('sensor', 'manual', 'system').default('sensor'),
  confidence: Joi.number().min(0).max(100).default(100),
  sensorMetadata: sensorMetadataSchema.optional()
});

/**
 * Validates occupancy data against the schema with detailed error reporting
 * @param data - Occupancy data to validate
 * @returns Promise with validation result and any errors
 */
export async function validateOccupancyData(data: IOccupancyData): Promise<{
  isValid: boolean;
  errors?: string[];
  details?: any;
}> {
  try {
    const validationResult = await occupancyDataSchema.validateAsync(data, {
      abortEarly: false,
      stripUnknown: true
    });

    return {
      isValid: true,
      details: validationResult
    };
  } catch (error) {
    if (error instanceof Joi.ValidationError) {
      return {
        isValid: false,
        errors: error.details.map(detail => detail.message),
        details: error.details
      };
    }
    
    throw error;
  }
}