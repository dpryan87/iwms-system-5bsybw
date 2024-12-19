/**
 * @fileoverview Test Data Seeder for IWMS System
 * Implements comprehensive test data generation with security validation
 * @version 1.0.0
 */

import { faker } from '@faker-js/faker'; // v8.0.0
import { DataSource, QueryRunner } from 'typeorm'; // v0.3.0
import * as bcrypt from 'bcrypt'; // v5.1.0

import { UserModel } from '../../core/users/models/user.model';
import { FloorPlanModel } from '../../core/floor-plans/models/floor-plan.model';
import { Lease } from '../../core/leases/models/lease.model';
import { 
  UserRole, 
  UserStatus, 
  IUserSecurityPreferences 
} from '../../core/users/interfaces/user.interface';
import { 
  FloorPlanStatus, 
  IFloorPlanMetadata 
} from '../../core/floor-plans/interfaces/floor-plan.interface';
import { 
  LeaseStatus, 
  EscalationType, 
  DocumentStatus 
} from '../../core/leases/interfaces/lease.interface';

/**
 * Generates test users with comprehensive security profiles
 * @param queryRunner - Database query runner for transaction support
 */
async function seedTestUsers(queryRunner: QueryRunner): Promise<void> {
  const saltRounds = 12;
  const defaultPassword = await bcrypt.hash('Test@123', saltRounds);

  // System Administrator
  const adminSecurityPrefs: IUserSecurityPreferences = {
    mfaEnabled: true,
    mfaMethod: 'APP',
    passwordExpiryDays: 90,
    loginNotifications: true,
    allowedIPs: ['10.0.0.0/24']
  };

  await queryRunner.manager.save(UserModel, {
    email: 'admin@iwms-test.com',
    firstName: 'System',
    lastName: 'Administrator',
    passwordHash: defaultPassword,
    role: UserRole.SYSTEM_ADMIN,
    status: UserStatus.ACTIVE,
    department: 'IT',
    permissions: ['*'],
    securityPreferences: adminSecurityPrefs,
    isMFAEnabled: true,
    lastLogin: new Date(),
    passwordLastChanged: new Date()
  });

  // Facility Manager
  const fmSecurityPrefs: IUserSecurityPreferences = {
    mfaEnabled: true,
    mfaMethod: 'SMS',
    passwordExpiryDays: 90,
    loginNotifications: true
  };

  await queryRunner.manager.save(UserModel, {
    email: 'fm@iwms-test.com',
    firstName: 'Facility',
    lastName: 'Manager',
    passwordHash: defaultPassword,
    role: UserRole.FACILITY_MANAGER,
    status: UserStatus.ACTIVE,
    department: 'Facilities',
    permissions: ['floor_plans.manage', 'resources.manage'],
    securityPreferences: fmSecurityPrefs,
    isMFAEnabled: true,
    lastLogin: new Date(),
    passwordLastChanged: new Date()
  });

  // Space Planner
  await queryRunner.manager.save(UserModel, {
    email: 'planner@iwms-test.com',
    firstName: 'Space',
    lastName: 'Planner',
    passwordHash: defaultPassword,
    role: UserRole.SPACE_PLANNER,
    status: UserStatus.ACTIVE,
    department: 'Planning',
    permissions: ['floor_plans.view', 'space.manage'],
    securityPreferences: {
      mfaEnabled: false,
      passwordExpiryDays: 90,
      loginNotifications: true
    },
    isMFAEnabled: false,
    lastLogin: new Date(),
    passwordLastChanged: new Date()
  });
}

/**
 * Generates test floor plans with BMS integration data
 * @param queryRunner - Database query runner for transaction support
 */
