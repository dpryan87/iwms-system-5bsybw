// External imports
import { AxiosResponse } from 'axios'; // ^1.4.0

/**
 * Enum defining possible lease notification types for automated tracking
 * and alerting within the lease management system
 */
export enum NotificationType {
  RENEWAL_UPCOMING = 'RENEWAL_UPCOMING',
  PAYMENT_DUE = 'PAYMENT_DUE',
  ESCALATION_SCHEDULED = 'ESCALATION_SCHEDULED',
  DOCUMENT_EXPIRING = 'DOCUMENT_EXPIRING',
  TERM_VIOLATION = 'TERM_VIOLATION',
  MAINTENANCE_REQUIRED = 'MAINTENANCE_REQUIRED'
}

/**
 * Enum defining possible statuses for lease notifications
 * to track their lifecycle from creation to resolution
 */
export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED'
}

/**
 * Enum defining possible lease statuses
 */
export enum LeaseStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PENDING_RENEWAL = 'PENDING_RENEWAL',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED'
}

/**
 * Interface defining the structure of a lease document
 */
export interface LeaseDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
  expiryDate?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Interface defining lease terms and conditions
 */
export interface LeaseTerms {
  securityDeposit: number;
  noticePeriod: number;
  renewalOptions: {
    available: boolean;
    terms?: number;
    notificationPeriod?: number;
  };
  specialClauses: string[];
  restrictions: string[];
  maintenanceResponsibilities: {
    landlord: string[];
    tenant: string[];
  };
}

/**
 * Interface defining lease renewal information
 */
export interface LeaseRenewal {
  isEligible: boolean;
  deadlineDate: Date;
  proposedTerms?: {
    duration: number;
    monthlyRent: number;
    escalationRate?: number;
  };
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  lastNotificationDate?: Date;
}

/**
 * Interface defining payment schedule entries
 */
export interface PaymentSchedule {
  id: string;
  dueDate: Date;
  amount: number;
  type: 'RENT' | 'OPERATING_COSTS' | 'UTILITIES' | 'OTHER';
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  paidAmount?: number;
  paidDate?: Date;
  notes?: string;
}

/**
 * Interface defining rent escalation schedule
 */
export interface EscalationSchedule {
  id: string;
  effectiveDate: Date;
  percentage: number;
  baseAmount: number;
  newAmount: number;
  type: 'FIXED' | 'PERCENTAGE' | 'CPI';
  applied: boolean;
  appliedDate?: Date;
}

/**
 * Interface for comprehensive financial tracking of lease payments and terms
 */
export interface ILeaseFinancials {
  baseRent: number;
  operatingCosts: number;
  utilities: number;
  propertyTax: number;
  insurance: number;
  paymentSchedule: PaymentSchedule[];
  escalationSchedule: EscalationSchedule[];
  lastPaymentDate: Date;
  outstandingBalance: number;
}

/**
 * Interface for enhanced notification tracking within lease management
 */
export interface ILeaseNotification {
  id: string;
  type: NotificationType;
  triggerDate: Date;
  message: string;
  status: NotificationStatus;
  recipients: string[];
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

/**
 * Enhanced core interface defining the complete lease entity structure
 * with additional financial tracking and notification capabilities
 */
export interface ILease {
  id: string;
  propertyId: string;
  tenantId: string;
  status: LeaseStatus;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  annualRent: number;
  documents: LeaseDocument[];
  terms: LeaseTerms;
  renewal: LeaseRenewal;
  financials: ILeaseFinancials;
  notifications: ILeaseNotification[];
  createdAt: Date;
  updatedAt: Date;
  lastModifiedBy: string;
}

/**
 * Type definition for API responses containing lease data
 */
export type LeaseApiResponse = AxiosResponse<{
  data: ILease;
  success: boolean;
  message?: string;
}>;

/**
 * Type definition for API responses containing multiple leases
 */
export type LeasesApiResponse = AxiosResponse<{
  data: ILease[];
  total: number;
  page: number;
  pageSize: number;
  success: boolean;
  message?: string;
}>;

/**
 * Type for lease search/filter parameters
 */
export interface LeaseSearchParams {
  propertyId?: string;
  tenantId?: string;
  status?: LeaseStatus;
  startDateFrom?: Date;
  startDateTo?: Date;
  endDateFrom?: Date;
  endDateTo?: Date;
  rentRange?: {
    min: number;
    max: number;
  };
}

/**
 * Type for lease creation/update payload
 */
export type LeasePayload = Omit<ILease, 'id' | 'createdAt' | 'updatedAt' | 'lastModifiedBy'>;