/**
 * @fileoverview Development environment database seeder
 * Populates the database with comprehensive sample data for testing and development
 * @version 1.0.0
 */

import { faker } from '@faker-js/faker'; // v8.0.0
import { Transaction } from 'typeorm'; // v0.3.0
import { UserModel, UserRole, UserStatus } from '../../core/users/models/user.model';
import { FloorPlanModel, FloorPlanStatus } from '../../core/floor-plans/models/floor-plan.model';
import { Lease, LeaseStatus, EscalationType } from '../../core/leases/models/lease.model';

/**
 * Seeds sample users with different roles and permissions
 */
async function seedUsers(): Promise<void> {
  const users = [];

  // System Administrator
  users.push({
    email: 'admin@iwms.com',
    firstName: 'System',
    lastName: 'Administrator',
    role: UserRole.SYSTEM_ADMIN,
    status: UserStatus.ACTIVE,
    department: 'IT',
    businessUnit: 'Operations',
    employeeId: 'ADM001',
    isActive: true,
    isMFAEnabled: true,
    preferredLanguage: 'en',
    timezone: 'UTC',
    securityPreferences: {
      mfaEnabled: true,
      mfaMethod: 'APP',
      passwordExpiryDays: 90,
      loginNotifications: true
    }
  });

  // Facility Managers
  for (let i = 0; i < 3; i++) {
    users.push({
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: UserRole.FACILITY_MANAGER,
      status: UserStatus.ACTIVE,
      department: 'Facilities',
      businessUnit: faker.company.name(),
      employeeId: `FM${faker.number.int({ min: 100, max: 999 })}`,
      isActive: true,
      isMFAEnabled: true,
      preferredLanguage: 'en',
      timezone: faker.location.timeZone(),
      securityPreferences: {
        mfaEnabled: true,
        mfaMethod: 'APP',
        passwordExpiryDays: 90,
        loginNotifications: true
      }
    });
  }

  // Space Planners
  for (let i = 0; i < 2; i++) {
    users.push({
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: UserRole.SPACE_PLANNER,
      status: UserStatus.ACTIVE,
      department: 'Space Planning',
      businessUnit: faker.company.name(),
      employeeId: `SP${faker.number.int({ min: 100, max: 999 })}`,
      isActive: true,
      isMFAEnabled: true,
      preferredLanguage: 'en',
      timezone: faker.location.timeZone(),
      securityPreferences: {
        mfaEnabled: true,
        mfaMethod: 'APP',
        passwordExpiryDays: 90,
        loginNotifications: true
      }
    });
  }

  // Business Unit Administrators
  for (let i = 0; i < 4; i++) {
    users.push({
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: UserRole.BU_ADMIN,
      status: UserStatus.ACTIVE,
      department: faker.commerce.department(),
      businessUnit: faker.company.name(),
      employeeId: `BU${faker.number.int({ min: 100, max: 999 })}`,
      isActive: true,
      isMFAEnabled: true,
      preferredLanguage: 'en',
      timezone: faker.location.timeZone(),
      securityPreferences: {
        mfaEnabled: false,
        passwordExpiryDays: 90,
        loginNotifications: true
      }
    });
  }

  // Validate and save users
  for (const userData of users) {
    const user = new UserModel();
    Object.assign(user, userData);
    await user.validateUser(userData);
    await user.save();
  }
}

/**
 * Seeds sample floor plans with different statuses and metadata
 */
