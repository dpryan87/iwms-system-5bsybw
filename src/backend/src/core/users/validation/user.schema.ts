/**
 * @fileoverview User validation schemas with enhanced security rules
 * Implements comprehensive validation for user-related operations
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.9.0
import { UserRole } from '../interfaces/user.interface';
import { validateEmail } from '../../../common/utils/validation.util';

// Security-focused validation constants
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 32;
const NAME_MAX_LENGTH = 50;

// Enhanced password pattern requiring mixed case, numbers and special characters
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;

/**
 * Comprehensive validation schema for new user creation
 * Implements strict security rules and data validation
 */
export const createUserSchema = Joi.object({
  email: Joi.string()
    .required()
    .email()
    .custom(validateEmail)
    .trim()
    .lowercase()
    .description('User email address - must be unique and valid format'),

  password: Joi.string()
    .required()
    .min(PASSWORD_MIN_LENGTH)
    .max(PASSWORD_MAX_LENGTH)
    .pattern(PASSWORD_PATTERN)
    .description('Password with minimum security requirements'),

  firstName: Joi.string()
    .required()
    .max(NAME_MAX_LENGTH)
    .pattern(/^[a-zA-Z\s-]+$/)
    .trim()
    .description('User first name - letters, spaces and hyphens only'),

  lastName: Joi.string()
    .required()
    .max(NAME_MAX_LENGTH)
    .pattern(/^[a-zA-Z\s-]+$/)
    .trim()
    .description('User last name - letters, spaces and hyphens only'),

  role: Joi.string()
    .required()
    .valid(...Object.values(UserRole))
    .description('User role from predefined RBAC roles'),

  department: Joi.string()
    .optional()
    .max(100)
    .trim()
    .description('Optional department assignment'),

  businessUnit: Joi.string()
    .optional()
    .max(100)
    .trim()
    .description('Optional business unit assignment'),

  employeeId: Joi.string()
    .optional()
    .max(50)
    .pattern(/^[A-Z0-9-]+$/)
    .description('Optional employee ID in uppercase with numbers'),

  preferredLanguage: Joi.string()
    .optional()
    .default('en')
    .pattern(/^[a-z]{2}(-[A-Z]{2})?$/)
    .description('Language preference in ISO format'),

  timezone: Joi.string()
    .optional()
    .default('UTC')
    .pattern(/^[A-Za-z_\/]+$/)
    .description('User timezone in IANA format'),

  securityPreferences: Joi.object({
    mfaEnabled: Joi.boolean().default(false),
    mfaMethod: Joi.string().valid('APP', 'SMS', 'EMAIL').optional(),
    passwordExpiryDays: Joi.number().integer().min(30).max(180).default(90),
    loginNotifications: Joi.boolean().default(true),
    allowedIPs: Joi.array().items(Joi.string().ip()).optional()
  }).optional()
}).options({ stripUnknown: true, abortEarly: false });

/**
 * Flexible validation schema for user updates
 * Allows partial updates while maintaining data integrity
 */
export const updateUserSchema = Joi.object({
  email: Joi.string()
    .email()
    .custom(validateEmail)
    .trim()
    .lowercase()
    .optional()
    .description('Updated email address if changing'),

  firstName: Joi.string()
    .max(NAME_MAX_LENGTH)
    .pattern(/^[a-zA-Z\s-]+$/)
    .trim()
    .optional()
    .description('Updated first name'),

  lastName: Joi.string()
    .max(NAME_MAX_LENGTH)
    .pattern(/^[a-zA-Z\s-]+$/)
    .trim()
    .optional()
    .description('Updated last name'),

  role: Joi.string()
    .valid(...Object.values(UserRole))
    .optional()
    .description('Updated user role'),

  department: Joi.string()
    .max(100)
    .trim()
    .optional()
    .description('Updated department'),

  businessUnit: Joi.string()
    .max(100)
    .trim()
    .optional()
    .description('Updated business unit'),

  preferredLanguage: Joi.string()
    .pattern(/^[a-z]{2}(-[A-Z]{2})?$/)
    .optional()
    .description('Updated language preference'),

  timezone: Joi.string()
    .pattern(/^[A-Za-z_\/]+$/)
    .optional()
    .description('Updated timezone'),

  isActive: Joi.boolean()
    .optional()
    .description('Account status flag'),

  securityPreferences: Joi.object({
    mfaEnabled: Joi.boolean().optional(),
    mfaMethod: Joi.string().valid('APP', 'SMS', 'EMAIL').optional(),
    passwordExpiryDays: Joi.number().integer().min(30).max(180).optional(),
    loginNotifications: Joi.boolean().optional(),
    allowedIPs: Joi.array().items(Joi.string().ip()).optional()
  }).optional()
}).min(1).options({ stripUnknown: true, abortEarly: false });

/**
 * Security-focused validation schema for user authentication
 * Implements strict validation for login credentials
 */
export const loginSchema = Joi.object({
  email: Joi.string()
    .required()
    .email()
    .custom(validateEmail)
    .trim()
    .lowercase()
    .description('Login email address'),

  password: Joi.string()
    .required()
    .min(PASSWORD_MIN_LENGTH)
    .max(PASSWORD_MAX_LENGTH)
    .description('Login password'),

  mfaCode: Joi.string()
    .length(6)
    .pattern(/^\d+$/)
    .optional()
    .description('Optional MFA verification code'),

  rememberMe: Joi.boolean()
    .default(false)
    .description('Extended session flag')
}).options({ stripUnknown: true, abortEarly: false });