async function seedTestFloorPlans(queryRunner: QueryRunner): Promise<void> {
  const metadata: IFloorPlanMetadata = {
    name: 'Test Building Floor 1',
    level: 1,
    totalArea: 10000,
    dimensions: {
      width: 100,
      height: 100,
      scale: 1
    },
    fileUrl: 'https://storage.test/floor-plans/test-1.dwg',
    fileHash: faker.string.uuid(),
    bmsConfig: {
      systemId: 'BMS-001',
      sensorMappings: JSON.stringify({
        occupancy: ['sensor-1', 'sensor-2'],
        temperature: ['temp-1', 'temp-2']
      }),
      enabled: true,
      config: {
        endpoint: 'https://bms-test.com/api',
        credentials: {
          apiKey: faker.string.uuid(),
        },
        refreshInterval: 300000,
        retryPolicy: {
          attempts: 3,
          backoff: 1000
        }
      }
    },
    validationRules: {
      minArea: 100,
      maxArea: 50000,
      requiredFields: ['name', 'level', 'totalArea'],
      customRules: {}
    },
    customAttributes: {}
  };

  // Draft Floor Plan
  await queryRunner.manager.save(FloorPlanModel, {
    propertyId: faker.string.uuid(),
    version: '1.0.0',
    status: FloorPlanStatus.DRAFT,
    metadata,
    createdBy: 'planner@iwms-test.com',
    updatedBy: 'planner@iwms-test.com',
    versionInfo: {
      major: 1,
      minor: 0,
      revision: 0,
      changelog: 'Initial draft',
      isLatest: true
    },
    auditInfo: {
      createdAt: new Date(),
      createdBy: 'planner@iwms-test.com',
      updatedAt: new Date(),
      updatedBy: 'planner@iwms-test.com',
      comments: ['Initial draft creation']
    }
  });

  // Published Floor Plan
  await queryRunner.manager.save(FloorPlanModel, {
    propertyId: faker.string.uuid(),
    version: '2.1.0',
    status: FloorPlanStatus.PUBLISHED,
    metadata: {
      ...metadata,
      name: 'Test Building Floor 2'
    },
    createdBy: 'fm@iwms-test.com',
    updatedBy: 'fm@iwms-test.com',
    versionInfo: {
      major: 2,
      minor: 1,
      revision: 0,
      changelog: 'Published version',
      isLatest: true
    },
    auditInfo: {
      createdAt: new Date(),
      createdBy: 'fm@iwms-test.com',
      updatedAt: new Date(),
      updatedBy: 'fm@iwms-test.com',
      comments: ['Initial publication']
    }
  });
}

/**
 * Generates test lease data with comprehensive workflows
 * @param queryRunner - Database query runner for transaction support
 */
async function seedTestLeases(queryRunner: QueryRunner): Promise<void> {
  // Active Lease
  const activeLease = new Lease({
    propertyId: faker.string.uuid(),
    tenantId: faker.string.uuid(),
    status: LeaseStatus.ACTIVE,
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    monthlyRent: 10000,
    documents: [{
      id: faker.string.uuid(),
      leaseId: faker.string.uuid(),
      fileName: 'lease-agreement.pdf',
      fileType: 'application/pdf',
      storageUrl: 'https://storage.test/leases/test-1.pdf',
      uploadDate: new Date(),
      version: '1.0.0',
      uploadedBy: 'fm@iwms-test.com',
      status: DocumentStatus.ACTIVE,
      checksum: faker.string.uuid()
    }],
    terms: {
      securityDeposit: 20000,
      escalationRate: 3,
      escalationType: EscalationType.PERCENTAGE,
      includesUtilities: true,
      specialConditions: [],
      paymentSchedule: [],
      escalationSchedule: [],
      utilityDetails: {
        includedUtilities: ['WATER', 'ELECTRICITY'],
        separatelyMetered: true,
        responsibleParty: 'TENANT'
      },
      insurance: {
        generalLiability: 1000000,
        propertyDamage: 500000,
        businessInterruption: true,
        certificates: [],
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        insuranceProvider: 'Test Insurance Co'
      },
      maintenance: {
        responsibleParty: 'LANDLORD',
        includedServices: ['HVAC', 'PLUMBING'],
        frequency: 'MONTHLY'
      },
      penalties: {
        latePayment: {
          gracePeriod: 5,
          rate: 1.5,
          calculationMethod: 'DAILY'
        },
        earlyTermination: {
          allowed: true,
          noticePeriod: 90,
          penalty: 20000
        },
        defaultTerms: []
      }
    }
  });

  await queryRunner.manager.save(Lease, activeLease);
}

/**
 * Safely clears existing test data
 * @param queryRunner - Database query runner for transaction support
 */
async function clearTestData(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.manager.delete(Lease, {});
  await queryRunner.manager.delete(FloorPlanModel, {});
  await queryRunner.manager.delete(UserModel, {});
}

/**
 * Main seeding function with transaction support
 * @param dataSource - TypeORM data source
 */
export async function seed(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await clearTestData(queryRunner);
    await seedTestUsers(queryRunner);
    await seedTestFloorPlans(queryRunner);
    await seedTestLeases(queryRunner);
    
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

export { clearTestData };