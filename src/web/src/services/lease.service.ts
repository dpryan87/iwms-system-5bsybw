// External imports with versions
import { format } from 'date-fns'; // ^2.30.0
import * as CryptoJS from 'crypto-js'; // ^4.1.1
import * as winston from 'winston'; // ^3.8.2

// Internal imports
import { 
  ILease, 
  LeaseStatus, 
  LeaseDocument, 
  ILeaseFinancials,
  LeaseApiResponse,
  NotificationType,
  NotificationStatus
} from '../types/lease.types';

/**
 * Configuration for the lease service security and logging
 */
const CONFIG = {
  API_BASE_URL: process.env.REACT_APP_API_BASE_URL,
  ENCRYPTION_KEY: process.env.REACT_APP_LEASE_ENCRYPTION_KEY,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  MAX_DOCUMENT_SIZE: 25 * 1024 * 1024, // 25MB
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

/**
 * Logger configuration for audit trail and debugging
 */
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'lease-service.log' })
  ]
});

/**
 * Service class providing secure lease management functionality with financial integration
 */
export class LeaseService {
  private static instance: LeaseService;

  private constructor() {
    this.initializeService();
  }

  /**
   * Get singleton instance of LeaseService
   */
  public static getInstance(): LeaseService {
    if (!LeaseService.instance) {
      LeaseService.instance = new LeaseService();
    }
    return LeaseService.instance;
  }

  /**
   * Initialize service with required configurations
   */
  private initializeService(): void {
    if (!CONFIG.ENCRYPTION_KEY) {
      throw new Error('Lease service encryption key not configured');
    }
    this.validateEnvironment();
  }

  /**
   * Creates a new lease with enhanced validation and security
   * @param leaseData - The lease data to create
   * @returns Promise<ILease> - Created lease with security features
   */
  public async createNewLease(leaseData: Omit<ILease, 'id'>): Promise<ILease> {
    try {
      // Validate lease data
      this.validateLeaseData(leaseData);
      
      // Encrypt sensitive information
      const encryptedData = this.encryptSensitiveData(leaseData);
      
      // Generate request signature
      const signature = this.generateRequestSignature(encryptedData);
      
      // Prepare request with security headers
      const response = await this.makeSecureApiCall<LeaseApiResponse>('POST', '/leases', {
        data: encryptedData,
        signature,
        timestamp: new Date().toISOString()
      });

      // Log audit trail
      await this.generateAuditLog('CREATE_LEASE', response.data.data.id);

      return response.data.data;
    } catch (error) {
      logger.error('Error creating lease:', { error, leaseData: this.sanitizeLogData(leaseData) });
      throw this.handleServiceError(error);
    }
  }

  /**
   * Uploads and encrypts a lease document
   * @param leaseId - ID of the lease
   * @param document - Document file to upload
   * @returns Promise<LeaseDocument> - Uploaded document metadata
   */
  public async uploadDocument(leaseId: string, document: File): Promise<LeaseDocument> {
    try {
      // Validate document
      this.validateDocument(document);

      // Encrypt document content
      const encryptedDocument = await this.encryptDocument(document);
      
      // Generate document checksum
      const checksum = await this.generateDocumentChecksum(document);

      // Prepare form data
      const formData = new FormData();
      formData.append('document', encryptedDocument);
      formData.append('leaseId', leaseId);
      formData.append('checksum', checksum);

      // Upload with security headers
      const response = await this.makeSecureApiCall<{ data: LeaseDocument }>('POST', 
        `/leases/${leaseId}/documents`, 
        formData,
        { 'Content-Type': 'multipart/form-data' }
      );

      // Log document upload
      await this.generateAuditLog('UPLOAD_DOCUMENT', leaseId, document.name);

      return response.data.data;
    } catch (error) {
      logger.error('Error uploading document:', { error, leaseId, documentName: document.name });
      throw this.handleServiceError(error);
    }
  }

  /**
   * Validates lease financial data
   * @param financials - Lease financial details to validate
   * @returns boolean - Validation result
   */
  public validateFinancials(financials: ILeaseFinancials): boolean {
    try {
      // Validate required financial fields
      if (!financials.baseRent || financials.baseRent <= 0) {
        throw new Error('Invalid base rent amount');
      }

      // Validate payment schedule
      if (!financials.paymentSchedule || !financials.paymentSchedule.length) {
        throw new Error('Payment schedule is required');
      }

      // Validate payment amounts match total rent
      const totalScheduledPayments = financials.paymentSchedule.reduce(
        (sum, payment) => sum + payment.amount, 
        0
      );

      if (totalScheduledPayments !== financials.baseRent * 12) {
        throw new Error('Payment schedule amounts do not match annual rent');
      }

      return true;
    } catch (error) {
      logger.error('Financial validation error:', { error, financials: this.sanitizeLogData(financials) });
      throw error;
    }
  }

