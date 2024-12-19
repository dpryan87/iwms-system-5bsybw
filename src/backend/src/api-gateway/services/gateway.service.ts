/**
 * @fileoverview Enhanced API Gateway service implementation for IWMS application
 * Provides comprehensive routing, security, monitoring and high availability features
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // v6.0.1
import { Kong } from '@kong/kong-admin-js'; // v3.0.0
import { Logger } from 'winston'; // v3.8.2
import { kongConfig } from '../config/kong.config';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { ErrorCodes } from '../../common/constants/error-codes';
import { ServiceHealthStatus, IHealthCheckResult } from '../../common/interfaces/service.interface';

/**
 * Enhanced configuration interface for Gateway Service
 */
interface GatewayServiceConfig {
  adminApiUrl: string;
  adminApiKey: string;
  enableCircuitBreaker: boolean;
  healthCheckInterval: number;
  retryAttempts: number;
  connectionTimeout: number;
  rateLimitConfig: {
    enabled: boolean;
    windowMs: number;
    max: number;
  };
  monitoringConfig: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      errorRate: number;
      latency: number;
      failureCount: number;
    };
  };
}

/**
 * Circuit breaker state tracking
 */
interface CircuitBreakerState {
  failures: number;
  lastFailure: Date;
  status: 'OPEN' | 'CLOSED' | 'HALF_OPEN';
}

/**
 * Enhanced service class managing API Gateway functionality with advanced security,
 * monitoring, and high availability features
 */
@injectable()
export class GatewayService {
  private kongClient: Kong;
  private readonly logger: Logger;
  private readonly authMiddleware: AuthMiddleware;
  private readonly config: GatewayServiceConfig;
  private circuitBreakers: Map<string, CircuitBreakerState>;
  private healthMonitor: NodeJS.Timeout | null;
  private initialized: boolean;

  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly CIRCUIT_BREAKER_THRESHOLD = 0.5;
  private readonly DEFAULT_TIMEOUT = 60000;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly CONNECTION_POOL_SIZE = 10;

  constructor(
    config: GatewayServiceConfig,
    logger: Logger,
    authMiddleware: AuthMiddleware
  ) {
    this.config = config;
    this.logger = logger;
    this.authMiddleware = authMiddleware;
    this.circuitBreakers = new Map();
    this.healthMonitor = null;
    this.initialized = false;
  }

  /**
   * Initializes API Gateway with enhanced security and monitoring
   */
  public async initializeGateway(): Promise<void> {
    try {
      // Initialize Kong client with retry logic
      this.kongClient = new Kong({
        adminUrl: this.config.adminApiUrl,
        apiKey: this.config.adminApiKey,
        retryAttempts: this.config.retryAttempts || this.MAX_RETRY_ATTEMPTS,
        timeout: this.config.connectionTimeout || this.DEFAULT_TIMEOUT
      });

      // Configure services
      await this.configureServices();

      // Configure routes
      await this.configureRoutes();

      // Configure plugins
      await this.configurePlugins();

      // Initialize health monitoring
      this.startHealthMonitoring();

      this.initialized = true;

      this.logger.info('API Gateway initialized successfully', {
        service: 'GatewayService',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to initialize API Gateway', {
        error,
        service: 'GatewayService'
      });
      throw error;
    }
  }

  /**
   * Configures Kong services with enhanced error handling and monitoring
   */
  private async configureServices(): Promise<void> {
    try {
      for (const service of kongConfig.services) {
        await this.kongClient.services.create({
          ...service,
          connect_timeout: this.DEFAULT_TIMEOUT,
          write_timeout: this.DEFAULT_TIMEOUT,
          read_timeout: this.DEFAULT_TIMEOUT,
          retries: this.MAX_RETRY_ATTEMPTS
        });

        // Initialize circuit breaker for service
        this.circuitBreakers.set(service.name, {
          failures: 0,
          lastFailure: new Date(),
          status: 'CLOSED'
        });
      }
    } catch (error) {
      this.logger.error('Failed to configure services', {
        error,
        service: 'GatewayService'
      });
      throw error;
    }
  }

  /**
   * Configures Kong routes with enhanced security and validation
   */
  private async configureRoutes(): Promise<void> {
    try {
      for (const route of kongConfig.routes) {
        await this.kongClient.routes.create({
          ...route,
          protocols: ['https'],
          https_redirect_status_code: 308,
          strip_path: false,
          preserve_host: true
        });
      }
    } catch (error) {
      this.logger.error('Failed to configure routes', {
        error,
        service: 'GatewayService'
      });
      throw error;
    }
  }

