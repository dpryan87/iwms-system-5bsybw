/**
 * @fileoverview Comprehensive unit test suite for UserService
 * Tests user management operations, RBAC, and secure data handling
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UserService } from '../../../src/core/users/services/user.service';
import { IUser, UserRole, UserStatus } from '../../../src/core/users/interfaces/user.interface';
import { generateTestData } from '../../utils/test-helpers';
import { ValidationError } from '../../../src/common/utils/validation.util';
import { ErrorCodes } from '../../../src/common/constants/error-codes';
import { VALIDATION_MESSAGES } from '../../../src/common/constants/messages';

// Mock dependencies
jest.mock('../../../src/core/users/repositories/user.repository');
jest.mock('winston');

describe('UserService', () => {
  // Service instance and mocked dependencies
  let userService: UserService;
  let mockUserRepository: jest.Mocked<any>;
  let mockLogger: jest.Mocked<any>;
  let mockCircuitBreaker: jest.Mocked<any>;

  // Test data
  let testUser: IUser;
  let testUsers: IUser[];

  beforeEach(async () => {
    // Initialize mocks
    mockUserRepository = {
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      getUserById: jest.fn(),
      getUserByEmail: jest.fn(),
      healthCheck: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    mockCircuitBreaker = {
      fire: jest.fn(async (fn) => fn())
    };

    // Initialize service with mocked dependencies
    userService = new UserService(mockUserRepository, mockLogger);
    (userService as any).circuitBreaker = mockCircuitBreaker;

    // Generate test data
    testUser = await generateTestData('user', {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      role: UserRole.FACILITY_MANAGER,
      status: UserStatus.ACTIVE
    }, { performanceMonitoring: true });

    testUsers = [
      testUser,
      await generateTestData('user', {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'admin@example.com',
        role: UserRole.SYSTEM_ADMIN
      }, { performanceMonitoring: true })
    ];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should successfully create a new user with valid data', async () => {
      // Arrange
      const userData = {
        email: 'new@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.SPACE_PLANNER
      };
      mockUserRepository.createUser.mockResolvedValue({ ...userData, id: '123' });

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(userData.email);
      expect(result.role).toBe(userData.role);
      expect(mockUserRepository.createUser).toHaveBeenCalledWith(expect.objectContaining({
        ...userData,
        status: UserStatus.PENDING_ACTIVATION
      }));
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User Audit Trail',
        expect.objectContaining({ action: 'USER_CREATED' })
      );
    });

    it('should throw ValidationError when creating user with existing email', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.BU_ADMIN
      };
      mockUserRepository.getUserByEmail.mockResolvedValue(testUser);

      // Act & Assert
      await expect(userService.createUser(userData))
        .rejects
        .toThrow(ValidationError);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate security preferences during user creation', async () => {
      // Arrange
      const userData = {
        email: 'new@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.FACILITY_MANAGER,
        securityPreferences: {
          mfaEnabled: true,
          passwordExpiryDays: 90,
          loginNotifications: true
        }
      };
      mockUserRepository.createUser.mockResolvedValue({ ...userData, id: '123' });

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result.securityPreferences).toEqual(userData.securityPreferences);
      expect(mockUserRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          securityPreferences: userData.securityPreferences
        })
      );
    });
  });

  describe('updateUser', () => {
    it('should successfully update existing user', async () => {
      // Arrange
      const userId = testUser.id;
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        role: UserRole.FACILITY_MANAGER
      };
      mockUserRepository.updateUser.mockResolvedValue({ ...testUser, ...updateData });

      // Act
      const result = await userService.updateUser(userId, updateData);

      // Assert
      expect(result.firstName).toBe(updateData.firstName);
      expect(result.lastName).toBe(updateData.lastName);
      expect(mockUserRepository.updateUser).toHaveBeenCalledWith(userId, updateData);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User Audit Trail',
        expect.objectContaining({ action: 'USER_UPDATED' })
      );
    });

    it('should throw ValidationError when updating non-existent user', async () => {
      // Arrange
      const userId = 'non-existent-id';
      const updateData = { firstName: 'Test' };
      mockUserRepository.getUserById.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.updateUser(userId, updateData))
        .rejects
        .toThrow(ValidationError);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate role changes during update', async () => {
      // Arrange
      const userId = testUser.id;
      const updateData = {
        role: UserRole.SYSTEM_ADMIN
      };
      mockUserRepository.getUserById.mockResolvedValue(testUser);

      // Act
      await userService.updateUser(userId, updateData);

      // Assert
      expect(mockUserRepository.updateUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ role: UserRole.SYSTEM_ADMIN })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User Audit Trail',
        expect.objectContaining({
          action: 'USER_UPDATED',
          details: expect.objectContaining({ role: UserRole.SYSTEM_ADMIN })
        })
      );
    });
  });

  describe('deleteUser', () => {
    it('should successfully soft delete user', async () => {
      // Arrange
      const userId = testUser.id;
      mockUserRepository.getUserById.mockResolvedValue(testUser);
      mockUserRepository.deleteUser.mockResolvedValue(true);

      // Act
      const result = await userService.deleteUser(userId);

      // Assert
      expect(result).toBe(true);
      expect(mockUserRepository.deleteUser).toHaveBeenCalledWith(userId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User Audit Trail',
        expect.objectContaining({ action: 'USER_DELETED' })
      );
    });

    it('should throw ValidationError when deleting non-existent user', async () => {
      // Arrange
      const userId = 'non-existent-id';
      mockUserRepository.getUserById.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.deleteUser(userId))
        .rejects
        .toThrow(ValidationError);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('updateUserSecurity', () => {
    it('should successfully update security settings', async () => {
      // Arrange
      const userId = testUser.id;
      const securityData = {
        mfaEnabled: true,
        passwordReset: true,
        allowedIPs: ['192.168.1.1']
      };
      mockUserRepository.getUserById.mockResolvedValue(testUser);
      mockUserRepository.updateUser.mockResolvedValue({ ...testUser, ...securityData });

      // Act
      await userService.updateUserSecurity(userId, securityData);

      // Assert
      expect(mockUserRepository.updateUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining(securityData)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Security Event',
        expect.objectContaining({
          event: 'SECURITY_SETTINGS_UPDATED',
          userId
        })
      );
    });
  });

  describe('handleFailedLogin', () => {
    it('should increment failed login attempts', async () => {
      // Arrange
      const userId = testUser.id;
      const userWithAttempts = {
        ...testUser,
        failedLoginAttempts: 1
      };
      mockUserRepository.getUserById.mockResolvedValue(userWithAttempts);

      // Act
      const result = await userService.handleFailedLogin(userId);

      // Assert
      expect(result).toBe(UserStatus.ACTIVE);
      expect(mockUserRepository.updateUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          failedLoginAttempts: 2
        })
      );
    });

    it('should lock account after maximum failed attempts', async () => {
      // Arrange
      const userId = testUser.id;
      const userWithMaxAttempts = {
        ...testUser,
        failedLoginAttempts: 4
      };
      mockUserRepository.getUserById.mockResolvedValue(userWithMaxAttempts);

      // Act
      const result = await userService.handleFailedLogin(userId);

      // Assert
      expect(result).toBe(UserStatus.LOCKED);
      expect(mockUserRepository.updateUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          status: UserStatus.LOCKED,
          failedLoginAttempts: 5
        })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Security Event',
        expect.objectContaining({
          event: 'ACCOUNT_LOCKED',
          userId
        })
      );
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all checks pass', async () => {
      // Arrange
      mockUserRepository.healthCheck.mockResolvedValue(true);

      // Act
      const result = await userService.healthCheck();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.details.database).toBe(true);
      expect(result.metrics).toBeDefined();
    });

    it('should return degraded status when database check fails', async () => {
      // Arrange
      mockUserRepository.healthCheck.mockResolvedValue(false);

      // Act
      const result = await userService.healthCheck();

      // Assert
      expect(result.status).toBe('degraded');
      expect(result.details.database).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});