  /**
   * Generates secure audit log entry
   * @param action - Action being audited
   * @param leaseId - ID of the lease
   * @param details - Additional audit details
   */
  public async generateAuditLog(action: string, leaseId: string, details?: string): Promise<void> {
    try {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        action,
        leaseId,
        details,
        userId: this.getCurrentUserId(),
        ipAddress: await this.getClientIp()
      };

      logger.info('Audit log entry:', auditEntry);

      // Store audit log securely
      await this.makeSecureApiCall('POST', '/audit-logs', {
        data: this.encryptSensitiveData(auditEntry)
      });
    } catch (error) {
      logger.error('Error generating audit log:', { error, action, leaseId });
    }
  }

  // Private helper methods

  private validateLeaseData(leaseData: Omit<ILease, 'id'>): void {
    if (!leaseData.propertyId || !leaseData.tenantId) {
      throw new Error('Property and tenant IDs are required');
    }

    if (!leaseData.startDate || !leaseData.endDate) {
      throw new Error('Lease start and end dates are required');
    }

    if (new Date(leaseData.startDate) >= new Date(leaseData.endDate)) {
      throw new Error('Invalid lease date range');
    }

    this.validateFinancials(leaseData.financials);
  }

  private validateDocument(document: File): void {
    if (document.size > CONFIG.MAX_DOCUMENT_SIZE) {
      throw new Error('Document size exceeds maximum allowed size');
    }

    if (!CONFIG.ALLOWED_DOCUMENT_TYPES.includes(document.type)) {
      throw new Error('Invalid document type');
    }
  }

  private encryptSensitiveData(data: any): any {
    const sensitiveFields = ['financials', 'terms', 'documents'];
    const encrypted = { ...data };

    sensitiveFields.forEach(field => {
      if (encrypted[field]) {
        encrypted[field] = CryptoJS.AES.encrypt(
          JSON.stringify(encrypted[field]),
          CONFIG.ENCRYPTION_KEY!
        ).toString();
      }
    });

    return encrypted;
  }

  private async encryptDocument(document: File): Promise<Blob> {
    const arrayBuffer = await document.arrayBuffer();
    const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
    const encrypted = CryptoJS.AES.encrypt(wordArray, CONFIG.ENCRYPTION_KEY!);
    
    return new Blob([encrypted.toString()], { type: document.type });
  }

  private generateRequestSignature(data: any): string {
    const timestamp = new Date().toISOString();
    return CryptoJS.HmacSHA256(
      JSON.stringify(data) + timestamp,
      CONFIG.ENCRYPTION_KEY!
    ).toString();
  }

  private async generateDocumentChecksum(document: File): Promise<string> {
    const arrayBuffer = await document.arrayBuffer();
    return CryptoJS.SHA256(CryptoJS.lib.WordArray.create(arrayBuffer)).toString();
  }

  private sanitizeLogData(data: any): any {
    const sanitized = { ...data };
    const sensitiveFields = ['financials', 'documents'];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private handleServiceError(error: any): Error {
    // Handle specific error types
    if (error.response?.status === 401) {
      return new Error('Authentication required');
    }
    if (error.response?.status === 403) {
      return new Error('Insufficient permissions');
    }
    return new Error(error.message || 'An error occurred in the lease service');
  }

  private validateEnvironment(): void {
    const requiredEnvVars = [
      'REACT_APP_API_BASE_URL',
      'REACT_APP_LEASE_ENCRYPTION_KEY'
    ];

    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        throw new Error(`Required environment variable ${envVar} is not set`);
      }
    });
  }

  private getCurrentUserId(): string {
    // Implementation would get the current authenticated user's ID
    return 'current-user-id';
  }

  private async getClientIp(): Promise<string> {
    // Implementation would get the client's IP address
    return 'client-ip';
  }

  private async makeSecureApiCall<T>(
    method: string,
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    // Implementation would make secure API calls with retry logic
    // and proper error handling
    return {} as T;
  }
}

export default LeaseService.getInstance();