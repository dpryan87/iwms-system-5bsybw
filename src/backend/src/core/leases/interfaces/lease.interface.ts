// @package luxon v3.4.3 - For date handling
import { DateTime } from 'luxon';
import { IBaseService } from '../../../common/interfaces/service.interface';

/**
 * Comprehensive lease status enumeration
 * Tracks complete lifecycle of lease agreements
 */
export enum LeaseStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  PENDING_RENEWAL = 'PENDING_RENEWAL',
  IN_RENEWAL_NEGOTIATION = 'IN_RENEWAL_NEGOTIATION',
  RENEWED = 'RENEWED',
  PENDING_TERMINATION = 'PENDING_TERMINATION',
  TERMINATED = 'TERMINATED',
  EXPIRED = 'EXPIRED',
  IN_DISPUTE = 'IN_DISPUTE',
  ON_HOLD = 'ON_HOLD'
}

/**
 * Enhanced lease escalation types
 * Supports international lease standards
 */
export enum EscalationType {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
  CPI = 'CPI',
  MARKET_RATE = 'MARKET_RATE',
  STEPPED = 'STEPPED',
  HYBRID = 'HYBRID',
  INDEXED = 'INDEXED',
  NONE = 'NONE'
}

/**
 * Document status tracking
 */
export enum DocumentStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
  ARCHIVED = 'ARCHIVED'
}

/**
 * Renewal workflow status tracking
 */
export enum RenewalStatus {
  NOT_DUE = 'NOT_DUE',
  UPCOMING = 'UPCOMING',
  PENDING = 'PENDING',
  IN_NEGOTIATION = 'IN_NEGOTIATION',
  TERMS_PROPOSED = 'TERMS_PROPOSED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  COMPLETED = 'COMPLETED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED'
}

/**
 * Document access tracking interface
 */
export interface DocumentAccess {
  userId: string;
  accessTime: DateTime;
  action: 'VIEW' | 'DOWNLOAD' | 'PRINT';
  ipAddress: string;
  userAgent: string;
}

/**
 * Document metadata interface
 */
export interface DocumentMetadata {
  title: string;
  description?: string;
  tags: string[];
  category: string;
  retention: {
    period: number;
    unit: 'DAYS' | 'MONTHS' | 'YEARS';
    expiryDate: DateTime;
  };
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
}

/**
 * Enhanced lease document interface
 */
export interface ILeaseDocument {
  id: string;
  leaseId: string;
  fileName: string;
  fileType: string;
  storageUrl: string;
  uploadDate: DateTime;
  version: string;
  uploadedBy: string;
  status: DocumentStatus;
  accessLog: DocumentAccess[];
  checksum: string;
  metadata: DocumentMetadata;
}

/**
 * Payment schedule interface
 */
export interface PaymentSchedule {
  dueDate: DateTime;
  amount: number;
  type: 'RENT' | 'CAM' | 'UTILITIES' | 'TAXES' | 'INSURANCE';
  frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  automaticDebit: boolean;
  accountDetails?: {
    accountNumber: string;
    routingNumber: string;
    bankName: string;
  };
}

/**
 * Escalation schedule interface
 */
export interface EscalationSchedule {
  effectiveDate: DateTime;
  type: EscalationType;
  rate: number;
  baseAmount: number;
  cappedAt?: number;
  floorAt?: number;
  indexReference?: string;
}

/**
 * Utility details interface
 */
export interface UtilityDetails {
  includedUtilities: string[];
  separatelyMetered: boolean;
  responsibleParty: 'TENANT' | 'LANDLORD';
  allocationMethod?: string;
  estimatedMonthlyCost?: number;
}

/**
 * Insurance requirements interface
 */
export interface InsuranceRequirements {
  generalLiability: number;
  propertyDamage: number;
  businessInterruption: boolean;
  certificates: ILeaseDocument[];
  expiryDate: DateTime;
  insuranceProvider: string;
}

/**
 * Maintenance terms interface
 */
export interface MaintenanceTerms {
  responsibleParty: 'TENANT' | 'LANDLORD';
  includedServices: string[];
  frequency: string;
  specialConditions?: string[];
  costAllocation?: {
    tenant: number;
    landlord: number;
  };
}

/**
 * Penalty terms interface
 */
export interface PenaltyTerms {
  latePayment: {
    gracePeriod: number;
    rate: number;
    calculationMethod: string;
  };
  earlyTermination: {
    allowed: boolean;
    noticePeriod: number;
    penalty: number;
  };
  defaultTerms: string[];
}

