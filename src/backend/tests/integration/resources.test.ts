// @jest/globals v29.5.0
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupTestEnvironment, teardownTestEnvironment } from '../utils/test-setup';
import { generateTestData } from '../utils/test-helpers';
import { ResourceService } from '../../src/core/resources/services/resource.service';
import { 
  IResource, 
  ResourceType, 
  ResourceStatus,
  IResourceSearchCriteria,
  IResourceFetchOptions
} from '../../src/core/resources/interfaces/resource.interface';
import { ErrorCodes } from '../../src/common/constants/error-codes';

describe('Resource Management Integration Tests', () => {
  let resourceService: ResourceService;
  let testSpaceId: string;
  let testStartTime: number;
  let testMetrics: {
    operationTimes: { [key: string]: number };
    resourceCounts: { [key: string]: number };
  };

  beforeAll(async () => {
    testStartTime = Date.now();
    testMetrics = {
      operationTimes: {},
      resourceCounts: {}
    };

    // Initialize test environment
    await setupTestEnvironment();
    
    // Generate test space ID
    testSpaceId = 'test-space-' + Date.now();
  });

  afterAll(async () => {
    // Record test duration
    const testDuration = Date.now() - testStartTime;
    console.log(`Test suite completed in ${testDuration}ms`);
    console.log('Test metrics:', testMetrics);

    // Cleanup test environment
    await teardownTestEnvironment();
  });

  describe('Resource Creation', () => {
    it('should successfully create a valid resource', async () => {
      const startTime = Date.now();
      
      // Generate test resource data
      const resourceData = await generateTestData('resource', {
        type: ResourceType.WORKSTATION,
        spaceId: testSpaceId,
        status: ResourceStatus.AVAILABLE
      });

      // Create resource
      const createdResource = await resourceService.createResource(resourceData);

      // Record metrics
      testMetrics.operationTimes['create'] = Date.now() - startTime;
      testMetrics.resourceCounts['created'] = (testMetrics.resourceCounts['created'] || 0) + 1;

      // Assertions
      expect(createdResource).toBeDefined();
      expect(createdResource.id).toBeDefined();
      expect(createdResource.type).toBe(ResourceType.WORKSTATION);
      expect(createdResource.status).toBe(ResourceStatus.AVAILABLE);
      expect(createdResource.spaceId).toBe(testSpaceId);
    });

    it('should validate required fields during creation', async () => {
      const invalidData = await generateTestData('resource', {
        spaceId: testSpaceId
      });
      delete invalidData.type; // Remove required field

      await expect(resourceService.createResource(invalidData))
        .rejects
        .toThrow('Missing required resource fields');
    });

    it('should prevent duplicate resources in the same space', async () => {
      const resourceData = await generateTestData('resource', {
        type: ResourceType.MEETING_ROOM,
        spaceId: testSpaceId
      });

      // Create first resource
      await resourceService.createResource(resourceData);

      // Attempt to create duplicate
      await expect(resourceService.createResource(resourceData))
        .rejects
        .toThrow('Resource already exists in this space');
    });
  });

  describe('Resource Retrieval', () => {
    it('should retrieve resource with all related data', async () => {
      const startTime = Date.now();

      // Create test resource
      const resourceData = await generateTestData('resource', {
        type: ResourceType.COLLABORATION_AREA,
        spaceId: testSpaceId
      });
      const created = await resourceService.createResource(resourceData);

      // Retrieve with all options
      const options: IResourceFetchOptions = {
        includeMetrics: true,
        includeMaintenanceHistory: true,
        includeCustomFields: true
      };

      const retrieved = await resourceService.getResource(created.id, options);

      // Record metrics
      testMetrics.operationTimes['retrieve'] = Date.now() - startTime;

      // Assertions
      expect(retrieved).toBeDefined();
      expect(retrieved.attributes.usageMetrics).toBeDefined();
      expect(retrieved.attributes.maintenanceSchedule.maintenanceHistory).toBeDefined();
      expect(retrieved.attributes.customFields).toBeDefined();
    });

    it('should handle non-existent resource retrieval', async () => {
      const nonExistentId = 'non-existent-id';

      await expect(resourceService.getResource(nonExistentId, {}))
        .rejects
        .toThrow('Resource not found');
    });
  });

  describe('Resource Updates', () => {
    it('should successfully update resource attributes', async () => {
      const startTime = Date.now();

      // Create test resource
      const resourceData = await generateTestData('resource', {
        type: ResourceType.QUIET_ROOM,
        spaceId: testSpaceId
      });
      const created = await resourceService.createResource(resourceData);

      // Update attributes
      const updates = {
        status: ResourceStatus.MAINTENANCE,
        attributes: {
          ...created.attributes,
          name: 'Updated Name',
          description: 'Updated Description'
        }
      };

      const updated = await resourceService.updateResource(created.id, updates);

      // Record metrics
      testMetrics.operationTimes['update'] = Date.now() - startTime;

      // Assertions
      expect(updated.status).toBe(ResourceStatus.MAINTENANCE);
      expect(updated.attributes.name).toBe('Updated Name');
      expect(updated.attributes.description).toBe('Updated Description');
    });

    it('should validate status transitions', async () => {
      // Create resource in maintenance
      const resourceData = await generateTestData('resource', {
        type: ResourceType.WORKSTATION,
        spaceId: testSpaceId,
        status: ResourceStatus.MAINTENANCE
      });
      const created = await resourceService.createResource(resourceData);

      // Attempt invalid status transition
      const invalidUpdate = {
        status: ResourceStatus.OCCUPIED
      };

      await expect(resourceService.updateResource(created.id, invalidUpdate))
        .rejects
        .toThrow('Invalid status transition');
    });
  });

  describe('Space-based Queries', () => {
    it('should retrieve all resources in a space with pagination', async () => {
      const startTime = Date.now();

      // Create multiple test resources
      const resourceCount = 5;
      for (let i = 0; i < resourceCount; i++) {
        await resourceService.createResource(await generateTestData('resource', {
          spaceId: testSpaceId
        }));
      }

      // Query with criteria
      const criteria: IResourceSearchCriteria = {
        page: 1,
        limit: 3
      };

      const result = await resourceService.getResourcesBySpace(testSpaceId, criteria);

      // Record metrics
      testMetrics.operationTimes['query'] = Date.now() - startTime;

      // Assertions
      expect(result.items.length).toBe(3);
      expect(result.total).toBeGreaterThanOrEqual(resourceCount);
      expect(result.hasMore).toBe(true);
    });

    it('should filter resources by type and status', async () => {
      const criteria: IResourceSearchCriteria = {
        types: [ResourceType.WORKSTATION],
        statuses: [ResourceStatus.AVAILABLE]
      };

      const result = await resourceService.getResourcesBySpace(testSpaceId, criteria);

      // Assertions
      result.items.forEach(resource => {
        expect(resource.type).toBe(ResourceType.WORKSTATION);
        expect(resource.status).toBe(ResourceStatus.AVAILABLE);
      });
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle concurrent resource operations', async () => {
      const operations = Array(5).fill(null).map(async () => {
        const resourceData = await generateTestData('resource', {
          spaceId: testSpaceId
        });
        return resourceService.createResource(resourceData);
      });

      const results = await Promise.allSettled(operations);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      expect(successful).toBeGreaterThan(0);
    });

    it('should maintain data integrity during failures', async () => {
      // Create initial resource
      const resourceData = await generateTestData('resource', {
        spaceId: testSpaceId
      });
      const created = await resourceService.createResource(resourceData);

      // Attempt invalid update
      try {
        await resourceService.updateResource(created.id, {
          capacity: -1 // Invalid value
        });
      } catch (error) {
        // Verify resource state remained unchanged
        const retrieved = await resourceService.getResource(created.id, {});
        expect(retrieved.capacity).toBe(created.capacity);
      }
    });
  });
});