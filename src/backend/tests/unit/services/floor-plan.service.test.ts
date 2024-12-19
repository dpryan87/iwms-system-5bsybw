// @package jest v29.5.0
// @package inversify v6.0.1
// @package @faker-js/faker v8.0.0
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { Container } from 'inversify';
import { faker } from '@faker-js/faker';
import { FloorPlanService } from '../../../src/core/floor-plans/services/floor-plan.service';
import { 
  IFloorPlan, 
  FloorPlanStatus, 
  IValidationResult,
  IFloorPlanMetadata,
  IVersionInfo
} from '../../../src/core/floor-plans/interfaces/floor-plan.interface';
import { TYPES } from '../../../common/constants/types';
import { ValidationError } from '../../../common/errors/validation.error';

describe('FloorPlanService', () => {
  let container: Container;
  let floorPlanService: FloorPlanService;
  let mockFloorPlanRepository: jest.Mocked<any>;
  let mockCacheService: jest.Mocked<any>;
  let mockMetricsService: jest.Mocked<any>;
  let mockLogger: jest.Mocked<any>;

  beforeEach(() => {
    // Initialize mocks
    mockFloorPlanRepository = {
      create: jest.fn(),
      bulkCreate: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByPropertyId: jest.fn(),
      delete: jest.fn()
    };

    mockCacheService = {
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn()
    };

    mockMetricsService = {
      recordOperationMetrics: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    // Set up DI container
    container = new Container();
    container.bind(TYPES.FloorPlanRepository).toConstantValue(mockFloorPlanRepository);
    container.bind(TYPES.CacheService).toConstantValue(mockCacheService);
    container.bind(TYPES.MetricsService).toConstantValue(mockMetricsService);
    container.bind(TYPES.Logger).toConstantValue(mockLogger);
    container.bind(FloorPlanService).toSelf();

    // Get service instance
    floorPlanService = container.get(FloorPlanService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should properly initialize with all dependencies', () => {
      expect(floorPlanService).toBeInstanceOf(FloorPlanService);
    });
  });

  describe('createFloorPlan', () => {
    let validFloorPlanData: IFloorPlan;

    beforeEach(() => {
      validFloorPlanData = {
        id: faker.string.uuid(),
        propertyId: faker.string.uuid(),
        version: '1.0.0',
        status: FloorPlanStatus.DRAFT,
        metadata: {
          name: faker.lorem.words(2),
          level: faker.number.int({ min: 1, max: 50 }),
          totalArea: faker.number.float({ min: 100, max: 10000 }),
          dimensions: {
            width: faker.number.float({ min: 10, max: 100 }),
            height: faker.number.float({ min: 10, max: 100 }),
            scale: 100
          },
          fileUrl: faker.internet.url(),
          fileHash: faker.string.alphanumeric(64),
          bmsConfig: {
            systemId: faker.string.uuid(),
            sensorMappings: '{}',
            enabled: true,
            config: {
              endpoint: faker.internet.url(),
              credentials: {
                apiKey: faker.string.alphanumeric(32)
              },
              refreshInterval: 5000,
              retryPolicy: {
                attempts: 3,
                backoff: 1000
              }
            }
          },
          validationRules: {
            minArea: 10,
            maxArea: 10000,
            requiredFields: ['name', 'level'],
            customRules: {}
          },
          customAttributes: {}
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: faker.string.uuid(),
        updatedBy: faker.string.uuid(),
        versionInfo: {
          major: 1,
          minor: 0,
          revision: 0,
          changelog: 'Initial version',
          isLatest: true
        },
        auditInfo: {
          createdAt: new Date(),
          createdBy: faker.string.uuid(),
          updatedAt: new Date(),
          updatedBy: faker.string.uuid(),
          comments: []
        }
      };
    });

    it('should successfully create a valid floor plan', async () => {
      mockFloorPlanRepository.create.mockResolvedValue(validFloorPlanData);
      mockCacheService.setEx.mockResolvedValue('OK');

      const result = await floorPlanService.createFloorPlan(validFloorPlanData);

      expect(result).toEqual(validFloorPlanData);
      expect(mockFloorPlanRepository.create).toHaveBeenCalledTimes(1);
      expect(mockCacheService.setEx).toHaveBeenCalledTimes(1);
      expect(mockMetricsService.recordOperationMetrics).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationError for invalid floor plan data', async () => {
      const invalidData = { ...validFloorPlanData, propertyId: '' };

      await expect(floorPlanService.createFloorPlan(invalidData))
        .rejects
        .toThrow(ValidationError);

      expect(mockFloorPlanRepository.create).not.toHaveBeenCalled();
    });

    it('should handle cache update failures gracefully', async () => {
      mockFloorPlanRepository.create.mockResolvedValue(validFloorPlanData);
      mockCacheService.setEx.mockRejectedValue(new Error('Cache error'));

      const result = await floorPlanService.createFloorPlan(validFloorPlanData);

      expect(result).toEqual(validFloorPlanData);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cache update failed:',
        expect.any(Object)
      );
    });
  });

  describe('bulkCreateFloorPlans', () => {
    it('should successfully create multiple floor plans', async () => {
      const floorPlans = Array(3).fill(null).map(() => ({
        ...createMockFloorPlan(),
        propertyId: faker.string.uuid()
      }));

      mockFloorPlanRepository.bulkCreate.mockResolvedValue(floorPlans);

      const result = await floorPlanService.bulkCreateFloorPlans(floorPlans);

      expect(result).toHaveLength(3);
      expect(mockFloorPlanRepository.bulkCreate).toHaveBeenCalledTimes(1);
      expect(mockMetricsService.recordOperationMetrics).toHaveBeenCalledWith(
        'floorPlanService',
        expect.any(Object)
      );
    });

    it('should throw error when bulk operation limit is exceeded', async () => {
      const floorPlans = Array(101).fill(null).map(() => createMockFloorPlan());

      await expect(floorPlanService.bulkCreateFloorPlans(floorPlans))
        .rejects
        .toThrow('Bulk operation limit exceeded');
    });
  });

  describe('validateFloorPlan', () => {
    it('should validate required fields', async () => {
      const invalidData = createMockFloorPlan();
      invalidData.propertyId = '';

      const result = await floorPlanService.validateFloorPlan(invalidData);

      expect(result.isValid).toBeFalsy();
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'propertyId',
          code: 'REQUIRED_FIELD'
        })
      );
    });

    it('should validate BMS configuration when enabled', async () => {
      const invalidData = createMockFloorPlan();
      invalidData.metadata.bmsConfig.enabled = true;
      invalidData.metadata.bmsConfig.systemId = '';

      const result = await floorPlanService.validateFloorPlan(invalidData);

      expect(result.isValid).toBeFalsy();
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'metadata.bmsConfig',
          code: 'INVALID_BMS_CONFIG'
        })
      );
    });

    it('should validate dimensions', async () => {
      const invalidData = createMockFloorPlan();
      invalidData.metadata.dimensions.width = -1;

      const result = await floorPlanService.validateFloorPlan(invalidData);

      expect(result.isValid).toBeFalsy();
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'metadata.dimensions',
          code: 'INVALID_DIMENSIONS'
        })
      );
    });
  });
});