async function seedFloorPlans(): Promise<void> {
  const floorPlans = [];

  // Generate sample floor plans for different buildings
  for (let building = 1; building <= 3; building++) {
    for (let floor = 1; floor <= 4; floor++) {
      const status = faker.helpers.arrayElement(Object.values(FloorPlanStatus));
      
      floorPlans.push({
        propertyId: faker.string.uuid(),
        version: `1.${floor}.0`,
        status,
        metadata: {
          name: `Building ${building} - Floor ${floor}`,
          level: floor,
          totalArea: faker.number.int({ min: 1000, max: 5000 }),
          dimensions: {
            width: faker.number.int({ min: 50, max: 100 }),
            height: faker.number.int({ min: 30, max: 60 }),
            scale: 100
          },
          fileUrl: `https://storage.iwms.com/floorplans/b${building}f${floor}.dwg`,
          fileHash: faker.string.alphanumeric(64),
          bmsConfig: {
            systemId: faker.string.uuid(),
            sensorMappings: JSON.stringify({
              occupancy: true,
              temperature: true,
              humidity: true
            }),
            enabled: true,
            config: {
              endpoint: 'https://bms.example.com/api',
              refreshInterval: 300000
            }
          },
          validationRules: {
            minArea: 10,
            maxArea: 5000,
            requiredFields: ['name', 'level', 'totalArea']
          }
        },
        versionInfo: {
          major: 1,
          minor: floor,
          revision: 0,
          changelog: 'Initial floor plan',
          isLatest: true
        },
        auditInfo: {
          createdAt: faker.date.past(),
          createdBy: faker.string.uuid(),
          updatedAt: faker.date.recent(),
          updatedBy: faker.string.uuid(),
          comments: []
        }
      });
    }
  }

  // Save floor plans
  for (const floorPlanData of floorPlans) {
    const floorPlan = new FloorPlanModel();
    Object.assign(floorPlan, floorPlanData);
    await floorPlan.save();
  }
}

/**
 * Seeds sample leases with different states and documentation
 */
async function seedLeases(): Promise<void> {
  const leases = [];

  // Generate sample leases
  for (let i = 0; i < 10; i++) {
    const startDate = faker.date.future();
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + faker.number.int({ min: 1, max: 5 }));

    leases.push({
      propertyId: faker.string.uuid(),
      tenantId: faker.string.uuid(),
      status: faker.helpers.arrayElement(Object.values(LeaseStatus)),
      startDate,
      endDate,
      monthlyRent: faker.number.float({ min: 5000, max: 50000, precision: 2 }),
      documents: [{
        id: faker.string.uuid(),
        fileName: `lease_${i}.pdf`,
        fileType: 'application/pdf',
        storageUrl: `https://storage.iwms.com/leases/lease_${i}.pdf`,
        uploadDate: faker.date.recent(),
        version: '1.0.0',
        uploadedBy: faker.string.uuid(),
        status: 'ACTIVE',
        checksum: faker.string.alphanumeric(64)
      }],
      terms: {
        securityDeposit: faker.number.float({ min: 10000, max: 100000, precision: 2 }),
        escalationType: faker.helpers.arrayElement(Object.values(EscalationType)),
        escalationRate: faker.number.float({ min: 2, max: 5, precision: 2 }),
        includesUtilities: faker.datatype.boolean(),
        specialConditions: [
          faker.lorem.sentence(),
          faker.lorem.sentence()
        ]
      },
      auditTrail: {
        changes: [{
          timestamp: faker.date.recent(),
          userId: faker.string.uuid(),
          field: 'creation',
          oldValue: null,
          newValue: 'Initial lease creation'
        }],
        reviews: []
      }
    });
  }

  // Save leases
  for (const leaseData of leases) {
    const lease = new Lease(leaseData);
    await lease.validate();
    await lease.save();
  }
}

/**
 * Main seeder function that orchestrates all seeding operations
 */
@Transaction()
export async function seed(): Promise<void> {
  try {
    console.log('Starting development database seeding...');

    // Execute seeders in sequence
    await seedUsers();
    console.log('Users seeded successfully');

    await seedFloorPlans();
    console.log('Floor plans seeded successfully');

    await seedLeases();
    console.log('Leases seeded successfully');

    console.log('Development database seeding completed successfully');
  } catch (error) {
    console.error('Error seeding development database:', error);
    throw error;
  }
}

export default seed;