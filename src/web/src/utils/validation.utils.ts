// @package yup ^1.2.0 - Schema validation library
// @package validator ^13.9.0 - String validation and sanitization

import * as yup from 'yup';
import validator from 'validator';
import { ApiResponse } from '../types/api.types';
import { FloorPlan, SpaceType, MeasurementUnit } from '../types/floor-plan.types';
import { ILease, LeaseStatus } from '../types/lease.types';

/**
 * Enhanced email validation with domain checking and security considerations
 * @param email - Email address to validate
 * @returns Boolean indicating if email is valid
 */
export const validateEmail = (email: string): boolean => {
  const sanitizedEmail = validator.trim(email).toLowerCase();
  return validator.isEmail(sanitizedEmail, {
    allow_utf8_local_part: false,
    require_tld: true,
    allow_ip_domain: false
  });
};

/**
 * Comprehensive password validation implementing security best practices
 * @param password - Password to validate
 * @returns Validation result with any error messages
 */
export const validatePassword = (password: string): { 
  isValid: boolean; 
  errors: string[] 
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Floor plan validation schema using yup
 */
const floorPlanSchema = yup.object().shape({
  metadata: yup.object().shape({
    name: yup.string().required('Floor plan name is required'),
    level: yup.number().required('Floor level is required'),
    totalArea: yup.number().positive('Total area must be positive'),
    usableArea: yup.number()
      .positive('Usable area must be positive')
      .max(yup.ref('totalArea'), 'Usable area cannot exceed total area'),
    dimensions: yup.object().shape({
      width: yup.number().positive('Width must be positive'),
      height: yup.number().positive('Height must be positive'),
      scale: yup.number().positive('Scale must be positive'),
      unit: yup.string().oneOf(Object.values(MeasurementUnit))
    })
  }),
  spaces: yup.array().of(
    yup.object().shape({
      name: yup.string().required('Space name is required'),
      type: yup.string().oneOf(Object.values(SpaceType)),
      area: yup.number().positive('Space area must be positive'),
      capacity: yup.number().integer().min(0)
    })
  )
});

/**
 * Enhanced floor plan validation with comprehensive checks
 * @param floorPlan - Floor plan data to validate
 * @returns Promise resolving to validation result
 */
export const validateFloorPlan = async (
  floorPlan: FloorPlan
): Promise<ApiResponse<boolean>> => {
  try {
    await floorPlanSchema.validate(floorPlan, { abortEarly: false });
    
    // Additional validation logic
    const totalSpaceArea = floorPlan.spaces.reduce((sum, space) => sum + space.area, 0);
    if (Math.abs(totalSpaceArea - floorPlan.metadata.usableArea) > 0.1) {
      return {
        success: false,
        data: false,
        message: 'Total space area does not match usable area',
        errors: ['Space allocation mismatch'],
        timestamp: Date.now()
      };
    }

    return {
      success: true,
      data: true,
      message: 'Floor plan validation successful',
      errors: [],
      timestamp: Date.now()
    };
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return {
        success: false,
        data: false,
        message: 'Floor plan validation failed',
        errors: error.errors,
        timestamp: Date.now()
      };
    }
    throw error;
  }
};

/**
 * Lease terms validation schema
 */
const leaseTermsSchema = yup.object().shape({
  monthlyRent: yup.number().positive('Monthly rent must be positive'),
  startDate: yup.date().required('Start date is required'),
  endDate: yup.date()
    .required('End date is required')
    .min(yup.ref('startDate'), 'End date must be after start date'),
  status: yup.string().oneOf(Object.values(LeaseStatus)),
  terms: yup.object().shape({
    securityDeposit: yup.number().min(0),
    noticePeriod: yup.number().positive(),
    renewalOptions: yup.object().shape({
      available: yup.boolean(),
      terms: yup.number().when('available', {
        is: true,
        then: yup.number().required('Renewal terms required when available')
      })
    })
  })
});

/**
 * Enhanced lease validation with comprehensive checks
 * @param lease - Lease data to validate
 * @returns Promise resolving to validation result
 */
export const validateLeaseTerms = async (
  lease: ILease
): Promise<ApiResponse<boolean>> => {
  try {
    await leaseTermsSchema.validate(lease, { abortEarly: false });

    // Additional validation logic
    const today = new Date();
    if (lease.status === LeaseStatus.ACTIVE && lease.endDate < today) {
      return {
        success: false,
        data: false,
        message: 'Active lease cannot have past end date',
        errors: ['Invalid lease status'],
        timestamp: Date.now()
      };
    }

    return {
      success: true,
      data: true,
      message: 'Lease validation successful',
      errors: [],
      timestamp: Date.now()
    };
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return {
        success: false,
        data: false,
        message: 'Lease validation failed',
        errors: error.errors,
        timestamp: Date.now()
      };
    }
    throw error;
  }
};

/**
 * Validates and sanitizes user input to prevent XSS attacks
 * @param input - User input to sanitize
 * @returns Sanitized input string
 */
export const sanitizeInput = (input: string): string => {
  return validator.escape(validator.trim(input));
};

/**
 * Validates coordinates within specified boundaries
 * @param coordinates - Coordinates to validate
 * @param bounds - Boundary limits
 * @returns Promise resolving to validation result
 */
export const validateCoordinates = async (
  coordinates: { x: number; y: number; z?: number },
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ?: number; maxZ?: number }
): Promise<ApiResponse<boolean>> => {
  const errors: string[] = [];

  if (coordinates.x < bounds.minX || coordinates.x > bounds.maxX) {
    errors.push('X coordinate out of bounds');
  }
  if (coordinates.y < bounds.minY || coordinates.y > bounds.maxY) {
    errors.push('Y coordinate out of bounds');
  }
  if (coordinates.z !== undefined && bounds.minZ !== undefined && bounds.maxZ !== undefined) {
    if (coordinates.z < bounds.minZ || coordinates.z > bounds.maxZ) {
      errors.push('Z coordinate out of bounds');
    }
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0,
    message: errors.length === 0 ? 'Coordinates valid' : 'Invalid coordinates',
    errors,
    timestamp: Date.now()
  };
};

/**
 * Validates business unit assignment and capacity
 * @param businessUnit - Business unit data
 * @param spaceAllocation - Space allocation data
 * @returns Promise resolving to validation result
 */
export const validateBusinessUnit = async (
  businessUnit: { id: string; capacity: number },
  spaceAllocation: { area: number; occupants: number }
): Promise<ApiResponse<boolean>> => {
  const errors: string[] = [];

  if (spaceAllocation.occupants > businessUnit.capacity) {
    errors.push('Allocated occupants exceed business unit capacity');
  }

  // Standard office space requirement (10 sq meters per person)
  const minRequiredArea = spaceAllocation.occupants * 10;
  if (spaceAllocation.area < minRequiredArea) {
    errors.push('Allocated space insufficient for occupant count');
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0,
    message: errors.length === 0 ? 'Business unit allocation valid' : 'Invalid allocation',
    errors,
    timestamp: Date.now()
  };
};