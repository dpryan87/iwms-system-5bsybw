// @package joi v17.9.0 - Schema validation library
import Joi from 'joi';
import { LeaseStatus, EscalationType, RenewalStatus } from '../interfaces/lease.interface';

// Global constants for validation rules
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const MAX_LEASE_TERM_YEARS = 99;
const MIN_SECURITY_DEPOSIT = 0;

/**
 * Enhanced validation schema for lease document metadata
 * Includes security features and versioning requirements
 */
export const leaseDocumentSchema = Joi.object({
  id: Joi.string().uuid().required()
    .description('Unique identifier for the document'),
  leaseId: Joi.string().uuid().required()
    .description('Associated lease identifier'),
  fileName: Joi.string().required().max(255)
    .pattern(/^[\w\-. ]+$/)
    .description('Document file name with safe characters only'),
  fileType: Joi.string().valid(...ALLOWED_FILE_TYPES).required()
    .description('Allowed document file types'),
  fileSize: Joi.number().max(MAX_FILE_SIZE).required()
    .description('File size in bytes, maximum 25MB'),
  version: Joi.string().required()
    .pattern(/^\d+\.\d+\.\d+$/)
    .description('Semantic version number'),
  checksum: Joi.string().required().length(64)
    .description('SHA-256 file checksum'),
  status: Joi.string().valid('DRAFT', 'FINAL').required()
    .description('Document status'),
  uploadedBy: Joi.string().uuid().required()
    .description('User ID of uploader'),
  uploadDate: Joi.date().iso().required()
    .description('Document upload timestamp'),
  metadata: Joi.object({
    title: Joi.string().required(),
    description: Joi.string(),
    tags: Joi.array().items(Joi.string()),
    classification: Joi.string().valid('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED').required(),
    retention: Joi.object({
      period: Joi.number().required(),
      unit: Joi.string().valid('DAYS', 'MONTHS', 'YEARS').required(),
      expiryDate: Joi.date().iso().required()
    })
  }).required(),
  accessLog: Joi.array().items(Joi.object({
    userId: Joi.string().uuid().required(),
    timestamp: Joi.date().iso().required(),
    action: Joi.string().valid('VIEW', 'DOWNLOAD', 'PRINT').required(),
    ipAddress: Joi.string().ip().required(),
    userAgent: Joi.string().required()
  }))
});

/**
 * Extended validation schema for lease terms
 * Includes comprehensive business rules and compliance requirements
 */
export const leaseTermsSchema = Joi.object({
  securityDeposit: Joi.number().min(MIN_SECURITY_DEPOSIT).required()
    .description('Security deposit amount'),
  escalationType: Joi.string().valid(...Object.values(EscalationType)).required()
    .description('Type of rent escalation'),
  escalationRate: Joi.number().min(0).max(100).when('escalationType', {
    is: EscalationType.PERCENTAGE,
    then: Joi.required()
  }).description('Escalation rate percentage'),
  paymentSchedule: Joi.object({
    frequency: Joi.string().valid('MONTHLY', 'QUARTERLY', 'ANNUALLY').required(),
    dueDay: Joi.number().min(1).max(31).required(),
    automaticDebit: Joi.boolean(),
    accountDetails: Joi.object({
      accountNumber: Joi.string().pattern(/^\d+$/).required(),
      routingNumber: Joi.string().pattern(/^\d{9}$/).required(),
      bankName: Joi.string().required()
    }).when('automaticDebit', { is: true, then: Joi.required() })
  }).required(),
  utilityDetails: Joi.object({
    includedUtilities: Joi.array().items(Joi.string()),
    separatelyMetered: Joi.boolean().required(),
    responsibleParty: Joi.string().valid('TENANT', 'LANDLORD').required(),
    allocationMethod: Joi.string().when('separatelyMetered', {
      is: false,
      then: Joi.required()
    })
  }).required(),
  insuranceRequirements: Joi.array().items(Joi.object({
    type: Joi.string().required(),
    coverage: Joi.number().positive().required(),
    provider: Joi.string(),
    expiryDate: Joi.date().iso().required()
  })).min(1).required(),
  maintenanceTerms: Joi.object({
    responsibilities: Joi.array().items(Joi.string()).required(),
    schedule: Joi.string().required(),
    costAllocation: Joi.object({
      tenant: Joi.number().min(0).max(100).required(),
      landlord: Joi.number().min(0).max(100).required()
    }).custom((value, helpers) => {
      if (value.tenant + value.landlord !== 100) {
        return helpers.error('Cost allocation must total 100%');
      }
      return value;
    })
  }).required(),
  penaltyTerms: Joi.object({
    latePayment: Joi.object({
      rate: Joi.number().min(0).max(100).required(),
      gracePeriod: Joi.number().min(0).required()
    }).required(),
    earlyTermination: Joi.object({
      allowed: Joi.boolean().required(),
      penalty: Joi.number().min(0).when('allowed', {
        is: true,
        then: Joi.required()
      })
    }).required()
  }).required()
});

