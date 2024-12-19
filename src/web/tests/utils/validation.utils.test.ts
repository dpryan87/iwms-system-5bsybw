// @package jest ^29.0.0 - Testing framework and assertions
// @package jest-performance ^1.0.0 - Performance testing utilities

import { 
  validateEmail, 
  validatePassword, 
  validateFloorPlan,
  validateLeaseTerms,
  sanitizeInput 
} from '../../src/utils/validation.utils';
import { FloorPlan, FloorPlanStatus, SpaceType, MeasurementUnit } from '../../src/types/floor-plan.types';
import { ILease, LeaseStatus } from '../../src/types/lease.types';
import { performance } from 'jest-performance';

describe('validateEmail', () => {
  // Standard email validation tests
  test('should validate correct email formats', () => {
    const validEmails = [
      'user@domain.com',
      'user.name@domain.com',
      'user+label@domain.com',
      'user@subdomain.domain.com'
    ];
    validEmails.forEach(email => {
      expect(validateEmail(email)).toBe(true);
    });
  });

  // International email validation tests
  test('should handle international email formats', () => {
    const internationalEmails = [
      'user@domain.co.uk',
      'user@domain.com.au',
      'user@domain.eu'
    ];
    internationalEmails.forEach(email => {
      expect(validateEmail(email)).toBe(true);
    });
  });

  // Security test cases
  test('should reject potentially malicious email formats', () => {
    const maliciousEmails = [
      'user@domain.com<script>',
      'user@domain.com;drop table users',
      'user@domain.com\u0000',
      'user@@domain.com'
    ];
    maliciousEmails.forEach(email => {
      expect(validateEmail(email)).toBe(false);
    });
  });

  // Performance test
  test('should validate emails within performance budget', async () => {
    const emails = Array(1000).fill('user@domain.com');
    const result = await performance(
      () => emails.forEach(email => validateEmail(email)),
      { maxTime: 100 } // 100ms budget
    );
    expect(result.duration).toBeLessThan(100);
  });
});

describe('validatePassword', () => {
  // Password complexity tests
  test('should validate password complexity requirements', () => {
    const result = validatePassword('Test123!@#');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject weak passwords', () => {
    const weakPasswords = [
      'password',
      '12345678',
      'abcdefgh',
      'Test123'
    ];
    weakPasswords.forEach(password => {
      const result = validatePassword(password);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // Security compliance tests
  test('should enforce OWASP password guidelines', () => {
    const result = validatePassword('Short1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  // Performance test
  test('should validate passwords within performance budget', async () => {
    const result = await performance(
      () => validatePassword('Test123!@#'),
      { maxTime: 50 } // 50ms budget
    );
    expect(result.duration).toBeLessThan(50);
  });
});

describe('validateFloorPlan', () => {
  const validFloorPlan: FloorPlan = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    metadata: {
      name: 'Test Floor',
      level: 1,
      totalArea: 1000,
      usableArea: 900,
      dimensions: {
        width: 50,
        height: 20,
        scale: 100,
        unit: MeasurementUnit.METRIC
      },
      fileUrl: 'https://storage.example.com/floorplans/test.pdf',
      lastModified: new Date(),
      version: '1.0.0',
      customFields: {}
    },
    spaces: [{
      id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Office Space 1',
      type: SpaceType.OFFICE,
      coordinates: [{ x: 0, y: 0, z: null }],
      area: 100,
      capacity: 10,
      assignedBusinessUnit: 'BU-001',
      resources: [],
      occupancyStatus: 'VACANT'
    }],
    status: FloorPlanStatus.DRAFT
  };

  test('should validate correct floor plan data', async () => {
    const result = await validateFloorPlan(validFloorPlan);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject invalid space allocations', async () => {
    const invalidFloorPlan = {
      ...validFloorPlan,
      spaces: [{
        ...validFloorPlan.spaces[0],
        area: 1000 // Exceeds usable area
      }]
    };
    const result = await validateFloorPlan(invalidFloorPlan);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Space allocation mismatch');
  });

  // Performance test
  test('should validate floor plans within performance budget', async () => {
    const result = await performance(
      () => validateFloorPlan(validFloorPlan),
      { maxTime: 150 } // 150ms budget
    );
    expect(result.duration).toBeLessThan(150);
  });
});

describe('validateLeaseTerms', () => {
  const validLease: ILease = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    propertyId: 'PROP-001',
    tenantId: 'TENANT-001',
    status: LeaseStatus.ACTIVE,
    startDate: new Date(),
    endDate: new Date(Date.now() + 31536000000), // 1 year from now
    monthlyRent: 5000,
    terms: {
      securityDeposit: 10000,
      noticePeriod: 60,
      renewalOptions: {
        available: true,
        terms: 12
      },
      specialClauses: [],
      restrictions: [],
      maintenanceResponsibilities: {
        landlord: [],
        tenant: []
      }
    }
  } as ILease;

  test('should validate correct lease terms', async () => {
    const result = await validateLeaseTerms(validLease);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject invalid date ranges', async () => {
    const invalidLease = {
      ...validLease,
      endDate: new Date(Date.now() - 86400000) // Yesterday
    };
    const result = await validateLeaseTerms(invalidLease);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Active lease cannot have past end date');
  });

  // Performance test
  test('should validate lease terms within performance budget', async () => {
    const result = await performance(
      () => validateLeaseTerms(validLease),
      { maxTime: 100 } // 100ms budget
    );
    expect(result.duration).toBeLessThan(100);
  });
});

describe('sanitizeInput', () => {
  // XSS prevention tests
  test('should prevent XSS attacks', () => {
    const maliciousInputs = [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<img src="x" onerror="alert(\'xss\')">',
      '<a href="javascript:alert(\'xss\')">click me</a>'
    ];

    maliciousInputs.forEach(input => {
      const sanitized = sanitizeInput(input);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('onerror=');
    });
  });

  // HTML sanitization tests
  test('should properly escape HTML entities', () => {
    const input = '<div class="test">Hello & World</div>';
    const sanitized = sanitizeInput(input);
    expect(sanitized).toBe('&lt;div class=&quot;test&quot;&gt;Hello &amp; World&lt;/div&gt;');
  });

  // Performance test
  test('should sanitize input within performance budget', async () => {
    const longInput = 'A'.repeat(10000);
    const result = await performance(
      () => sanitizeInput(longInput),
      { maxTime: 50 } // 50ms budget
    );
    expect(result.duration).toBeLessThan(50);
  });
});

// Integration tests
describe('Validation Integration', () => {
  test('should handle concurrent validations', async () => {
    const promises = [
      validateEmail('user@domain.com'),
      validatePassword('Test123!@#'),
      validateFloorPlan(validFloorPlan),
      validateLeaseTerms(validLease),
      sanitizeInput('<script>alert("test")</script>')
    ];

    const results = await Promise.all(promises);
    results.forEach(result => {
      expect(result).toBeDefined();
    });
  });

  test('should maintain consistent validation results', () => {
    const email = 'user@domain.com';
    const password = 'Test123!@#';
    
    // Multiple validation runs should yield same results
    for (let i = 0; i < 5; i++) {
      expect(validateEmail(email)).toBe(true);
      expect(validatePassword(password).isValid).toBe(true);
    }
  });
});