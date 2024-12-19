/**
 * @fileoverview Integration tests for user management functionality
 * Tests CRUD operations, RBAC, and security measures
 * @version 1.0.0
 */

// External imports
import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals'; // v29.5.0
import supertest from 'supertest'; // v6.3.3
import { Container } from 'inversify';

// Internal imports
import { IUser, UserRole, UserStatus } from '../../src/core/users/interfaces/user.interface';
import { UserService } from '../../src/core/users/services/user.service';
import { ValidationError } from '../../src/common/utils/validation.util';
import { ErrorCodes } from '../../src/common/constants/error-codes';
import { VALIDATION_MESSAGES } from '../../src/common/constants/messages';
import { databaseConfig } from '../../src/common/config/database.config';

// Test constants
const TEST_TIMEOUT = 30000;
const TEST_DB_NAME = 'iwms_test_users';
const TEST_SECURITY_KEY = 'test_security_key_2023';

// Test container setup
const container = new Container();
let userService: UserService;
let testUsers: IUser[] = [];

describe('User Management Integration Tests', () => {
  beforeAll(async () => {
    // Configure test database
    const testDbConfig = {
      ...databaseConfig,
      database: TEST_DB_NAME
    };

    // Initialize container and services
    container.bind<UserService>('UserService').to(UserService);
    userService = container.get<UserService>('UserService');
    await userService.initialize({ 
      serviceName: 'user-service-test',
      databaseConfig: testDbConfig
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup test data and close connections
    await userService.shutdown();
  });

  beforeEach(async () => {
    // Create test users for each test
    testUsers = await createTestUsers();
  });

  afterEach(async () => {
    // Cleanup test users
    await cleanupTestUsers(testUsers);
  });

  describe('User Creation Tests', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        email: 'test.user@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.FACILITY_MANAGER,
        department: 'Facilities',
        businessUnit: 'Operations',
        preferredLanguage: 'en',
        timezone: 'UTC'
      };

      const result = await userService.createUser(userData);

      expect(result).toBeDefined();
      expect(result.email).toBe(userData.email);
      expect(result.role).toBe(userData.role);
      expect(result.status).toBe(UserStatus.PENDING_ACTIVATION);
    });

    it('should reject creation with duplicate email', async () => {
      const existingUser = testUsers[0];
      const userData = {
        email: existingUser.email,
        firstName: 'Duplicate',
        lastName: 'User',
        role: UserRole.SPACE_PLANNER
      };

      await expect(userService.createUser(userData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should enforce password complexity requirements', async () => {
      const userData = {
        email: 'weak.password@example.com',
        firstName: 'Weak',
        lastName: 'Password',
        role: UserRole.BU_ADMIN,
        password: 'simple'
      };

      await expect(userService.createUser(userData))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('Role-Based Access Control Tests', () => {
    it('should enforce role hierarchy restrictions', async () => {
      const adminUser = testUsers.find(u => u.role === UserRole.SYSTEM_ADMIN);
      const regularUser = testUsers.find(u => u.role === UserRole.TENANT_USER);

      // Admin should be able to modify any user
      const updateResult = await userService.updateUser(regularUser.id, {
        department: 'New Department'
      });
      expect(updateResult.department).toBe('New Department');

      // Regular user should not be able to modify admin
      await expect(userService.updateUser(adminUser.id, {
        department: 'Unauthorized Change'
      })).rejects.toThrow();
    });

    it('should validate permission requirements', async () => {
      const spaceManager = testUsers.find(u => u.role === UserRole.SPACE_PLANNER);
      const result = await userService.validateUserAccess(
        spaceManager.id,
        'floor-plan-123',
        'edit'
      );
      expect(result).toBe(true);
    });
  });

  describe('Security Measures Tests', () => {
    it('should handle failed login attempts correctly', async () => {
      const user = testUsers[0];
      
      // Simulate multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await userService.handleFailedLogin(user.id);
      }

      const updatedUser = await userService.getUserById(user.id);
      expect(updatedUser.status).toBe(UserStatus.LOCKED);
      expect(updatedUser.failedLoginAttempts).toBe(5);
    });

    it('should enforce security preferences', async () => {
      const user = testUsers[0];
      const securityUpdate = {
        isMFAEnabled: true,
        mfaMethod: 'APP',
        allowedIPs: ['192.168.1.1']
      };

      await userService.updateUserSecurity(user.id, securityUpdate);
      const updatedUser = await userService.getUserById(user.id);
      
      expect(updatedUser.securityPreferences.mfaEnabled).toBe(true);
      expect(updatedUser.securityPreferences.mfaMethod).toBe('APP');
    });
  });

  describe('User Data Management Tests', () => {
    it('should handle soft deletion correctly', async () => {
      const user = testUsers[0];
      await userService.deleteUser(user.id);

      await expect(userService.getUserById(user.id))
        .rejects
        .toThrow(ValidationError);
    });

    it('should maintain audit trail for changes', async () => {
      const user = testUsers[0];
      const updateData = {
        department: 'New Department',
        businessUnit: 'New BU'
      };

      const result = await userService.updateUser(user.id, updateData);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.department).toBe(updateData.department);
    });
  });
});

// Helper Functions

async function createTestUsers(): Promise<IUser[]> {
  const users = [
    {
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.SYSTEM_ADMIN
    },
    {
      email: 'manager@test.com',
      firstName: 'Facility',
      lastName: 'Manager',
      role: UserRole.FACILITY_MANAGER
    },
    {
      email: 'planner@test.com',
      firstName: 'Space',
      lastName: 'Planner',
      role: UserRole.SPACE_PLANNER
    },
    {
      email: 'tenant@test.com',
      firstName: 'Tenant',
      lastName: 'User',
      role: UserRole.TENANT_USER
    }
  ];

  const createdUsers = await Promise.all(
    users.map(user => userService.createUser(user))
  );

  return createdUsers;
}

async function cleanupTestUsers(users: IUser[]): Promise<void> {
  await Promise.all(
    users.map(user => userService.deleteUser(user.id))
  );
}