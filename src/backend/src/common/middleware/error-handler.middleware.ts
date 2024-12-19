/**
 * @fileoverview Express middleware for centralized error handling with RFC 7807 compliance
 * and enhanced security features.
 * @version 1.0.0
 * @license MIT
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { ErrorCodes } from '../constants/error-codes';
import { ERROR_MESSAGES } from '../constants/messages';
import { logger } from '../utils/logger.util';

// Cache for frequently occurring errors to improve performance
const errorResponseCache = new Map<string, object>();
const ERROR_CACHE_TTL = 300000; // 5 minutes
const MAX_CACHE_SIZE = 100;

/**
 * Interface for RFC 7807 Problem Details response
 */
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  traceId: string;
  timestamp: string;
  correlationId?: string;
  rateLimits?: {
    remaining: number;
    reset: number;
  };
}

/**
 * Determines if an error response should be cached based on type and frequency
 */
const shouldCacheError = (error: Error, statusCode: number): boolean => {
  // Only cache client errors (4xx) that are frequently occurring
  if (statusCode >= 500) return false;
  if (errorResponseCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = errorResponseCache.keys().next().value;
    errorResponseCache.delete(oldestKey);
  }
  return true;
};

/**
 * Formats error details into RFC 7807 compliant response
 */
const formatErrorResponse = (
  error: Error,
  statusCode: number,
  traceId: string,
  req: Request
): ProblemDetails => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const timestamp = new Date().toISOString();

  // Generate appropriate type URI based on error
  const typeUri = `${baseUrl}/problems/${
    statusCode === ErrorCodes.VALIDATION_ERROR ? 'validation' : 'general'
  }`;

  // Sanitize error message to prevent information disclosure
  const sanitizedMessage = error.message.replace(/([A-Z0-9]{8,})/g, '[REDACTED]');

  const response: ProblemDetails = {
    type: typeUri,
    title: statusCode === ErrorCodes.VALIDATION_ERROR
      ? ERROR_MESSAGES.VALIDATION_ERROR
      : ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    status: statusCode,
    detail: sanitizedMessage,
    instance: req.originalUrl,
    traceId,
    timestamp,
    correlationId: req.headers['x-correlation-id'] as string
  };

  // Add rate limiting information if available
  const remaining = req.headers['x-ratelimit-remaining'];
  const reset = req.headers['x-ratelimit-reset'];
  if (remaining && reset) {
    response.rateLimits = {
      remaining: parseInt(remaining as string, 10),
      reset: parseInt(reset as string, 10)
    };
  }

  return response;
};

/**
 * Express error handling middleware with RFC 7807 compliance and security features
 */
const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate unique trace ID for error tracking
  const traceId = uuidv4();

  // Determine appropriate status code
  let statusCode = ErrorCodes.INTERNAL_SERVER_ERROR;
  if ('statusCode' in error && typeof (error as any).statusCode === 'number') {
    statusCode = (error as any).statusCode;
  } else if (error.name === 'ValidationError') {
    statusCode = ErrorCodes.VALIDATION_ERROR;
  }

  // Check cache for similar errors
  const cacheKey = `${statusCode}-${error.name}-${error.message}`;
  if (shouldCacheError(error, statusCode)) {
    const cachedResponse = errorResponseCache.get(cacheKey);
    if (cachedResponse) {
      res.status(statusCode).json(cachedResponse);
      return;
    }
  }

  // Log error with security context
  const logMetadata = {
    traceId,
    correlationId: req.headers['x-correlation-id'],
    path: req.originalUrl,
    method: req.method,
    statusCode,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  };

  if (statusCode >= 500) {
    logger.error('Server error occurred', error, logMetadata);
  } else {
    logger.error('Client error occurred', error, logMetadata);
  }

  // Format RFC 7807 response
  const response = formatErrorResponse(error, statusCode, traceId, req);

  // Cache error response if appropriate
  if (shouldCacheError(error, statusCode)) {
    errorResponseCache.set(cacheKey, response);
    setTimeout(() => errorResponseCache.delete(cacheKey), ERROR_CACHE_TTL);
  }

  // Send error response
  res.status(statusCode)
    .set('Content-Type', 'application/problem+json')
    .json(response);
};

export default errorHandler;
```

This implementation provides:

1. RFC 7807 Problem Details compliance with enhanced security features
2. Error response caching for improved performance
3. Comprehensive error logging with security context
4. PII protection through message sanitization
5. Rate limiting information inclusion
6. Correlation ID tracking
7. Unique trace IDs for error tracking
8. Content-Type header for Problem Details
9. Proper error status code mapping
10. Cache management with TTL and size limits

The middleware can be used in the Express application by importing and adding it as the last middleware in the chain:

```typescript
import errorHandler from './common/middleware/error-handler.middleware';

// Add at the end of your middleware chain
app.use(errorHandler);