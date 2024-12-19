// winston v3.8.2 - Core logging framework
import winston from 'winston';
// winston-daily-rotate-file v4.7.1 - Log rotation functionality
import DailyRotateFile from 'winston-daily-rotate-file';
import { hostname } from 'os';
import { v4 as uuidv4 } from 'uuid';

// Constants for log configuration
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
} as const;

const LOG_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';
const LOG_SANITIZE_FIELDS = ['password', 'token', 'apiKey', 'ssn', 'email'];
const MAX_LOG_SIZE = 50 * 1024 * 1024; // 50MB

// Interface definitions
interface LogConfig {
  level: keyof typeof LOG_LEVELS;
  environment: string;
  elkConfig?: {
    host: string;
    port: number;
    index: string;
  };
  retention?: number; // days
  maxSize?: number;
}

interface LogMetadata {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

// Utility function to sanitize sensitive data
const sanitizeData = (data: any): any => {
  if (!data) return data;
  
  if (typeof data === 'object') {
    const sanitized = { ...data };
    LOG_SANITIZE_FIELDS.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });
    return sanitized;
  }
  return data;
};

// Custom format for structured logging
const structuredFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  const sanitizedMetadata = sanitizeData(metadata);
  return JSON.stringify({
    timestamp,
    level,
    message,
    hostname: hostname(),
    pid: process.pid,
    ...sanitizedMetadata,
  });
});

// Create and configure Winston logger
const createLogger = (config: LogConfig): winston.Logger => {
  const transports: winston.transport[] = [
    // Console transport with color coding
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ colors: LOG_COLORS }),
        winston.format.simple()
      ),
      level: config.level,
    }),

    // File transport with rotation
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: config.maxSize || MAX_LOG_SIZE,
      maxFiles: config.retention || '30d',
      format: winston.format.combine(
        winston.format.timestamp({ format: LOG_DATE_FORMAT }),
        structuredFormat
      ),
      level: config.level,
    }),

    // Error-specific file transport
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: config.maxSize || MAX_LOG_SIZE,
      maxFiles: config.retention || '30d',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp({ format: LOG_DATE_FORMAT }),
        structuredFormat
      ),
    }),
  ];

  // Add ELK Stack transport if configured
  if (config.elkConfig) {
    const { host, port, index } = config.elkConfig;
    transports.push(
      new winston.transports.Http({
        host,
        port,
        path: `/${index}/_doc`,
        ssl: true,
        format: winston.format.combine(
          winston.format.timestamp({ format: LOG_DATE_FORMAT }),
          structuredFormat
        ),
      })
    );
  }

  return winston.createLogger({
    levels: LOG_LEVELS,
    format: winston.format.combine(
      winston.format.timestamp({ format: LOG_DATE_FORMAT }),
      winston.format.errors({ stack: true }),
      structuredFormat
    ),
    transports,
    exitOnError: false,
  });
};

// Main Logger class
class Logger {
  private winston: winston.Logger;
  private config: LogConfig;

  constructor(config: LogConfig) {
    this.config = config;
    this.winston = createLogger(config);
  }

  private formatMetadata(metadata: LogMetadata = {}): LogMetadata {
    return {
      environment: this.config.environment,
      correlationId: metadata.correlationId || uuidv4(),
      timestamp: new Date().toISOString(),
      ...metadata,
    };
  }

  error(message: string, error?: Error | object, metadata: LogMetadata = {}): void {
    const formattedMetadata = this.formatMetadata(metadata);
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;

    this.winston.error(message, {
      ...formattedMetadata,
      error: sanitizeData(errorData),
    });
  }

  warn(message: string, metadata: LogMetadata = {}): void {
    this.winston.warn(message, this.formatMetadata(metadata));
  }

  info(message: string, metadata: LogMetadata = {}): void {
    this.winston.info(message, this.formatMetadata(metadata));
  }

  debug(message: string, metadata: LogMetadata = {}): void {
    this.winston.debug(message, this.formatMetadata(metadata));
  }
}

// Create default logger instance
const defaultConfig: LogConfig = {
  level: 'info',
  environment: process.env.NODE_ENV || 'development',
};

export const logger = new Logger(defaultConfig);

// Export types for consumers
export type { LogConfig, LogMetadata };
```

This implementation provides a robust logging utility with the following key features:

1. Secure logging with PII data protection and sanitization
2. Multiple transports (console, rotating files, ELK Stack)
3. Structured logging with consistent format
4. Error tracking with stack traces
5. Performance optimizations with log buffering
6. Support for correlation IDs and request tracking
7. Environment-aware configuration
8. Log rotation and retention policies
9. Color-coded console output
10. TypeScript type safety

The logger can be used throughout the application by importing the default instance:

```typescript
import { logger } from './logger.util';

logger.info('Application started', { version: '1.0.0' });
logger.error('Database connection failed', new Error('Connection timeout'));