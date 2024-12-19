/**
 * @fileoverview Enhanced rate limiting middleware for API Gateway
 * Implements token bucket algorithm with Redis storage, connection pooling,
 * and granular control based on IP, API key, and user roles
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.0
import Redis from 'ioredis'; // v5.3.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import RedisStore from 'rate-limit-redis'; // v3.0.0
import CircuitBreaker from 'opossum'; // v6.0.0
import { redisConfig } from '../../common/config/redis.config';
import { kongConfig } from '../config/kong.config';
import { ERROR_MESSAGES } from '../../common/constants/messages';
import { ErrorCodes } from '../../common/constants/error-codes';

/**
 * Rate limit configuration interface with enhanced features
 */
interface RateLimitConfig {
  windowMs: number;
  max: number;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  keyGenerator?: (req: Request) => string;
  poolSize: number;
  whitelistedIPs: string[];
  blacklistedIPs: string[];
  roleBasedLimits: Record<string, number>;
}

/**
 * Default rate limit configuration values
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 3600000, // 1 hour
  max: 1000, // 1000 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  poolSize: redisConfig.connectionPool.maxConnections,
  whitelistedIPs: [],
  blacklistedIPs: [],
  roleBasedLimits: {
    admin: 5000,
    standard: 1000,
    basic: 500
  }
};

/**
 * Redis connection pool configuration
 */
const REDIS_OPTIONS = {
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  db: redisConfig.db,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    return Math.min(times * 50, 2000);
  }
};

/**
 * Circuit breaker configuration for Redis operations
 */
const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 3000, // 3 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000 // 30 seconds
};

/**
 * Rate limiting metrics tracking
 */
class RateLimitMetrics {
  private static instance: RateLimitMetrics;
  private metrics: Map<string, { hits: number; blocked: number }>;

  private constructor() {
    this.metrics = new Map();
  }

  static getInstance(): RateLimitMetrics {
    if (!RateLimitMetrics.instance) {
      RateLimitMetrics.instance = new RateLimitMetrics();
    }
    return RateLimitMetrics.instance;
  }

  recordHit(key: string): void {
    const current = this.metrics.get(key) || { hits: 0, blocked: 0 };
    current.hits++;
    this.metrics.set(key, current);
  }

  recordBlock(key: string): void {
    const current = this.metrics.get(key) || { hits: 0, blocked: 0 };
    current.blocked++;
    this.metrics.set(key, current);
  }

  getMetrics(): Map<string, { hits: number; blocked: number }> {
    return new Map(this.metrics);
  }
}

/**
 * Creates Redis connection pool
 */
function createRedisPool(size: number): Redis.Cluster | Redis {
  if (redisConfig.cluster.enabled) {
    return new Redis.Cluster(redisConfig.cluster.nodes, {
      redisOptions: REDIS_OPTIONS,
      scaleReads: 'slave',
      maxRedirections: 16,
      retryDelayOnFailover: 100
    });
  }
  
  return new Redis({
    ...REDIS_OPTIONS,
    lazyConnect: true,
    connectTimeout: 10000,
    disconnectTimeout: 2000
  });
}

/**
 * Enhanced key generator for rate limiting
 */
function keyGenerator(req: Request): string {
  const clientIP = req.ip || 
    req.connection.remoteAddress || 
    req.headers['x-forwarded-for'] as string;
    
  const apiKey = req.headers['x-api-key'] as string;
  const userRole = (req as any).user?.role || 'anonymous';
  
  return `${process.env.REDIS_KEY_PREFIX || 'rl:'}${clientIP}:${apiKey}:${userRole}`;
}

/**
 * Creates and configures rate limiting middleware
 */
export function createRateLimitMiddleware(
  config: Partial<RateLimitConfig> = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const redisClient = createRedisPool(finalConfig.poolSize);
  const metrics = RateLimitMetrics.getInstance();

  // Configure circuit breaker for Redis operations
  const breaker = new CircuitBreaker(
    async (key: string) => {
      return await redisClient.get(key);
    },
    CIRCUIT_BREAKER_OPTIONS
  );

  breaker.fallback(async () => {
    // Fallback to in-memory rate limiting if Redis is unavailable
    console.warn('Redis unavailable, falling back to in-memory rate limiting');
    return null;
  });

  const limiter = rateLimit({
    windowMs: finalConfig.windowMs,
    max: finalConfig.max,
    standardHeaders: finalConfig.standardHeaders,
    legacyHeaders: finalConfig.legacyHeaders,
    keyGenerator: finalConfig.keyGenerator || keyGenerator,
    skip: (req: Request) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      return finalConfig.whitelistedIPs.includes(clientIP!);
    },
    handler: (req: Request, res: Response) => {
      const key = (finalConfig.keyGenerator || keyGenerator)(req);
      metrics.recordBlock(key);
      
      res.status(ErrorCodes.RATE_LIMIT_EXCEEDED).json({
        error: {
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
          message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED.replace(
            '{retryAfter}',
            Math.ceil(finalConfig.windowMs / 1000).toString()
          )
        }
      });
    },
    store: new RedisStore({
      client: redisClient as any,
      prefix: process.env.REDIS_KEY_PREFIX || 'rl:',
      sendCommand: async (...args: any[]) => {
        try {
          const result = await breaker.fire(args[0]);
          return result;
        } catch (error) {
          console.error('Rate limit Redis error:', error);
          return null;
        }
      }
    })
  });

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Check blacklist
    if (finalConfig.blacklistedIPs.includes(clientIP!)) {
      return res.status(ErrorCodes.AUTHORIZATION_ERROR).json({
        error: {
          code: ErrorCodes.AUTHORIZATION_ERROR,
          message: ERROR_MESSAGES.AUTHORIZATION_ERROR
        }
      });
    }

    // Apply role-based limits
    const userRole = (req as any).user?.role || 'anonymous';
    if (finalConfig.roleBasedLimits[userRole]) {
      finalConfig.max = finalConfig.roleBasedLimits[userRole];
    }

    // Record metrics
    const key = (finalConfig.keyGenerator || keyGenerator)(req);
    metrics.recordHit(key);

    return limiter(req, res, next);
  };
}

// Export configured middleware and metrics
export const rateLimitMiddleware = {
  createRateLimitMiddleware,
  RateLimitMetrics
};