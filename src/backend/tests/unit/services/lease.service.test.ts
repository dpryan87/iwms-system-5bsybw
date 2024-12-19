// @package jest v29.5.0 - Testing framework
// @package @faker-js/faker v8.0.0 - Test data generation
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { faker } from '@faker-js/faker';

import { LeaseService } from '../../../src/core/leases/services/lease.service';
import { 
  ILease, 
  LeaseStatus, 
  ILeaseDocument,
  ILeasePayment 
} from '../../../src/core/leases/interfaces/lease.interface';

// Test constants
const TEST_TIMEOUT = 10000;
const MOCK_RETRY_ATTEMPTS = 3;
const PERFORMANCE_THRESHOLD_MS = 100;

describe('LeaseService', () => {
  // Mock dependencies
  let mockLeaseRepository: jest.Mock;
  let mockFinancialService: jest.Mock;
  let mockLogger: jest.Mock;
  let mockNotificationService: jest.Mock;
  let leaseService: LeaseService;

  // Test data
  let testLease: Partial<ILease>;
  let testDocument: ILeaseDocument;
  let testPayment: ILeasePayment;

  beforeEach(async () => {
    // Initialize mocks
    mockLeaseRepository = {
      createLease: jest.fn(),
      updateLease: jest.fn(),
      findOneOrFail: jest.fn(),
      findExpiringLeases: jest.fn()
    };

    mockFinancialService = {
      processLeasePayment: jest.fn(),
      syncFinancialData: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    mockNotificationService = {
      sendLeaseCreated: jest.fn(),
      sendLeaseStatusChanged: jest.fn(),
      sendPaymentProcessed: jest.fn()
    };

    // Initialize service
    leaseService = new LeaseService(
      mockLeaseRepository,
      mockFinancialService,
      mockLogger
    );

    // Generate test data
    testLease = {
      id: faker.string.uuid(),
      propertyId: faker.string.uuid(),
      tenantId: faker.string.uuid(),
      status: LeaseStatus.DRAFT,
      startDate: faker.date.future(),
      endDate: faker.date.future({ years: 2 }),
      monthlyRent: faker.number.float({ min: 1000, max: 10000 }),
      documents: [],
      terms: {
        securityDeposit: faker.number.float({ min: 1000, max: 5000 }),
        escalationRate: faker.number.float({ min: 1, max: 5 }),
        paymentSchedule: []
      }
    };

    testDocument = {
      id: faker.string.uuid(),
      leaseId: testLease.id!,
      fileName: 'lease_agreement.pdf',
      fileType: 'application/pdf',
      storageUrl: faker.internet.url(),
      uploadDate: new Date(),
      version: '1.0.0',
      uploadedBy: faker.string.uuid(),
      status: 'ACTIVE',
      accessLog: [],
      checksum: faker.string.alphanumeric(64),
      metadata: {
        title: 'Lease Agreement',
        tags: ['agreement', 'signed'],
        category: 'legal',
        classification: 'CONFIDENTIAL',
        retention: {
          period: 7,
          unit: 'YEARS',
          expiryDate: faker.date.future({ years: 7 })
        }
      }
    };

    testPayment = {
      id: faker.string.uuid(),
      leaseId: testLease.id!,
      amount: testLease.monthlyRent!,
      currency: 'USD',
      dueDate: faker.date.future(),
      status: 'PENDING',
      paymentMethod: 'ACH',
      processingGateway: 'default',
      securityHash: '',
      auditTrail: []
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createLease', () => {
    it('should create a new lease successfully', async () => {
      // Arrange
      mockLeaseRepository.createLease.mockResolvedValue(testLease);
      mockFinancialService.syncFinancialData.mockResolvedValue({ success: true });

      // Act
      const result = await leaseService.createLease(testLease);

      // Assert
      expect(result).toEqual(testLease);
      expect(mockLeaseRepository.createLease).toHaveBeenCalledWith(
        expect.objectContaining({
          status: LeaseStatus.DRAFT,
          auditTrail: expect.any(Object)
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Lease created successfully',
        expect.any(Object)
      );
    }, TEST_TIMEOUT);

    it('should validate lease data before creation', async () => {
      // Arrange
      const invalidLease = { ...testLease, propertyId: undefined };

      // Act & Assert
      await expect(leaseService.createLease(invalidLease))
        .rejects
        .toThrow('Invalid lease data');
      expect(mockLeaseRepository.createLease).not.toHaveBeenCalled();
    });

    it('should handle financial setup errors gracefully', async () => {
      // Arrange
      mockLeaseRepository.createLease.mockResolvedValue(testLease);
      mockFinancialService.syncFinancialData.mockRejectedValue(new Error('Financial sync failed'));

      // Act & Assert
      await expect(leaseService.createLease(testLease))
        .rejects
        .toThrow('Financial sync failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('updateLeaseStatus', () => {
    it('should update lease status with valid transition', async () => {
      // Arrange
      const currentLease = { ...testLease, status: LeaseStatus.DRAFT };
      mockLeaseRepository.findOneOrFail.mockResolvedValue(currentLease);
      mockLeaseRepository.updateLease.mockResolvedValue({
        ...currentLease,
        status: LeaseStatus.ACTIVE
      });

      // Act
      const result = await leaseService.updateLeaseStatus(
        testLease.id!,
        LeaseStatus.ACTIVE
      );

      // Assert
      expect(result.status).toBe(LeaseStatus.ACTIVE);
      expect(mockLeaseRepository.updateLease).toHaveBeenCalledWith(
        testLease.id,
        expect.objectContaining({
          status: LeaseStatus.ACTIVE,
          auditTrail: expect.any(Object)
        })
      );
    });

    it('should reject invalid status transitions', async () => {
      // Arrange
      const currentLease = { ...testLease, status: LeaseStatus.DRAFT };
      mockLeaseRepository.findOneOrFail.mockResolvedValue(currentLease);

      // Act & Assert
      await expect(leaseService.updateLeaseStatus(
        testLease.id!,
        LeaseStatus.EXPIRED
      )).rejects.toThrow('Invalid status transition');
    });

    it('should sync with financial system for relevant status changes', async () => {
      // Arrange
      const currentLease = { ...testLease, status: LeaseStatus.PENDING_APPROVAL };
      mockLeaseRepository.findOneOrFail.mockResolvedValue(currentLease);
      mockLeaseRepository.updateLease.mockResolvedValue({
        ...currentLease,
        status: LeaseStatus.ACTIVE
      });

      // Act
      await leaseService.updateLeaseStatus(testLease.id!, LeaseStatus.ACTIVE);

      // Assert
      expect(mockFinancialService.syncFinancialData).toHaveBeenCalled();
    });
  });

  describe('processLeasePayment', () => {
    it('should process payment successfully', async () => {
      // Arrange
      mockLeaseRepository.findOneOrFail.mockResolvedValue(testLease);
      mockFinancialService.processLeasePayment.mockResolvedValue({
        success: true,
        transactionId: faker.string.uuid()
      });

      // Act
      const result = await leaseService.processLeasePayment(
        testLease.id!,
        testLease.monthlyRent!
      );

      // Assert
      expect(result).toBe(true);
      expect(mockFinancialService.processLeasePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          leaseId: testLease.id,
          amount: testLease.monthlyRent
        })
      );
    });

    it('should validate payment amount', async () => {
      // Arrange
      mockLeaseRepository.findOneOrFail.mockResolvedValue(testLease);

      // Act & Assert
      await expect(leaseService.processLeasePayment(
        testLease.id!,
        -100
      )).rejects.toThrow('Invalid payment amount');
    });

    it('should handle payment processing failures with retry', async () => {
      // Arrange
      mockLeaseRepository.findOneOrFail.mockResolvedValue(testLease);
      mockFinancialService.processLeasePayment
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce({ success: true, transactionId: faker.string.uuid() });

      // Act
      const result = await leaseService.processLeasePayment(
        testLease.id!,
        testLease.monthlyRent!
      );

      // Assert
      expect(result).toBe(true);
      expect(mockFinancialService.processLeasePayment).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkLeaseRenewals', () => {
    it('should identify and process expiring leases', async () => {
      // Arrange
      const expiringLeases = [
        { ...testLease, endDate: faker.date.soon() }
      ];
      mockLeaseRepository.findExpiringLeases.mockResolvedValue(expiringLeases);

      // Act
      await (leaseService as any).checkLeaseRenewals();

      // Assert
      expect(mockLeaseRepository.findExpiringLeases).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Lease renewal check completed',
        expect.any(Object)
      );
    });

    it('should handle renewal processing errors gracefully', async () => {
      // Arrange
      mockLeaseRepository.findExpiringLeases.mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect((leaseService as any).checkLeaseRenewals())
        .rejects
        .toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});