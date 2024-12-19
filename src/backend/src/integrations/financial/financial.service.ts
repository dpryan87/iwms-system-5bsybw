// @package inversify v6.0.1
// @package winston v3.8.2
// @package axios v1.4.0
// @package opossum v6.0.0
// @package ioredis v5.0.0
import { injectable } from 'inversify';
import { Logger } from 'winston';
import axios, { AxiosInstance, AxiosError } from 'axios';
import CircuitBreaker from 'opossum';
import Redis from 'ioredis';
import { createHash, createCipheriv, createDecipheriv } from 'crypto';

import { 
  IFinancialService, 
  ILeasePayment, 
  ICostCenter,
  IPaymentResult,
  ISyncResult,
  PaymentStatus 
} from './interfaces/financial.interface';
import { IBaseService, ServiceHealthStatus, IHealthCheckResult } from '../../common/interfaces/service.interface';
import { FinancialConfig } from '../../common/interfaces/config.interface';

@injectable()
export class FinancialService implements IFinancialService, IBaseService {
  private readonly logger: Logger;
  private readonly cacheClient: Redis;
  private readonly httpClient: AxiosInstance;
  private circuitBreaker: CircuitBreaker;
  private apiUrl: string;
  private apiKey: string;
  private initialized: boolean = false;
  private encryptionKey: Buffer;
  private readonly COST_CENTER_CACHE_TTL = 3600; // 1 hour

  private readonly retryConfig = {
    attempts: 3,
    backoff: {
      initial: 1000,
      multiplier: 2,
      max: 10000
    }
  };

  constructor(logger: Logger, cacheClient: Redis) {
    this.logger = logger;
    this.cacheClient = cacheClient;
    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async initialize(config: FinancialConfig): Promise<void> {
    try {
      this.logger.info('Initializing Financial Service');
      
      if (!config.endpoint || !config.apiKey) {
        throw new Error('Invalid financial service configuration');
      }

      this.apiUrl = config.endpoint;
      this.apiKey = config.apiKey;
      
      // Setup encryption key from environment
      this.encryptionKey = Buffer.from(process.env.FINANCIAL_ENCRYPTION_KEY || '', 'hex');
      
      // Configure circuit breaker
      this.circuitBreaker = new CircuitBreaker(this.makeApiCall.bind(this), {
        timeout: 15000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000
      });

      // Setup circuit breaker event handlers
      this.setupCircuitBreakerEvents();

      // Validate connection
      await this.validate();
      
      this.initialized = true;
      this.logger.info('Financial Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Financial Service', { error });
      throw error;
    }
  }

  async validate(): Promise<boolean> {
    try {
      const healthCheck = await this.healthCheck();
      return healthCheck.status === ServiceHealthStatus.HEALTHY;
    } catch (error) {
      this.logger.error('Financial Service validation failed', { error });
      return false;
    }
  }

  async healthCheck(): Promise<IHealthCheckResult> {
    try {
      const response = await this.httpClient.get(`${this.apiUrl}/health`);
      const cacheHealth = await this.cacheClient.ping();

      return {
        status: response.status === 200 && cacheHealth === 'PONG' 
          ? ServiceHealthStatus.HEALTHY 
          : ServiceHealthStatus.DEGRADED,
        timestamp: new Date(),
        details: {
          database: true,
          cache: cacheHealth === 'PONG',
          dependencies: response.status === 200
        },
        metrics: {
          uptime: process.uptime(),
          responseTime: response.data.responseTime || 0,
          activeConnections: response.data.connections || 0
        }
      };
    } catch (error) {
      return {
        status: ServiceHealthStatus.UNHEALTHY,
        timestamp: new Date(),
        details: {
          database: false,
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

  async processLeasePayment(payment: ILeasePayment): Promise<IPaymentResult> {
    if (!this.initialized) {
      throw new Error('Financial Service not initialized');
    }

    try {
      // Create audit entry
      const auditEntry = this.createAuditEntry('PAYMENT_PROCESSING', payment);
      
      // Encrypt sensitive payment data
      const encryptedPayment = this.encryptSensitiveData(payment);
      
      // Process payment through circuit breaker
      const result = await this.circuitBreaker.fire('processPayment', encryptedPayment);
      
      // Update audit trail
      await this.updateAuditTrail(payment.id, {
        ...auditEntry,
        result: result.success ? 'SUCCESS' : 'FAILED'
      });

      return {
        success: result.success,
        transactionId: result.transactionId,
        status: result.success ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
        timestamp: new Date(),
        details: result.details,
        auditTrail: auditEntry
      };
    } catch (error) {
      this.logger.error('Payment processing failed', { 
        paymentId: payment.id,
        error: error.message 
      });
      throw error;
    }
  }

  async getCostCenters(activeOnly: boolean = true): Promise<ICostCenter[]> {
    if (!this.initialized) {
      throw new Error('Financial Service not initialized');
    }

    const cacheKey = `cost_centers:${activeOnly}`;
    
    try {
      // Check cache first
      const cachedData = await this.cacheClient.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // Fetch from API if not in cache
      const response = await this.circuitBreaker.fire('getCostCenters', { activeOnly });
      
      // Cache the results
      await this.cacheClient.setex(
        cacheKey,
        this.COST_CENTER_CACHE_TTL,
        JSON.stringify(response.data)
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch cost centers', { error });
      throw error;
    }
  }

  async syncFinancialData(syncOptions: {
    entities: ('payments' | 'costCenters' | 'budgets')[];
    fullSync?: boolean;
    validateOnly?: boolean;
  }): Promise<ISyncResult> {
    if (!this.initialized) {
      throw new Error('Financial Service not initialized');
    }

    try {
      const result = await this.circuitBreaker.fire('syncData', syncOptions);
      
      // Clear relevant caches
      if (result.success && !syncOptions.validateOnly) {
        await this.clearSyncedDataCache(syncOptions.entities);
      }

      return result;
    } catch (error) {
      this.logger.error('Financial data sync failed', { 
        options: syncOptions,
        error: error.message 
      });
      throw error;
    }
  }

  private async makeApiCall(endpoint: string, data?: any): Promise<any> {
    try {
      const response = await this.httpClient.post(
        `${this.apiUrl}${endpoint}`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-Request-ID': this.generateRequestId()
          }
        }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit Breaker opened - Financial Service temporarily unavailable');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info('Circuit Breaker half-open - attempting recovery');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('Circuit Breaker closed - Financial Service recovered');
    });
  }

  private encryptSensitiveData(data: any): any {
    const iv = Buffer.from(createHash('sha256').update(Math.random().toString()).digest('hex').substr(0, 16));
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(data));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return {
      iv: iv.toString('hex'),
      data: encrypted.toString('hex')
    };
  }

  private createAuditEntry(action: string, data: any): any {
    return {
      timestamp: new Date(),
      action,
      userId: process.env.SERVICE_ACCOUNT_ID,
      details: data,
      ipAddress: '0.0.0.0',
      userAgent: 'FinancialService/1.0'
    };
  }

  private generateRequestId(): string {
    return `fin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleApiError(error: AxiosError): void {
    this.logger.error('API call failed', {
      status: error.response?.status,
      message: error.message,
      code: error.code
    });
  }

  private async clearSyncedDataCache(entities: string[]): Promise<void> {
    const patterns = entities.map(entity => `${entity}:*`);
    for (const pattern of patterns) {
      const keys = await this.cacheClient.keys(pattern);
      if (keys.length > 0) {
        await this.cacheClient.del(...keys);
      }
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Financial Service');
    await this.cacheClient.quit();
    this.initialized = false;
  }
}