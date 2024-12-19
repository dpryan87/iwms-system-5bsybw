// express v4.18.0 - Express types and middleware functionality
import { Request, Response, NextFunction } from 'express';
// uuid v9.0.0 - Request correlation
import { v4 as uuidv4 } from 'uuid';
// Internal logger utility
import { logger } from '../utils/logger.util';

// Paths to exclude from logging
const EXCLUDED_PATHS = ['/health', '/metrics'];
// Maximum request body size to log (1MB)
const MAX_BODY_SIZE = 1048576;
// Headers that contain sensitive information
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key'];

/**
 * Formats request information with security context and PII protection
 */
const formatRequestLog = (req: Request, requestId: string) => {
  const { method, originalUrl, ip, headers, body } = req;
  
  // Sanitize headers by redacting sensitive information
  const sanitizedHeaders = { ...headers };
  SENSITIVE_HEADERS.forEach(header => {
    if (header in sanitizedHeaders) {
      sanitizedHeaders[header] = '[REDACTED]';
    }
  });

  // Calculate request body size and truncate if necessary
  const bodySize = JSON.stringify(body).length;
  const truncatedBody = bodySize > MAX_BODY_SIZE ? 
    { message: `Request body truncated (${bodySize} bytes)` } : body;

  return {
    requestId,
    timestamp: new Date().toISOString(),
    method,
    url: originalUrl,
    clientIp: ip,
    userAgent: headers['user-agent'],
    headers: sanitizedHeaders,
    body: truncatedBody,
    bodySize,
    nodeVersion: process.version,
    pid: process.pid,
    memory: process.memoryUsage(),
  };
};

/**
 * Formats response information with performance metrics
 */
const formatResponseLog = (
  res: Response, 
  requestId: string, 
  duration: number,
  startMemory: NodeJS.MemoryUsage
) => {
  const endMemory = process.memoryUsage();
  
  return {
    requestId,
    statusCode: res.statusCode,
    duration: `${duration.toFixed(2)}ms`,
    contentLength: res.get('content-length'),
    memoryDelta: {
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external,
      rss: endMemory.rss - startMemory.rss,
    },
    headers: res.getHeaders(),
  };
};

/**
 * Express middleware for comprehensive request/response logging with security
 * and performance monitoring.
 */
export const loggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip logging for excluded paths
  if (EXCLUDED_PATHS.includes(req.path)) {
    return next();
  }

  // Generate unique request ID for correlation
  const requestId = uuidv4();
  req.headers['x-request-id'] = requestId;

  // Capture initial timestamp and memory usage
  const startTime = process.hrtime();
  const startMemory = process.memoryUsage();

  // Log incoming request
  logger.info('Incoming request', {
    ...formatRequestLog(req, requestId),
    correlationId: req.headers['x-correlation-id'],
  });

  // Track response
  res.on('finish', () => {
    // Calculate request duration
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds * 1000 + nanoseconds / 1000000;

    // Log response details
    logger.info('Request completed', {
      ...formatResponseLog(res, requestId, duration, startMemory),
      correlationId: req.headers['x-correlation-id'],
    });
  });

  // Error handling
  res.on('error', (error: Error) => {
    logger.error('Request failed', error, {
      requestId,
      correlationId: req.headers['x-correlation-id'],
      url: req.originalUrl,
      method: req.method,
    });
  });

  // Performance monitoring for event loop lag
  const lagInterval = setInterval(() => {
    const lag = process.hrtime(startTime)[1] / 1000000; // Convert to ms
    if (lag > 100) { // Log if event loop lag exceeds 100ms
      logger.warn('High event loop lag detected', {
        requestId,
        lag: `${lag.toFixed(2)}ms`,
        url: req.originalUrl,
      });
    }
  }, 1000);

  // Cleanup interval on response finish
  res.on('finish', () => clearInterval(lagInterval));
  res.on('error', () => clearInterval(lagInterval));

  next();
};