  /**
   * Configures Kong plugins with enhanced security features
   */
  private async configurePlugins(): Promise<void> {
    try {
      for (const plugin of kongConfig.plugins) {
        await this.kongClient.plugins.create({
          ...plugin,
          enabled: true,
          protocols: ['https']
        });
      }

      // Configure rate limiting
      if (this.config.rateLimitConfig.enabled) {
        const rateLimiter = rateLimitMiddleware.createRateLimitMiddleware({
          windowMs: this.config.rateLimitConfig.windowMs,
          max: this.config.rateLimitConfig.max
        });

        await this.kongClient.plugins.create({
          name: 'rate-limiting',
          config: rateLimiter
        });
      }
    } catch (error) {
      this.logger.error('Failed to configure plugins', {
        error,
        service: 'GatewayService'
      });
      throw error;
    }
  }

  /**
   * Starts health monitoring system with enhanced metrics collection
   */
  private startHealthMonitoring(): void {
    if (this.healthMonitor) {
      clearInterval(this.healthMonitor);
    }

    this.healthMonitor = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        
        if (health.status !== ServiceHealthStatus.HEALTHY) {
          this.logger.warn('Unhealthy gateway state detected', {
            health,
            service: 'GatewayService'
          });

          // Trigger circuit breaker if necessary
          this.evaluateCircuitBreakers();
        }

        // Collect and store metrics if enabled
        if (this.config.monitoringConfig.enabled) {
          await this.collectMetrics();
        }
      } catch (error) {
        this.logger.error('Health check failed', {
          error,
          service: 'GatewayService'
        });
      }
    }, this.config.healthCheckInterval || this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Performs comprehensive health check of the gateway
   */
  private async checkHealth(): Promise<IHealthCheckResult> {
    const startTime = Date.now();
    const health: IHealthCheckResult = {
      status: ServiceHealthStatus.HEALTHY,
      timestamp: new Date(),
      details: {
        database: true,
        cache: true,
        dependencies: true
      },
      metrics: {
        uptime: process.uptime(),
        responseTime: 0,
        activeConnections: 0
      }
    };

    try {
      // Check Kong Admin API
      await this.kongClient.status.get();

      // Check circuit breakers
      const unhealthyServices = Array.from(this.circuitBreakers.entries())
        .filter(([_, state]) => state.status === 'OPEN')
        .map(([service]) => service);

      if (unhealthyServices.length > 0) {
        health.status = ServiceHealthStatus.DEGRADED;
        health.details.dependencies = false;
      }

      // Calculate response time
      health.metrics.responseTime = Date.now() - startTime;

      return health;
    } catch (error) {
      health.status = ServiceHealthStatus.UNHEALTHY;
      health.details.dependencies = false;
      
      this.logger.error('Health check failed', {
        error,
        service: 'GatewayService'
      });
      
      return health;
    }
  }

  /**
   * Evaluates and updates circuit breaker states
   */
  private evaluateCircuitBreakers(): void {
    for (const [service, state] of this.circuitBreakers.entries()) {
      if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        if (state.status !== 'OPEN') {
          state.status = 'OPEN';
          this.logger.warn(`Circuit breaker opened for service: ${service}`, {
            service: 'GatewayService',
            circuitBreaker: { service, state }
          });
        }
      } else if (
        state.status === 'OPEN' &&
        Date.now() - state.lastFailure.getTime() > this.DEFAULT_TIMEOUT
      ) {
        state.status = 'HALF_OPEN';
        this.logger.info(`Circuit breaker half-open for service: ${service}`, {
          service: 'GatewayService',
          circuitBreaker: { service, state }
        });
      }
    }
  }

  /**
   * Collects and stores gateway metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.kongClient.status.get();
      
      // Check alert thresholds
      if (
        metrics.error_rate > this.config.monitoringConfig.alertThresholds.errorRate ||
        metrics.latency > this.config.monitoringConfig.alertThresholds.latency
      ) {
        this.logger.warn('Gateway metrics exceeded thresholds', {
          service: 'GatewayService',
          metrics
        });
      }

      // Store metrics for monitoring
      // Implementation depends on monitoring system integration
    } catch (error) {
      this.logger.error('Failed to collect metrics', {
        error,
        service: 'GatewayService'
      });
    }
  }
}

export default GatewayService;