/**
 * Comprehensive lease terms interface
 */
export interface ILeaseTerms {
  securityDeposit: number;
  escalationRate: number;
  escalationType: EscalationType;
  includesUtilities: boolean;
  specialConditions: string[];
  paymentSchedule: PaymentSchedule[];
  escalationSchedule: EscalationSchedule[];
  utilityDetails: UtilityDetails;
  insurance: InsuranceRequirements;
  maintenance: MaintenanceTerms;
  penalties: PenaltyTerms;
}

/**
 * Renewal history interface
 */
export interface RenewalHistory {
  renewalDate: DateTime;
  previousTerms: ILeaseTerms;
  newTerms: ILeaseTerms;
  negotiationDuration: number;
  approvedBy: string;
  documents: ILeaseDocument[];
}

/**
 * Negotiation details interface
 */
export interface NegotiationDetails {
  startDate: DateTime;
  participants: string[];
  proposedTerms: ILeaseTerms[];
  counterOffers: ILeaseTerms[];
  currentProposal: ILeaseTerms;
  notes: string[];
  status: 'ACTIVE' | 'ACCEPTED' | 'REJECTED';
}

/**
 * Renewal metrics interface
 */
export interface RenewalMetrics {
  timeToRenewal: number;
  negotiationEfficiency: number;
  costVariance: number;
  marketComparison: {
    rate: number;
    variance: number;
  };
}

/**
 * Enhanced lease renewal interface
 */
export interface ILeaseRenewal {
  notificationDate: DateTime;
  noticePeriodDays: number;
  status: RenewalStatus;
  renewalOptions: string[];
  history: RenewalHistory[];
  negotiations: NegotiationDetails;
  scheduledActions: Array<{
    date: DateTime;
    action: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
  }>;
  proposedTerms: ILeaseTerms;
  assignedAgent: string;
  performanceMetrics: RenewalMetrics;
}

/**
 * Lease audit trail interface
 */
export interface LeaseAudit {
  changes: Array<{
    timestamp: DateTime;
    userId: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
    reason?: string;
  }>;
  reviews: Array<{
    timestamp: DateTime;
    reviewerId: string;
    status: 'APPROVED' | 'REJECTED' | 'PENDING';
    comments: string;
  }>;
}

/**
 * Lease compliance interface
 */
export interface LeaseCompliance {
  requiredDocuments: string[];
  submittedDocuments: ILeaseDocument[];
  certifications: ILeaseDocument[];
  inspections: Array<{
    date: DateTime;
    type: string;
    status: 'PASSED' | 'FAILED' | 'PENDING';
    findings: string[];
  }>;
  violations: Array<{
    date: DateTime;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    status: 'OPEN' | 'RESOLVED';
  }>;
}

/**
 * Lease billing interface
 */
export interface LeaseBilling {
  paymentMethod: 'ACH' | 'CHECK' | 'WIRE' | 'OTHER';
  billingAddress: string;
  taxInformation: {
    taxId: string;
    taxRate: number;
    taxExempt: boolean;
  };
  accountingCodes: {
    revenueAccount: string;
    receivableAccount: string;
    depositAccount: string;
  };
}

/**
 * Lease notification interface
 */
export interface LeaseNotification {
  id: string;
  type: 'RENEWAL' | 'PAYMENT' | 'COMPLIANCE' | 'MAINTENANCE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  recipients: string[];
  sentDate: DateTime;
  status: 'PENDING' | 'SENT' | 'FAILED';
}

/**
 * Comprehensive lease interface
 */
export interface ILease {
  id: string;
  propertyId: string;
  tenantId: string;
  status: LeaseStatus;
  startDate: DateTime;
  endDate: DateTime;
  monthlyRent: number;
  documents: ILeaseDocument[];
  terms: ILeaseTerms;
  renewal: ILeaseRenewal;
  auditTrail: LeaseAudit;
  compliance: LeaseCompliance;
  billingDetails: LeaseBilling;
  notifications: LeaseNotification[];
}

/**
 * Lease service interface extending base service
 */
export interface ILeaseService extends IBaseService {
  createLease(lease: Partial<ILease>): Promise<ILease>;
  updateLease(id: string, updates: Partial<ILease>): Promise<ILease>;
  getLease(id: string): Promise<ILease>;
  deleteLease(id: string): Promise<void>;
  processRenewal(leaseId: string): Promise<ILeaseRenewal>;
  validateCompliance(leaseId: string): Promise<boolean>;
  generateNotifications(leaseId: string): Promise<LeaseNotification[]>;
}