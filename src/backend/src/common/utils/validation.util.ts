/**
 * @fileoverview Comprehensive validation utility module for the IWMS application
 * Provides enhanced validation functions with security features and performance optimizations
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.9.0
import validator from 'validator'; // v13.9.0
import { ErrorCodes } from '../constants/error-codes';
import { VALIDATION_MESSAGES } from '../constants/messages';

/**
 * Performance metrics for validation operations
 */
interface ValidationPerformanceMetrics {
  startTime: number;
  endTime: number;
  memoryUsage: number;
  validationDuration: number;
}

/**
 * Context information for validation operations
 */
interface ValidationContext {
  source: string;
  timestamp: number;
  validationType: string;
  inputSize: number;
}

/**
 * Options for input sanitization
 */
interface SanitizationOptions {
  maxLength?: number;
  allowHtml?: boolean;
  allowSpecialChars?: boolean;
  preserveFormatting?: boolean;
  context?: string;
}

/**
 * Enhanced error class for validation failures with detailed tracking
 */
@ErrorTracking
export class ValidationError extends Error {
  public readonly code: number;
  public readonly errors: string[];
  public readonly context: ValidationContext;
  public readonly metrics: ValidationPerformanceMetrics;

  constructor(
    message: string,
    errors: string[],
    context: ValidationContext
  ) {
    super(message);
    this.name = 'ValidationError';
    this.code = ErrorCodes.VALIDATION_ERROR;
    this.errors = errors;
    this.context = context;
    this.metrics = this.initializeMetrics();
    this.logError();
  }

  private initializeMetrics(): ValidationPerformanceMetrics {
    return {
      startTime: Date.now(),
      endTime: 0,
      memoryUsage: process.memoryUsage().heapUsed,
      validationDuration: 0
    };
  }

  private logError(): void {
    // Log error details for monitoring
    console.error({
      type: 'ValidationError',
      message: this.message,
      errors: this.errors,
      context: this.context,
      metrics: this.metrics,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Validates data against a Joi schema with performance optimization
 * @param data - Data to validate
 * @param schema - Joi validation schema
 * @param options - Optional validation options
 */
export async function validateSchema(
  data: unknown,
  schema: Joi.Schema,
  options: Joi.ValidationOptions = {}
): Promise<{
  isValid: boolean;
  errors?: string[];
  performance?: ValidationPerformanceMetrics;
}> {
  const metrics: ValidationPerformanceMetrics = {
    startTime: Date.now(),
    endTime: 0,
    memoryUsage: process.memoryUsage().heapUsed,
    validationDuration: 0
  };

  try {
    // Apply chunking for large payloads
    const dataSize = JSON.stringify(data).length;
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

    if (dataSize > CHUNK_SIZE) {
      return await validateLargePayload(data, schema, options, metrics);
    }

    const validationResult = await schema.validateAsync(data, {
      abortEarly: false,
      ...options
    });

    metrics.endTime = Date.now();
    metrics.validationDuration = metrics.endTime - metrics.startTime;

    return {
      isValid: !validationResult.error,
      errors: validationResult.error?.details.map(detail => detail.message),
      performance: metrics
    };

  } catch (error) {
    metrics.endTime = Date.now();
    metrics.validationDuration = metrics.endTime - metrics.startTime;

    const context: ValidationContext = {
      source: 'schema_validation',
      timestamp: Date.now(),
      validationType: schema.type,
      inputSize: JSON.stringify(data).length
    };

    throw new ValidationError(
      VALIDATION_MESSAGES.INVALID_FORMAT,
      error.details?.map(detail => detail.message) || [error.message],
      context
    );
  }
}

/**
 * Handles validation for large payloads using chunking
 * @private
 */
async function validateLargePayload(
  data: unknown,
  schema: Joi.Schema,
  options: Joi.ValidationOptions,
  metrics: ValidationPerformanceMetrics
): Promise<{
  isValid: boolean;
  errors?: string[];
  performance?: ValidationPerformanceMetrics;
}> {
  const chunks = chunkData(data);
  const errors: string[] = [];

  for (const chunk of chunks) {
    try {
      await schema.validateAsync(chunk, {
        abortEarly: false,
        ...options
      });
    } catch (error) {
      errors.push(...error.details.map(detail => detail.message));
    }
  }

  metrics.endTime = Date.now();
  metrics.validationDuration = metrics.endTime - metrics.startTime;

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    performance: metrics
  };
}

/**
 * Enhanced input sanitization with comprehensive security features
 * @param input - Input string to sanitize
 * @param options - Sanitization options
 */
export function sanitizeInput(
  input: string,
  options: SanitizationOptions = {}
): string {
  if (input == null) {
    throw new ValidationError(
      VALIDATION_MESSAGES.REQUIRED_FIELD,
      ['Input is required'],
      {
        source: 'input_sanitization',
        timestamp: Date.now(),
        validationType: 'string',
        inputSize: 0
      }
    );
  }

  // Validate input length
  const maxLength = options.maxLength || 1000;
  if (input.length > maxLength) {
    throw new ValidationError(
      VALIDATION_MESSAGES.INVALID_LENGTH,
      [`Input exceeds maximum length of ${maxLength}`],
      {
        source: 'input_sanitization',
        timestamp: Date.now(),
        validationType: 'string',
        inputSize: input.length
      }
    );
  }

  let sanitized = input.trim();

  // Apply security filters
  sanitized = validator.escape(sanitized); // Escape HTML special chars
  
  if (!options.allowHtml) {
    sanitized = validator.stripLow(sanitized); // Remove control characters
    sanitized = sanitized.replace(/<[^>]*>/g, ''); // Remove HTML tags
  }

  // Remove potential SQL injection patterns
  sanitized = sanitized.replace(/['";]/g, '');
  
  if (!options.allowSpecialChars) {
    sanitized = sanitized.replace(/[^\w\s-]/g, '');
  }

  // Normalize unicode characters
  sanitized = validator.normalizeEmail(sanitized);

  return sanitized;
}

/**
 * Utility function to chunk large data for validation
 * @private
 */
function chunkData(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    const CHUNK_SIZE = 100; // Items per chunk
    const chunks: unknown[][] = [];
    
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      chunks.push(data.slice(i, i + CHUNK_SIZE));
    }
    
    return chunks;
  }
  
  return [data];
}

// Decorator for error tracking
function ErrorTracking(constructor: Function) {
  // Add error tracking capabilities
  return class extends constructor {
    trackError() {
      // Implementation for error tracking
      console.log('Error tracked:', {
        errorType: this.name,
        timestamp: new Date().toISOString(),
        context: this.context
      });
    }
  };
}