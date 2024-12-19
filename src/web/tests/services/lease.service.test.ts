// External imports with versions
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import MockDate from 'mockdate'; // ^3.0.0
import * as CryptoJS from 'crypto-js'; // ^4.1.1

// Internal imports
import LeaseService from '../../src/services/lease.service';
import { 
  ILease, 
  LeaseStatus, 
  NotificationType,
  NotificationStatus,
  ILeaseFinancials,
  LeaseDocument
} from '../../src/types/lease.types';

// Mock configurations
jest.mock('crypto-js');
jest.mock('winston');

describe('LeaseService', () => {
  // Test data setup
  const mockEncryptionKey = 'test-encryption-key-123';
  const mockCurrentDate = '2023-01-01T00:00:00.000Z';
  
  const mockLeaseFinancials: ILeaseFinancials = {
    baseRent: 5000,
    operatingCosts: 1000,
    utilities: 500,
    propertyTax: 800,
    insurance: 300,
    paymentSchedule: [{
      id: '1',
      dueDate: new Date('2023-02-01'),
      amount: 5000,
      type: 'RENT',
      status: 'PENDING'
    }],
    escalationSchedule: [{
      id: '1',
      effectiveDate: new Date('2024-01-01'),
      percentage: 3,
      baseAmount: 5000,
      newAmount: 5150,
      type: 'PERCENTAGE',
      applied: false
    }],
    lastPaymentDate: new Date('2023-01-01'),
    outstandingBalance: 0
  };

  const mockLease: Omit<ILease, 'id'> = {
    propertyId: 'prop-123',
    tenantId: 'tenant-456',
    status: LeaseStatus.ACTIVE,
    startDate: new Date('2023-01-01'),
    endDate: new Date('2024-01-01'),
    monthlyRent: 5000,
    annualRent: 60000,
    documents: [],
    terms: {
      securityDeposit: 10000,
      noticePeriod: 60,
      renewalOptions: {
        available: true,
        terms: 12,
        notificationPeriod: 90
      },
      specialClauses: [],
      restrictions: [],
      maintenanceResponsibilities: {
        landlord: [],
        tenant: []
      }
    },
    renewal: {
      isEligible: true,
      deadlineDate: new Date('2023-10-01'),
      status: 'PENDING'
    },
    financials: mockLeaseFinancials,
    notifications: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastModifiedBy: 'user-123'
  };

  // Setup and teardown
  beforeEach(() => {
    process.env.REACT_APP_LEASE_ENCRYPTION_KEY = mockEncryptionKey;
    process.env.REACT_APP_API_BASE_URL = 'http://test-api.com';
    MockDate.set(mockCurrentDate);
    jest.clearAllMocks();
  });

  afterEach(() => {
    MockDate.reset();
    jest.resetAllMocks();
  });

  // Test suites
  describe('Lease Creation', () => {
    test('should successfully create a new lease with encrypted data', async () => {
      // Mock encryption
      (CryptoJS.AES.encrypt as jest.Mock).mockReturnValue({
        toString: () => 'encrypted-data'
      });
      
      (CryptoJS.HmacSHA256 as jest.Mock).mockReturnValue({
        toString: () => 'request-signature'
      });

      const makeSecureApiCallSpy = jest.spyOn(LeaseService as any, 'makeSecureApiCall')
        .mockResolvedValue({ data: { data: { ...mockLease, id: 'lease-123' } } });

      const result = await LeaseService.createNewLease(mockLease);

      expect(result).toBeDefined();
      expect(result.id).toBe('lease-123');
      expect(CryptoJS.AES.encrypt).toHaveBeenCalled();
      expect(makeSecureApiCallSpy).toHaveBeenCalledWith(
        'POST',
        '/leases',
        expect.objectContaining({
          data: expect.any(Object),
          signature: 'request-signature',
          timestamp: mockCurrentDate
        })
      );
    });

    test('should validate lease data before creation', async () => {
      const invalidLease = { ...mockLease, startDate: new Date('2024-01-01') };
      
      await expect(LeaseService.createNewLease(invalidLease))
        .rejects
        .toThrow('Invalid lease date range');
    });
  });

  describe('Document Management', () => {
    const mockDocument = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    test('should successfully upload and encrypt a document', async () => {
      // Mock document encryption
      (CryptoJS.lib.WordArray.create as jest.Mock).mockReturnValue('word-array');
      (CryptoJS.AES.encrypt as jest.Mock).mockReturnValue({
        toString: () => 'encrypted-document'
      });
      (CryptoJS.SHA256 as jest.Mock).mockReturnValue({
        toString: () => 'document-checksum'
      });

      const makeSecureApiCallSpy = jest.spyOn(LeaseService as any, 'makeSecureApiCall')
        .mockResolvedValue({
          data: {
            data: {
              id: 'doc-123',
              name: 'test.pdf',
              type: 'application/pdf',
              url: 'https://test-url.com/doc-123',
              uploadedAt: new Date(),
              uploadedBy: 'user-123'
            }
          }
        });

      const result = await LeaseService.uploadDocument('lease-123', mockDocument);

      expect(result).toBeDefined();
      expect(result.id).toBe('doc-123');
      expect(CryptoJS.AES.encrypt).toHaveBeenCalled();
      expect(makeSecureApiCallSpy).toHaveBeenCalledWith(
        'POST',
        '/leases/lease-123/documents',
        expect.any(FormData),
        { 'Content-Type': 'multipart/form-data' }
      );
    });

    test('should validate document size and type', async () => {
      const largeMockDocument = new File(['large content'], 'large.pdf', {
        type: 'application/pdf'
      });
      Object.defineProperty(largeMockDocument, 'size', { value: 30 * 1024 * 1024 });

      await expect(LeaseService.uploadDocument('lease-123', largeMockDocument))
        .rejects
        .toThrow('Document size exceeds maximum allowed size');
    });
  });

  describe('Financial Validation', () => {
    test('should validate lease financials correctly', () => {
      const result = LeaseService.validateFinancials(mockLeaseFinancials);
      expect(result).toBe(true);
    });

    test('should reject invalid financial data', () => {
      const invalidFinancials = {
        ...mockLeaseFinancials,
        baseRent: 0
      };

      expect(() => LeaseService.validateFinancials(invalidFinancials))
        .toThrow('Invalid base rent amount');
    });

    test('should validate payment schedule totals', () => {
      const invalidSchedule = {
        ...mockLeaseFinancials,
        paymentSchedule: [{
          id: '1',
          dueDate: new Date('2023-02-01'),
          amount: 4000, // Incorrect amount
          type: 'RENT',
          status: 'PENDING'
        }]
      };

      expect(() => LeaseService.validateFinancials(invalidSchedule))
        .toThrow('Payment schedule amounts do not match annual rent');
    });
  });

  describe('Audit Logging', () => {
    test('should generate secure audit log entries', async () => {
      const makeSecureApiCallSpy = jest.spyOn(LeaseService as any, 'makeSecureApiCall')
        .mockResolvedValue({});

      await LeaseService.generateAuditLog('CREATE_LEASE', 'lease-123', 'Test lease creation');

      expect(makeSecureApiCallSpy).toHaveBeenCalledWith(
        'POST',
        '/audit-logs',
        expect.objectContaining({
          data: expect.any(Object)
        })
      );
    });

    test('should include required audit information', async () => {
      const generateAuditLogSpy = jest.spyOn(LeaseService as any, 'generateAuditLog');
      
      await LeaseService.createNewLease(mockLease);

      expect(generateAuditLogSpy).toHaveBeenCalledWith(
        'CREATE_LEASE',
        expect.any(String)
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle authentication errors', async () => {
      jest.spyOn(LeaseService as any, 'makeSecureApiCall')
        .mockRejectedValue({ response: { status: 401 } });

      await expect(LeaseService.createNewLease(mockLease))
        .rejects
        .toThrow('Authentication required');
    });

    test('should handle permission errors', async () => {
      jest.spyOn(LeaseService as any, 'makeSecureApiCall')
        .mockRejectedValue({ response: { status: 403 } });

      await expect(LeaseService.createNewLease(mockLease))
        .rejects
        .toThrow('Insufficient permissions');
    });

    test('should sanitize sensitive data in error logs', async () => {
      const error = new Error('Test error');
      const handleServiceErrorSpy = jest.spyOn(LeaseService as any, 'handleServiceError');
      
      jest.spyOn(LeaseService as any, 'makeSecureApiCall')
        .mockRejectedValue(error);

      await expect(LeaseService.createNewLease(mockLease))
        .rejects
        .toThrow();

      expect(handleServiceErrorSpy).toHaveBeenCalledWith(error);
    });
  });
});