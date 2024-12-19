/**
 * @fileoverview Enhanced API Gateway server implementation for IWMS application
 * Provides comprehensive routing, security, monitoring and high availability features
 * @version 1.0.0
 */

// External imports
import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.0
import helmet from 'helmet'; // v6.0.0
import compression from 'compression'; // v1.7.4
import morgan from 'morgan'; // v1.10.0
import winston from 'winston'; // v3.8.2
import { config } from 'dotenv'; // v16.0.0

// Internal imports
import { kongConfig } from './config/kong.config';
import { ApiRoutes } from './routes';
import { GatewayService } from './services/gateway.service';
import { ErrorCodes } from '../common/constants/error-codes';

// Initialize environment configuration
config();

// Constants
const DEFAULT_PORT = 3000;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [];
const RATE_LIMIT_WINDOW = process.env.RATE_LIMIT_WINDOW || 3600;
const RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || 1000;
const CIRCUIT_BREAKER_TIMEOUT = process.env.CIRCUIT_BREAKER_TIMEOUT || 10000;

/**
 * Enhanced API Gateway server class with advanced security, monitoring,
 * and high availability features
 */
@injectable()
export class ApiGatewayServer {
  private app: Express;
  private readonly gatewayService: GatewayService;
  private readonly logger: Logger;
  private readonly metricsCollector: MetricsCollector;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    gatewayService: GatewayService,
    logger: Logger,
    metricsCollector: MetricsCollector,
    circuitBreaker: CircuitBreaker
  ) {
    this.app = express();
    this.gatewayService = gatewayService;
    this.logger = logger;
    this.metricsCollector = metricsCollector;
    this.circuitBreaker = circuitBreaker;
  }

  /**
   * Initializes the API Gateway server with enhanced security and monitoring
   */
  public async initialize(): Promise<void> {
    try {
      // Configure security middleware
      this.configureMiddleware();

      // Initialize Gateway Service
      await this.gatewayService.initializeGateway();

      // Configure API routes
      const apiRoutes = new ApiRoutes(this.logger);
      this.app.use('/api/v1', apiRoutes.configureRoutes());

      // Configure error handling
      this.configureErrorHandling();

      this.logger.info('API Gateway server initialized successfully', {
        service: 'ApiGatewayServer',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to initialize API Gateway server', {
        error,
        service: 'ApiGatewayServer'
      });
      throw error;
    }
  }

  /**
   * Configures enhanced Express middleware stack with security features
   */
  private configureMiddleware(): void {
    // Enhanced security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true
    }));

    // CORS configuration
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', CORS_ORIGINS.join(','));
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.header('Access-Control-Allow-Credentials', 'true');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Enhanced logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          this.logger.info(message.trim(), {
            service: 'ApiGatewayServer',
            component: 'HttpLogger'
          });
        }
      }
    }));

    // Request correlation
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.headers['x-correlation-id'] = req.headers['x-correlation-id'] || 
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      next();
    });

    // Metrics collection
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      res.on('finish', () => {
        this.metricsCollector.recordMetric('http_request', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration: Date.now() - startTime
        });
      });
      next();
    });
  }

  /**
   * Configures comprehensive error handling
   */
  private configureErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: {
          code: ErrorCodes.RESOURCE_NOT_FOUND,
          message: `Resource not found: ${req.path}`
        }
      });
    });

    // Global error handler
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      const errorCode = err.code || ErrorCodes.INTERNAL_SERVER_ERROR;
      const errorMessage = err.message || 'Internal server error';

      this.logger.error('Unhandled error', {
        error: err,
        path: req.path,
        method: req.method,
        correlationId: req.headers['x-correlation-id']
      });

      res.status(errorCode).json({
        error: {
          code: errorCode,
          message: errorMessage,
          correlationId: req.headers['x-correlation-id']
        }
      });
    });
  }

  /**
   * Starts the API Gateway server with monitoring
   */
  public async start(port: number = DEFAULT_PORT): Promise<void> {
    try {
      await this.initialize();

      const server = this.app.listen(port, () => {
        this.logger.info(`API Gateway server started on port ${port}`, {
          service: 'ApiGatewayServer',
          port,
          timestamp: new Date().toISOString()
        });
      });

      // Enhanced server error handling
      server.on('error', (error: Error) => {
        this.logger.error('Server error occurred', {
          error,
          service: 'ApiGatewayServer'
        });
      });

      // Graceful shutdown handling
      process.on('SIGTERM', () => {
        this.logger.info('SIGTERM received, shutting down gracefully');
        server.close(() => {
          this.logger.info('Server closed successfully');
          process.exit(0);
        });
      });
    } catch (error) {
      this.logger.error('Failed to start API Gateway server', {
        error,
        service: 'ApiGatewayServer'
      });
      throw error;
    }
  }
}

export default ApiGatewayServer;