/**
 * @fileoverview Kong API Gateway configuration module for the IWMS application
 * Implements routing, security, rate limiting, and plugin settings with enhanced
 * availability features and region-aware routing
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.0.0
import { RedisConfig } from '../../common/config/redis.config';

// Initialize environment configuration
config();

/**
 * Interface for Kong route configuration
 */
interface RouteConfig {
  name: string;
  paths: string[];
  methods: string[];
  strip_path?: boolean;
  preserve_host?: boolean;
  service: string;
  plugins?: PluginConfig[];
}

/**
 * Interface for Kong service configuration
 */
interface ServiceConfig {
  name: string;
  url: string;
  connect_timeout?: number;
  write_timeout?: number;
  read_timeout?: number;
  retries?: number;
}

/**
 * Interface for Kong plugin configuration
 */
interface PluginConfig {
  name: string;
  config: Record<string, any>;
  enabled?: boolean;
  service?: string;
  route?: string;
}

/**
 * Interface for health check configuration
 */
interface HealthCheckConfig {
  name: string;
  service: string;
  interval: number;
  timeout: number;
  unhealthy_threshold: number;
  healthy_threshold: number;
}

/**
 * Interface for circuit breaker configuration
 */
interface CircuitBreakerConfig {
  name: string;
  service: string;
  error_threshold: number;
  window_size: number;
  min_requests: number;
}

/**
 * Interface for region-specific routing configuration
 */
interface RegionConfig {
  name: string;
  upstream_url: string;
  availability_zones: string[];
  headers: Record<string, string>;
}

/**
 * Main Kong configuration interface
 */
interface KongConfig {
  prefix: string;
  routes: RouteConfig[];
  services: ServiceConfig[];
  plugins: PluginConfig[];
  health_checks: HealthCheckConfig[];
  circuit_breakers: CircuitBreakerConfig[];
  regions: RegionConfig[];
}

// Constants
const DEFAULT_TIMEOUT = 60000;
const RATE_LIMIT_MINUTE = 60;
const RATE_LIMIT_HOUR = 1000;
const JWT_SECRET = process.env.JWT_SECRET;
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [];
const HEALTH_CHECK_INTERVAL = 5000;
const CIRCUIT_BREAKER_THRESHOLD = 50;
const REGION_HEADER = 'X-Region';

/**
 * Kong API Gateway configuration with enhanced availability features
 */
export const kongConfig: KongConfig = {
  prefix: '/api/v1',
  
  // Service definitions
  services: [
    {
      name: 'floor-plan-service',
      url: process.env.FLOOR_PLAN_SERVICE_URL || 'http://floor-plan-service:3000',
      connect_timeout: DEFAULT_TIMEOUT,
      write_timeout: DEFAULT_TIMEOUT,
      read_timeout: DEFAULT_TIMEOUT,
      retries: 3
    },
    {
      name: 'lease-service',
      url: process.env.LEASE_SERVICE_URL || 'http://lease-service:3000',
      connect_timeout: DEFAULT_TIMEOUT,
      write_timeout: DEFAULT_TIMEOUT,
      read_timeout: DEFAULT_TIMEOUT,
      retries: 3
    },
    {
      name: 'occupancy-service',
      url: process.env.OCCUPANCY_SERVICE_URL || 'http://occupancy-service:3000',
      connect_timeout: DEFAULT_TIMEOUT,
      write_timeout: DEFAULT_TIMEOUT,
      read_timeout: DEFAULT_TIMEOUT,
      retries: 3
    }
  ],

  // Route configurations
  routes: [
    {
      name: 'floor-plans',
      paths: ['/floor-plans'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      strip_path: false,
      service: 'floor-plan-service'
    },
    {
      name: 'leases',
      paths: ['/leases'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      strip_path: false,
      service: 'lease-service'
    },
    {
      name: 'occupancy',
      paths: ['/occupancy'],
      methods: ['GET', 'POST'],
      strip_path: false,
      service: 'occupancy-service'
    }
  ],

  // Global plugins
  plugins: [
    {
      name: 'cors',
      config: {
        origins: CORS_ORIGINS,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        headers: ['Authorization', 'Content-Type', 'X-Region'],
        exposed_headers: ['X-RateLimit-Remaining', 'X-RateLimit-Reset'],
        credentials: true,
        max_age: 3600
      }
    },
    {
      name: 'jwt',
      config: {
        secret: JWT_SECRET,
        key_claim_name: 'kid',
        claims_to_verify: ['exp', 'nbf', 'iss', 'aud'],
        maximum_expiration: 86400
      }
    },
    {
      name: 'rate-limiting',
      config: {
        minute: RATE_LIMIT_MINUTE,
        hour: RATE_LIMIT_HOUR,
        policy: 'redis',
        fault_tolerant: true,
        redis_host: process.env.REDIS_HOST,
        redis_port: parseInt(process.env.REDIS_PORT || '6379'),
        redis_cluster: true
      }
    },
    {
      name: 'request-transformer',
      config: {
        add: {
          headers: ['X-Request-ID:$(uuid)', 'X-Service-Version:$(service.version)']
        }
      }
    },
    {
      name: 'response-transformer',
      config: {
        add: {
          headers: ['X-Response-Time', 'X-Kong-Proxy-Latency']
        }
      }
    }
  ],

  // Health check configurations
  health_checks: [
    {
      name: 'floor-plan-health',
      service: 'floor-plan-service',
      interval: HEALTH_CHECK_INTERVAL,
      timeout: 3000,
      unhealthy_threshold: 3,
      healthy_threshold: 2
    },
    {
      name: 'lease-health',
      service: 'lease-service',
      interval: HEALTH_CHECK_INTERVAL,
      timeout: 3000,
      unhealthy_threshold: 3,
      healthy_threshold: 2
    },
    {
      name: 'occupancy-health',
      service: 'occupancy-service',
      interval: HEALTH_CHECK_INTERVAL,
      timeout: 3000,
      unhealthy_threshold: 3,
      healthy_threshold: 2
    }
  ],

  // Circuit breaker configurations
  circuit_breakers: [
    {
      name: 'floor-plan-breaker',
      service: 'floor-plan-service',
      error_threshold: CIRCUIT_BREAKER_THRESHOLD,
      window_size: 60,
      min_requests: 20
    },
    {
      name: 'lease-breaker',
      service: 'lease-service',
      error_threshold: CIRCUIT_BREAKER_THRESHOLD,
      window_size: 60,
      min_requests: 20
    },
    {
      name: 'occupancy-breaker',
      service: 'occupancy-service',
      error_threshold: CIRCUIT_BREAKER_THRESHOLD,
      window_size: 60,
      min_requests: 20
    }
  ],

  // Region-specific routing
  regions: [
    {
      name: 'us-east',
      upstream_url: process.env.US_EAST_URL || 'http://us-east.api.iwms.com',
      availability_zones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
      headers: {
        [REGION_HEADER]: 'us-east'
      }
    },
    {
      name: 'us-west',
      upstream_url: process.env.US_WEST_URL || 'http://us-west.api.iwms.com',
      availability_zones: ['us-west-2a', 'us-west-2b', 'us-west-2c'],
      headers: {
        [REGION_HEADER]: 'us-west'
      }
    }
  ]
};

// Prevent runtime modifications to the configuration
Object.freeze(kongConfig);