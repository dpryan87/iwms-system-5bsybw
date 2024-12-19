// @package jest v29.5.0
// @package winston v3.8.2
// @package node-cache v5.1.2

import { jest } from '@jest/globals';
import { Logger } from 'winston';
import NodeCache from 'node-cache';
import { ResourceService } from '../../../src/core/resources/services/resource.service';
import { ResourceRepository } from '../../../src/core/resources/repositories/resource.repository';
import { 
  IResource, 
  ResourceType, 
  ResourceStatus,
  IResourceSearchCriteria,
  IResourceSearchResult 
} from '../../../src/core/resources/interfaces/resource.interface';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../../src/common/constants/messages';
import { ErrorCodes } from '../../../src/common/constants/error-codes';

describe('ResourceService', () => {
  let resourceService: ResourceService;
  let mockRepository: jest.Mocked<ResourceRepository>;
  let mockLogger: jest.Mocked<Logger>;
  let mockCache: jest.Mocked<NodeCache>;
  let testResource: IResource;

  beforeAll(() => {
    jest.setTimeout(10000); // 10 second timeout for all tests
  });

  beforeEach(() => {
    // Initialize mocks
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findBySpace: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      beginTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn()
    } as unknown as jest.Mocked<ResourceRepository>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      on: jest.fn()
    } as unknown as jest.Mocked<NodeCache>;

    // Initialize service with mocks
    resourceService = new ResourceService(
      mockRepository,
      mockLogger,
      mockCache
    );

    // Setup test resource data
    testResource = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: ResourceType.WORKSTATION,
      status: ResourceStatus.AVAILABLE,
      capacity: 1,
      spaceId: '123e4567-e89b-12d3-a456-426614174001',
      floorId: '123e4567-e89b-12d3-a456-426614174002',
      buildingId: '123e4567-e89b-12d3-a456-426614174003',
      attributes: {
        name: 'Test Workstation',
        description: 'Test workstation description',
        equipment: ['desk', 'chair'],
        location: 'Building A, Floor 1',
        customFields: {},
        maintenanceSchedule: {
          lastMaintenance: new Date(),
          nextScheduled: new Date(),
          maintenanceHistory: [],
          maintenanceProvider: 'Test Provider',
          maintenanceNotes: {}
        },
        usageMetrics: {
          utilizationRate: 0,
          averageOccupancyTime: 0,
          peakUsageTime: 0,
          popularTimeSlots: [],
          usageStatistics: {}
        },
        accessibility: {
          wheelchairAccessible: true
        },
        reservationRules: {
          minDuration: 30,
          maxDuration: 480,
          advanceBookingLimit: 14,
          allowRecurring: true,
          requiresApproval: false
        },
        labels: {},
        isBookable: true,
        supportedActivities: ['individual-work'],
        dimensions: {
          width: 2,
          length: 2,
          area: 4
        },
        environmentalControls: {}
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastModifiedBy: 'test-user',
      availability: {
        currentStatus: ResourceStatus.AVAILABLE,
        operatingHours: {}
      },
      costs: {
        maintenanceCosts: 0,
        totalCostYear: 0
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createResource', () => {
    it('should successfully create a resource', async () => {
      // Arrange
      mockRepository.create.mockResolvedValue(testResource);

      // Act
      const result = await resourceService.createResource(testResource);

      // Assert
      expect(result).toEqual(testResource);
      expect(mockRepository.create).toHaveBeenCalledWith(testResource);
      expect(mockCache.set).toHaveBeenCalledWith(
        `resource:${testResource.id}`,
        testResource,
        3600
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        SUCCESS_MESSAGES.RESOURCE_CREATED
          .replace('{resourceType}', 'Resource')
          .replace('{resourceId}', testResource.id)
      );
    });

    it('should handle validation errors during creation', async () => {
      // Arrange
      const invalidResource = { ...testResource, type: undefined };

      // Act & Assert
      await expect(resourceService.createResource(invalidResource))
        .rejects
        .toThrow(ERROR_MESSAGES.VALIDATION_ERROR);
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should handle database errors during creation', async () => {
      // Arrange
      const dbError = new Error('Database error');
      mockRepository.create.mockRejectedValue(dbError);

      // Act & Assert
      await expect(resourceService.createResource(testResource))
        .rejects
        .toThrow(dbError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create resource',
        expect.any(Object)
      );
    });
  });

  describe('getResource', () => {
    it('should return cached resource if available', async () => {
      // Arrange
      mockCache.get.mockReturnValue(testResource);

      // Act
      const result = await resourceService.getResource(testResource.id);

      // Assert
      expect(result).toEqual(testResource);
      expect(mockCache.get).toHaveBeenCalledWith(`resource:${testResource.id}`);
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch and cache resource if not in cache', async () => {
      // Arrange
      mockCache.get.mockReturnValue(null);
      mockRepository.findById.mockResolvedValue(testResource);

      // Act
      const result = await resourceService.getResource(testResource.id);

      // Assert
      expect(result).toEqual(testResource);
      expect(mockRepository.findById).toHaveBeenCalledWith(testResource.id);
      expect(mockCache.set).toHaveBeenCalledWith(
        `resource:${testResource.id}`,
        testResource,
        3600
      );
    });

    it('should handle resource not found error', async () => {
      // Arrange
      mockCache.get.mockReturnValue(null);
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(resourceService.getResource('non-existent-id'))
        .rejects
        .toThrow(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    });
  });

  describe('getResourcesBySpace', () => {
    const testCriteria: IResourceSearchCriteria = {
      types: [ResourceType.WORKSTATION],
      statuses: [ResourceStatus.AVAILABLE],
      capacityRange: { min: 1, max: 4 }
    };

    const testResult: IResourceSearchResult = {
      items: [testResource],
      total: 1,
      page: 1,
      limit: 20,
      hasMore: false
    };

    it('should return cached space resources if available', async () => {
      // Arrange
      mockCache.get.mockReturnValue(testResult);

      // Act
      const result = await resourceService.getResourcesBySpace(testResource.spaceId, testCriteria);

      // Assert
      expect(result).toEqual(testResult);
      expect(mockCache.get).toHaveBeenCalledWith(`resource:space:${testResource.spaceId}`);
      expect(mockRepository.findBySpace).not.toHaveBeenCalled();
    });

    it('should fetch and cache space resources if not in cache', async () => {
      // Arrange
      mockCache.get.mockReturnValue(null);
      mockRepository.findBySpace.mockResolvedValue(testResult);

      // Act
      const result = await resourceService.getResourcesBySpace(testResource.spaceId, testCriteria);

      // Assert
      expect(result).toEqual(testResult);
      expect(mockRepository.findBySpace).toHaveBeenCalledWith(testResource.spaceId, testCriteria);
      expect(mockCache.set).toHaveBeenCalledWith(
        `resource:space:${testResource.spaceId}`,
        testResult,
        3600
      );
    });

    it('should handle errors when fetching space resources', async () => {
      // Arrange
      const error = new Error('Database error');
      mockCache.get.mockReturnValue(null);
      mockRepository.findBySpace.mockRejectedValue(error);

      // Act & Assert
      await expect(resourceService.getResourcesBySpace(testResource.spaceId, testCriteria))
        .rejects
        .toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get resources by space',
        expect.any(Object)
      );
    });
  });

  describe('updateResource', () => {
    const updateData: Partial<IResource> = {
      status: ResourceStatus.MAINTENANCE,
      attributes: {
        ...testResource.attributes,
        name: 'Updated Workstation'
      }
    };

    it('should successfully update a resource', async () => {
      // Arrange
      const updatedResource = { ...testResource, ...updateData };
      mockRepository.update.mockResolvedValue(updatedResource);

      // Act
      const result = await resourceService.updateResource(testResource.id, updateData);

      // Assert
      expect(result).toEqual(updatedResource);
      expect(mockRepository.update).toHaveBeenCalledWith(testResource.id, updateData);
      expect(mockCache.set).toHaveBeenCalledWith(
        `resource:${testResource.id}`,
        updatedResource,
        3600
      );
    });

    it('should handle validation errors during update', async () => {
      // Arrange
      const invalidUpdate = { status: 'INVALID_STATUS' };

      // Act & Assert
      await expect(resourceService.updateResource(testResource.id, invalidUpdate))
        .rejects
        .toThrow(ERROR_MESSAGES.VALIDATION_ERROR);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should handle concurrent update conflicts', async () => {
      // Arrange
      const concurrencyError = new Error('Concurrent modification detected');
      mockRepository.update.mockRejectedValue(concurrencyError);

      // Act & Assert
      await expect(resourceService.updateResource(testResource.id, updateData))
        .rejects
        .toThrow(concurrencyError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update resource',
        expect.any(Object)
      );
    });
  });

  describe('optimizeResources', () => {
    it('should throw not implemented error', async () => {
      // Arrange
      const criteria = {
        targetUtilization: 0.8,
        costEfficiency: true,
        energyEfficiency: true,
        timeRange: {
          start: new Date(),
          end: new Date()
        }
      };

      // Act & Assert
      await expect(resourceService.optimizeResources(criteria))
        .rejects
        .toThrow('Method not implemented.');
    });
  });
});