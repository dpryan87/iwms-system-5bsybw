// @package inversify v6.0.1
// @package axios v1.4.0
// @package axios-rate-limit v1.3.0
// @package node-cache v5.1.2
// @package opossum v6.0.0

import { injectable } from 'inversify';
import axios, { AxiosInstance } from 'axios';
import rateLimit from 'axios-rate-limit';
import NodeCache from 'node-cache';
import CircuitBreaker from 'opossum';

import { IHRService, IEmployee, IDepartment, ISyncOptions } from './interfaces/hr.interface';
import { IBaseService, IServiceConfig, ServiceHealthStatus, IHealthCheckResult } from '../../common/interfaces/service.interface';
import { logger } from '../../common/utils/logger.util';
import { HRConfig } from '../../common/interfaces/config.interface';

@injectable()
export class HRService implements IHRService {
  private readonly logger = logger;
  private baseUrl: string;
  private apiKey: string;
  private initialized = false;
  private httpClient: AxiosInstance;
  private circuitBreaker: CircuitBreaker;
  private cache: NodeCache;

  // Configuration defaults
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly DEFAULT_RETRIES = 3;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly RATE_LIMIT = 100; // requests per minute
  private readonly CIRCUIT_BREAKER_OPTIONS = {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
  };

  constructor() {
    this.cache = new NodeCache({
      stdTTL: this.CACHE_TTL,
      checkperiod: 120,
      useClones: false
    });

    // Initialize circuit breaker for HR API calls
    this.circuitBreaker = new CircuitBreaker(this.makeRequest.bind(this), this.CIRCUIT_BREAKER_OPTIONS);
    this.setupCircuitBreakerEvents();
  }

  async initialize(config: IServiceConfig): Promise<void> {
    try {
      const hrConfig = config.options as HRConfig;
      
      if (!hrConfig?.endpoint || !hrConfig?.apiKey) {
        throw new Error('Invalid HR service configuration');
      }

      this.baseUrl = hrConfig.endpoint;
      this.apiKey = hrConfig.apiKey;

      // Initialize HTTP client with rate limiting
      this.httpClient = rateLimit(axios.create({
        baseURL: this.baseUrl,
        timeout: this.DEFAULT_TIMEOUT,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }), { maxRequests: this.RATE_LIMIT, perMilliseconds: 60000 });

      // Validate connection
      await this.validate();
      
      this.initialized = true;
      this.logger.info('HR service initialized successfully', { 
        service: 'HRService',
        endpoint: this.baseUrl 
      });
    } catch (error) {
      this.logger.error('Failed to initialize HR service', error);
      throw error;
    }
  }

  async validate(): Promise<boolean> {
    try {
      await this.circuitBreaker.fire({
        method: 'GET',
        url: '/health'
      });
      return true;
    } catch (error) {
      this.logger.error('HR service validation failed', error);
      return false;
    }
  }

  async syncEmployeeData(options: ISyncOptions): Promise<{
    success: boolean;
    errors: Error[];
    syncedCount: number;
  }> {
    this.checkInitialized();
    const errors: Error[] = [];
    let syncedCount = 0;

    try {
      const response = await this.circuitBreaker.fire({
        method: 'POST',
        url: '/employees/sync',
        data: options
      });

      syncedCount = response.data.syncedCount;
      this.logger.info('Employee data sync completed', { 
        syncedCount,
        options 
      });

      return {
        success: true,
        errors,
        syncedCount
      };
    } catch (error) {
      this.logger.error('Employee sync failed', error);
      errors.push(error as Error);
      return {
        success: false,
        errors,
        syncedCount
      };
    }
  }

  async getDepartmentInfo(departmentId: string): Promise<IDepartment> {
    this.checkInitialized();
    const cacheKey = `dept_${departmentId}`;
    
    // Check cache first
    const cachedData = this.cache.get<IDepartment>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await this.circuitBreaker.fire({
        method: 'GET',
        url: `/departments/${departmentId}`
      });

      const department = response.data as IDepartment;
      this.cache.set(cacheKey, department);
      return department;
    } catch (error) {
      this.logger.error('Failed to fetch department info', error, { departmentId });
      throw error;
    }
  }

  async getEmployeeDetails(employeeId: string): Promise<IEmployee> {
    this.checkInitialized();
    const cacheKey = `emp_${employeeId}`;
    
    // Check cache first
    const cachedData = this.cache.get<IEmployee>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await this.circuitBreaker.fire({
        method: 'GET',
        url: `/employees/${employeeId}`
      });

      const employee = response.data as IEmployee;
      this.cache.set(cacheKey, employee);
      return employee;
    } catch (error) {
      this.logger.error('Failed to fetch employee details', error, { employeeId });
      throw error;
    }
  }

  async validateEmployeeData(employee: IEmployee): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    this.checkInitialized();
    try {
      const response = await this.circuitBreaker.fire({
        method: 'POST',
        url: '/employees/validate',
        data: employee
      });
      return response.data;
    } catch (error) {
      this.logger.error('Employee validation failed', error);
      throw error;
    }
  }

  async healthCheck(): Promise<IHealthCheckResult> {
    try {
      const isHealthy = await this.validate();
      return {
        status: isHealthy ? ServiceHealthStatus.HEALTHY : ServiceHealthStatus.UNHEALTHY,
        timestamp: new Date(),
        details: {
          database: true,
          cache: this.cache.stats().keys > 0,
          dependencies: isHealthy
        },
        metrics: {
          uptime: process.uptime(),
          responseTime: 0,
          activeConnections: this.circuitBreaker.stats.activeRequests
        }
      };
    } catch (error) {
      return {
        status: ServiceHealthStatus.UNHEALTHY,
        timestamp: new Date(),
        details: {
          database: true,
          cache: false,
          dependencies: false,
          message: error.message
        },
        metrics: {
          uptime: process.uptime(),
          responseTime: 0,
          activeConnections: 0
        }
      };
    }
  }

  private async makeRequest(config: any): Promise<any> {
    try {
      return await this.httpClient.request(config);
    } catch (error) {
      this.logger.error('HR API request failed', error);
      throw error;
    }
  }

  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker opened', { service: 'HRService' });
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info('Circuit breaker half-open', { service: 'HRService' });
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('Circuit breaker closed', { service: 'HRService' });
    });
  }

  private checkInitialized(): void {
    if (!this.initialized) {
      throw new Error('HR service is not initialized');
    }
  }
}