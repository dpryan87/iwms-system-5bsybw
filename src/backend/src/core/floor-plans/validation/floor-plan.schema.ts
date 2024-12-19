// @package joi v17.9.0
import Joi from 'joi';
import { FloorPlanStatus } from '../interfaces/floor-plan.interface';

// Constants for validation rules
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB max file size
const SUPPORTED_FILE_FORMATS = ['.dwg', '.dxf', '.pdf'];
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const MAX_NAME_LENGTH = 255;
const MAX_CUSTOM_ATTRIBUTES = 50;

// Validation schema for floor plan dimensions
export const floorPlanDimensionsSchema = Joi.object({
  width: Joi.number()
    .positive()
    .max(10000)
    .required()
    .description('Width of the floor plan in specified units'),
  
  height: Joi.number()
    .positive()
    .max(10000)
    .required()
    .description('Height of the floor plan in specified units'),
  
  scale: Joi.number()
    .min(MIN_SCALE)
    .max(MAX_SCALE)
    .required()
    .description('Scale factor for rendering (e.g., 1:100)'),
  
  units: Joi.string()
    .valid('meters', 'feet')
    .required()
    .description('Measurement units for dimensions')
}).required();

// Validation schema for BMS integration configuration
export const bmsConfigSchema = Joi.object({
  systemId: Joi.string()
    .required()
    .description('Unique identifier for the BMS system'),
  
  sensorMappings: Joi.string()
    .required()
    .description('JSON mapping of sensors to floor plan coordinates'),
  
  enabled: Joi.boolean()
    .required()
    .description('Integration status flag'),
  
  config: Joi.object({
    endpoint: Joi.string()
      .uri()
      .required(),
    
    credentials: Joi.object({
      apiKey: Joi.string().required(),
      secret: Joi.string().optional()
    }).required(),
    
    refreshInterval: Joi.number()
      .positive()
      .required(),
    
    retryPolicy: Joi.object({
      attempts: Joi.number().integer().min(1).required(),
      backoff: Joi.number().positive().required()
    }).required()
  }).required()
});

// Validation schema for version information
export const versionInfoSchema = Joi.object({
  major: Joi.number().integer().min(0).required(),
  minor: Joi.number().integer().min(0).required(),
  revision: Joi.number().integer().min(0).required(),
  changelog: Joi.string().required(),
  previousVersion: Joi.string().optional(),
  isLatest: Joi.boolean().required()
});

// Validation schema for audit information
export const auditInfoSchema = Joi.object({
  createdAt: Joi.date().required(),
  createdBy: Joi.string().required(),
  updatedAt: Joi.date().required(),
  updatedBy: Joi.string().required(),
  reviewedAt: Joi.date().optional(),
  reviewedBy: Joi.string().optional(),
  comments: Joi.array().items(Joi.string()).default([])
});

// Validation schema for floor plan metadata
export const floorPlanMetadataSchema = Joi.object({
  name: Joi.string()
    .max(MAX_NAME_LENGTH)
    .required()
    .description('Floor plan name'),
  
  level: Joi.number()
    .integer()
    .required()
    .description('Floor level number'),
  
  totalArea: Joi.number()
    .positive()
    .required()
    .description('Total area in square meters'),
  
  dimensions: floorPlanDimensionsSchema,
  
  fileUrl: Joi.string()
    .uri()
    .required()
    .description('URL to floor plan file in storage'),
  
  fileHash: Joi.string()
    .required()
    .description('SHA-256 hash of the file for integrity'),
  
  bmsConfig: bmsConfigSchema,
  
  validationRules: Joi.object({
    minArea: Joi.number().positive().required(),
    maxArea: Joi.number().positive().greater(Joi.ref('minArea')).required(),
    requiredFields: Joi.array().items(Joi.string()).required(),
    customRules: Joi.object().pattern(Joi.string(), Joi.string())
  }),
  
  customAttributes: Joi.object()
    .max(MAX_CUSTOM_ATTRIBUTES)
    .pattern(
      Joi.string(),
      Joi.alternatives().try(
        Joi.string(),
        Joi.number(),
        Joi.boolean(),
        Joi.object()
      )
    )
    .description('Extensible custom attributes')
});

// Main floor plan validation schema
export const floorPlanSchema = Joi.object({
  id: Joi.string()
    .guid()
    .required()
    .description('Unique identifier'),
  
  propertyId: Joi.string()
    .guid()
    .required()
    .description('Reference to parent property'),
  
  version: Joi.string()
    .pattern(/^\d+\.\d+\.\d+$/)
    .required()
    .description('Semantic version string'),
  
  status: Joi.string()
    .valid(...Object.values(FloorPlanStatus))
    .required()
    .description('Floor plan status'),
  
  metadata: floorPlanMetadataSchema,
  versionInfo: versionInfoSchema,
  auditInfo: auditInfoSchema,
  
  createdAt: Joi.date().required(),
  updatedAt: Joi.date().required(),
  createdBy: Joi.string().required(),
  updatedBy: Joi.string().required()
});

// Helper function to validate floor plan dimensions
export const validateFloorPlanDimensions = async (dimensions: any): Promise<{
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}> => {
  try {
    await floorPlanDimensionsSchema.validateAsync(dimensions, { abortEarly: false });
    
    const warnings: string[] = [];
    
    // Check for unusual aspect ratios
    const aspectRatio = dimensions.width / dimensions.height;
    if (aspectRatio > 5 || aspectRatio < 0.2) {
      warnings.push('Unusual aspect ratio detected. Please verify dimensions.');
    }
    
    // Check for extreme scales
    if (dimensions.scale < 0.2 || dimensions.scale > 5) {
      warnings.push('Unusual scale factor. Please verify scale is appropriate.');
    }
    
    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    if (error.isJoi) {
      return {
        isValid: false,
        errors: error.details.map((detail: any) => detail.message)
      };
    }
    throw error;
  }
};

// Helper function to validate file integrity
export const validateFileIntegrity = async (fileMetadata: any): Promise<{
  isValid: boolean;
  errors?: string[];
}> => {
  const errors: string[] = [];
  
  // Validate file format
  const fileExtension = fileMetadata.fileUrl.toLowerCase().split('.').pop();
  if (!SUPPORTED_FILE_FORMATS.includes(`.${fileExtension}`)) {
    errors.push(`Unsupported file format. Supported formats: ${SUPPORTED_FILE_FORMATS.join(', ')}`);
  }
  
  // Validate file size
  if (fileMetadata.size > MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }
  
  // Validate file hash presence and format
  if (!fileMetadata.fileHash || !/^[a-f0-9]{64}$/i.test(fileMetadata.fileHash)) {
    errors.push('Invalid or missing file hash');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

export default {
  floorPlanSchema,
  floorPlanMetadataSchema,
  floorPlanDimensionsSchema,
  bmsConfigSchema,
  versionInfoSchema,
  auditInfoSchema,
  validateFloorPlanDimensions,
  validateFileIntegrity
};