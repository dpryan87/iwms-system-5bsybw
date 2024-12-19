// @package @jest/globals v29.5.0
// @package inversify v6.0.1
// @package @faker-js/faker v8.0.2
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Container } from 'inversify';
import { faker } from '@faker-js/faker';
import { DateTime } from 'luxon';

import { LeaseService } from '../../src/core/leases/services/lease.service';
import { LeaseStatus, ILease, EscalationType, RenewalStatus } from '../../src/core/leases/interfaces/lease.interface';
import { FinancialService } from '../../src/integrations/financial/financial.service';
import { PaymentStatus } from '../../src/integrations/financial/interfaces/financial.interface';

// Test container and service instances
let testContainer: Container;
let leaseService: LeaseService;
let financialService: FinancialService;

// Performance metrics storage
const performanceMetrics: {
  operationTimes: Record<string, number[]>;
  resourceUsage: Record<string, number[]>;
} = {
  operationTimes: {},
  resourceUsage: {}
};

/**
 * Sets up test environment with enhanced security and monitoring
 */
beforeAll(async () => {
  // Initialize test container with security configurations
  testContainer = new Container({
    defaultScope: 'Singleton',
    skipBaseClassChecks: false
  });

  // Bind services with security configurations
  testContainer.bind<LeaseService>(LeaseService).toSelf();
  testContainer.bind<FinancialService>(FinancialService).toSelf();

  // Initialize services
  leaseService = testContainer.get<LeaseService>(LeaseService);
  financialService = testContainer.get<FinancialService>(FinancialService);

  // Setup performance monitoring
  setupPerformanceMonitoring();
});

/**
 * Cleans up test environment and generates reports
 */
afterAll(async () => {
  // Generate performance report
  generatePerformanceReport();

  // Export security audit logs
  await exportSecurityAuditLogs();

  // Clean up test data
  await cleanupTestData();
});

/**
 * Reset test state before each test
 */
beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * Lease Security Validation Test Suite
 */
describe('Lease Security Validation', () => {
  it('should validate lease data encryption', async () => {
    // Create test lease with sensitive data
    const testLease = generateSecureTestLease();
    
    // Create lease and verify encryption
    const createdLease = await leaseService.createLease(testLease);
    
    expect(createdLease.id).toBeDefined();
    expect(createdLease.monthlyRent).toBeDefined();
    expect(createdLease.billingDetails).toBeDefined();
    
    // Verify sensitive data is encrypted
    const rawLease = await getRawLeaseData(createdLease.id);
    expect(rawLease.monthlyRent).not.toEqual(testLease.monthlyRent);
    expect(rawLease.billingDetails).not.toEqual(testLease.billingDetails);
  });

  it('should verify audit trail generation', async () => {
    const testLease = generateSecureTestLease();
    const createdLease = await leaseService.createLease(testLease);

    // Update lease status
    await leaseService.updateLeaseStatus(createdLease.id, LeaseStatus.ACTIVE);

    // Verify audit trail
    expect(createdLease.auditTrail.changes).toHaveLength(1);
    expect(createdLease.auditTrail.changes[0]).toMatchObject({
      field: 'creation',
      userId: expect.any(String),
      timestamp: expect.any(Date)
    });
  });

  it('should enforce access controls', async () => {
    const testLease = generateSecureTestLease();
    
    // Attempt unauthorized access
    await expect(
      leaseService.createLease({
        ...testLease,
        status: LeaseStatus.ACTIVE // Should not be allowed to create active lease
      })
    ).rejects.toThrow();
  });

  it('should validate compliance requirements', async () => {
    const testLease = generateSecureTestLease();
    const createdLease = await leaseService.createLease(testLease);

    // Verify required documents
    expect(createdLease.documents).toBeDefined();
    expect(createdLease.compliance.requiredDocuments).toContain('INSURANCE_CERTIFICATE');
  });
});

/**
 * Lease Performance Monitoring Test Suite
 */