/**
 * Comprehensive validation schema for lease renewals
 * Includes workflow validation and negotiation tracking
 */
export const leaseRenewalSchema = Joi.object({
  status: Joi.string().valid(...Object.values(RenewalStatus)).required()
    .description('Current renewal status'),
  notificationDate: Joi.date().iso().required()
    .description('Date when renewal notification was sent'),
  noticePeriodDays: Joi.number().min(0).required()
    .description('Required notice period in days'),
  proposedTerms: leaseTermsSchema.when('status', {
    is: Joi.string().valid('IN_NEGOTIATION', 'TERMS_PROPOSED'),
    then: Joi.required()
  }),
  negotiations: Joi.object({
    startDate: Joi.date().iso().required(),
    participants: Joi.array().items(Joi.string().uuid()).min(1).required(),
    proposedTerms: Joi.array().items(leaseTermsSchema),
    status: Joi.string().valid('ACTIVE', 'ACCEPTED', 'REJECTED').required()
  }).when('status', {
    is: Joi.string().valid('IN_NEGOTIATION'),
    then: Joi.required()
  })
});

/**
 * Main validation schema for lease entities
 * Enforces comprehensive data validation and security requirements
 */
export const leaseSchema = Joi.object({
  id: Joi.string().uuid().required()
    .description('Unique lease identifier'),
  propertyId: Joi.string().uuid().required()
    .description('Associated property identifier'),
  tenantId: Joi.string().uuid().required()
    .description('Associated tenant identifier'),
  status: Joi.string().valid(...Object.values(LeaseStatus)).required()
    .description('Current lease status'),
  startDate: Joi.date().iso().required()
    .description('Lease start date'),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required()
    .custom((value, helpers) => {
      const start = new Date(helpers.state.ancestors[0].startDate);
      const end = new Date(value);
      const yearsDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (yearsDiff > MAX_LEASE_TERM_YEARS) {
        return helpers.error('Lease term cannot exceed 99 years');
      }
      return value;
    })
    .description('Lease end date'),
  monthlyRent: Joi.number().positive().precision(2).required()
    .description('Monthly rent amount'),
  documents: Joi.array().items(leaseDocumentSchema)
    .description('Associated lease documents'),
  terms: leaseTermsSchema.required()
    .description('Lease terms and conditions'),
  renewal: leaseRenewalSchema
    .description('Lease renewal information'),
  complianceChecks: Joi.array().items(Joi.object({
    type: Joi.string().required(),
    status: Joi.string().valid('PASSED', 'FAILED', 'PENDING').required(),
    date: Joi.date().iso().required(),
    findings: Joi.array().items(Joi.string())
  })),
  auditTrail: Joi.array().items(Joi.object({
    action: Joi.string().required(),
    userId: Joi.string().uuid().required(),
    timestamp: Joi.date().iso().required(),
    details: Joi.string().required()
  })),
  billingDetails: Joi.object({
    paymentMethod: Joi.string().valid('ACH', 'CHECK', 'WIRE', 'OTHER').required(),
    billingAddress: Joi.string().required(),
    accountNumber: Joi.string().when('paymentMethod', {
      is: 'ACH',
      then: Joi.required()
    })
  }).required(),
  notificationSettings: Joi.object({
    renewalReminder: Joi.number().min(0).required(),
    paymentReminder: Joi.number().min(0).required()
  }).required()
});