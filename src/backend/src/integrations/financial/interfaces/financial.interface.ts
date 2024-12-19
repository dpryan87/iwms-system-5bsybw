// @package inversify v6.0.1
import { IBaseService } from '../../../common/interfaces/service.interface';

/**
 * Payment status enumeration
 * Defines possible states for lease payment transactions
 */
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled'
}

/**
 * Payment method enumeration
 * Supported payment methods for lease transactions
 */
export enum PaymentMethod {
  ACH = 'ach',
  WIRE = 'wire',
  CHECK = 'check',
  CREDIT_CARD = 'credit_card'
}

/**
 * Audit trail entry interface
 * Tracks all changes and actions on financial records
 */
export interface IAuditEntry {
  timestamp: Date;
  action: string;
  userId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}

/**
 * Lease payment interface
 * Comprehensive structure for secure lease payment transactions
 */
export interface ILeasePayment {
  id: string;
  leaseId: string;
  transactionId: string;
  amount: number;
  currency: string;
  dueDate: Date;
  processedDate?: Date;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  processingGateway: string;
  securityHash: string;
  auditTrail: IAuditEntry[];
  metadata: {
    invoiceNumber?: string;
    purchaseOrder?: string;
    notes?: string;
    customFields?: Record<string, unknown>;
  };
}

/**
 * Budget tracking interface
 * Manages financial planning and tracking
 */
export interface IBudget {
  fiscal_year: number;
  annual_amount: number;
  quarterly_breakdown: {
    Q1: number;
    Q2: number;
    Q3: number;
    Q4: number;
  };
  remaining: number;
  last_updated: Date;
}

/**
 * Cost center interface
 * Enhanced structure for cost center management
 */
export interface ICostCenter {
  code: string;
  name: string;
  description: string;
  active: boolean;
  manager: string;
  approvers: string[];
  budget: IBudget;
  actualSpend: {
    current: number;
    ytd: number;
    forecast: number;
  };
  forecasts: {
    nextQuarter: number;
    nextYear: number;
  };
  lastUpdated: Date;
  auditHistory: IAuditEntry[];
}

/**
 * Payment processing result interface
 * Detailed response for payment transactions
 */
export interface IPaymentResult {
  success: boolean;
  transactionId: string;
  status: PaymentStatus;
  timestamp: Date;
  details: {
    processingFee?: number;
    exchangeRate?: number;
    confirmationCode?: string;
  };
  auditTrail: IAuditEntry;
  errors?: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

/**
 * Synchronization result interface
 * Tracks financial data sync operations
 */
export interface ISyncResult {
  success: boolean;
  timestamp: Date;
  recordsProcessed: number;
  errors: Array<{
    code: string;
    message: string;
    entity: string;
    details: Record<string, unknown>;
  }>;
  summary: {
    added: number;
    updated: number;
    failed: number;
    skipped: number;
  };
}

/**
 * Financial service interface
 * Comprehensive interface for financial system integration
 */
export interface IFinancialService extends IBaseService {
  /**
   * Process a lease payment securely
   * Handles validation, processing, and audit trail creation
   * 
   * @param payment - Payment details to process
   * @param options - Additional processing options
   * @returns Promise resolving to payment processing result
   * @throws PaymentProcessingError for failed transactions
   */
  processLeasePayment(
    payment: ILeasePayment,
    options?: {
      priority?: boolean;
      retryAttempts?: number;
      idempotencyKey?: string;
    }
  ): Promise<IPaymentResult>;

  /**
   * Retrieve cost centers with budget information
   * Supports filtering and caching of results
   * 
   * @param activeOnly - Filter for active cost centers only
   * @param filters - Additional filtering criteria
   * @returns Promise resolving to array of cost centers
   */
  getCostCenters(
    activeOnly?: boolean,
    filters?: {
      manager?: string;
      budgetThreshold?: number;
      updatedSince?: Date;
    }
  ): Promise<ICostCenter[]>;

  /**
   * Synchronize financial data with external system
   * Ensures data integrity and maintains audit trail
   * 
   * @param syncOptions - Synchronization configuration options
   * @returns Promise resolving to sync operation result
   */
  syncFinancialData(
    syncOptions: {
      entities: ('payments' | 'costCenters' | 'budgets')[];
      fullSync?: boolean;
      validateOnly?: boolean;
      batchSize?: number;
    }
  ): Promise<ISyncResult>;
}

// Export all interfaces and types for financial integration
export {
  ILeasePayment,
  ICostCenter,
  IFinancialService,
  PaymentStatus,
  PaymentMethod,
  IAuditEntry,
  IBudget,
  IPaymentResult,
  ISyncResult
};