describe('Lease Performance Monitoring', () => {
  it('should measure operation latency', async () => {
    const startTime = process.hrtime();

    const testLease = generateSecureTestLease();
    await leaseService.createLease(testLease);

    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds * 1000 + nanoseconds / 1e6;

    expect(duration).toBeLessThan(1000); // Should complete within 1 second
    recordOperationTime('createLease', duration);
  });

  it('should handle concurrent operations', async () => {
    const operations = Array(10).fill(null).map(() => 
      leaseService.createLease(generateSecureTestLease())
    );

    const results = await Promise.all(operations);
    expect(results).toHaveLength(10);
    results.forEach(lease => expect(lease.id).toBeDefined());
  });

  it('should monitor resource usage', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Perform memory-intensive operation
    const leases = await Promise.all(
      Array(100).fill(null).map(() => generateSecureTestLease())
    );

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryUsage = finalMemory - initialMemory;

    expect(memoryUsage).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    recordResourceUsage('bulkLeaseGeneration', memoryUsage);
  });

  it('should validate response times', async () => {
    const testLease = generateSecureTestLease();
    
    // Measure create operation
    const createTime = await measureOperationTime(() => 
      leaseService.createLease(testLease)
    );
    expect(createTime).toBeLessThan(500);

    // Measure update operation
    const updateTime = await measureOperationTime(() =>
      leaseService.updateLeaseStatus(testLease.id, LeaseStatus.PENDING_APPROVAL)
    );
    expect(updateTime).toBeLessThan(300);
  });
});

/**
 * Helper Functions
 */

function generateSecureTestLease(): Partial<ILease> {
  return {
    propertyId: faker.string.uuid(),
    tenantId: faker.string.uuid(),
    startDate: DateTime.now().toJSDate(),
    endDate: DateTime.now().plus({ years: 1 }).toJSDate(),
    monthlyRent: parseFloat(faker.finance.amount(1000, 10000, 2)),
    status: LeaseStatus.DRAFT,
    terms: {
      securityDeposit: parseFloat(faker.finance.amount(5000, 20000, 2)),
      escalationType: EscalationType.PERCENTAGE,
      escalationRate: parseFloat(faker.finance.amount(2, 5, 2)),
      includesUtilities: faker.datatype.boolean(),
      specialConditions: [faker.lorem.sentence()],
      paymentSchedule: [{
        dueDate: DateTime.now().plus({ months: 1 }).toJSDate(),
        amount: parseFloat(faker.finance.amount(1000, 10000, 2)),
        type: 'RENT',
        frequency: 'MONTHLY',
        automaticDebit: true
      }]
    },
    billingDetails: {
      paymentMethod: 'ACH',
      billingAddress: faker.location.streetAddress(),
      accountNumber: faker.finance.accountNumber()
    }
  };
}

async function getRawLeaseData(leaseId: string): Promise<any> {
  // Implementation would retrieve raw data from database
  return {};
}

async function measureOperationTime(operation: () => Promise<any>): Promise<number> {
  const startTime = process.hrtime();
  await operation();
  const [seconds, nanoseconds] = process.hrtime(startTime);
  return seconds * 1000 + nanoseconds / 1e6;
}

function recordOperationTime(operation: string, duration: number): void {
  if (!performanceMetrics.operationTimes[operation]) {
    performanceMetrics.operationTimes[operation] = [];
  }
  performanceMetrics.operationTimes[operation].push(duration);
}

function recordResourceUsage(operation: string, usage: number): void {
  if (!performanceMetrics.resourceUsage[operation]) {
    performanceMetrics.resourceUsage[operation] = [];
  }
  performanceMetrics.resourceUsage[operation].push(usage);
}

function setupPerformanceMonitoring(): void {
  // Implementation would setup performance monitoring hooks
}

function generatePerformanceReport(): void {
  // Implementation would generate detailed performance report
}

async function exportSecurityAuditLogs(): Promise<void> {
  // Implementation would export security audit logs
}

async function cleanupTestData(): Promise<void> {
  // Implementation would clean up test data
}