// Helper function to create mock floor plan data
function createMockFloorPlan(): IFloorPlan {
  return {
    id: faker.string.uuid(),
    propertyId: faker.string.uuid(),
    version: '1.0.0',
    status: FloorPlanStatus.DRAFT,
    metadata: {
      name: faker.lorem.words(2),
      level: faker.number.int({ min: 1, max: 50 }),
      totalArea: faker.number.float({ min: 100, max: 10000 }),
      dimensions: {
        width: faker.number.float({ min: 10, max: 100 }),
        height: faker.number.float({ min: 10, max: 100 }),
        scale: 100
      },
      fileUrl: faker.internet.url(),
      fileHash: faker.string.alphanumeric(64),
      bmsConfig: {
        systemId: faker.string.uuid(),
        sensorMappings: '{}',
        enabled: false,
        config: {
          endpoint: faker.internet.url(),
          credentials: {
            apiKey: faker.string.alphanumeric(32)
          },
          refreshInterval: 5000,
          retryPolicy: {
            attempts: 3,
            backoff: 1000
          }
        }
      },
      validationRules: {
        minArea: 10,
        maxArea: 10000,
        requiredFields: ['name', 'level'],
        customRules: {}
      },
      customAttributes: {}
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: faker.string.uuid(),
    updatedBy: faker.string.uuid(),
    versionInfo: {
      major: 1,
      minor: 0,
      revision: 0,
      changelog: 'Initial version',
      isLatest: true
    },
    auditInfo: {
      createdAt: new Date(),
      createdBy: faker.string.uuid(),
      updatedAt: new Date(),
      updatedBy: faker.string.uuid(),
      comments: []
    }
  };
}