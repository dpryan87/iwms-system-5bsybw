/**
 * Resources API Client
 * Implements API client functions for managing workplace resources with enhanced security,
 * monitoring, caching, and error handling features.
 * @version 1.0.0
 */

// External imports with versions
// @package axios ^1.4.0
// @package axios-retry ^3.5.0
// @package axios-rate-limit ^1.3.0
import { AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import rateLimit from 'axios-rate-limit';

// Internal imports
import axiosInstance from './axios.config';
import { Resource, ResourceType, ResourceStatus, ResourceResponse, ResourceListResponse } from '../types/resource.types';
import { AuthErrorType, AuthenticationError } from '../types/auth.types';

/**
 * API endpoint constants
 */
const RESOURCES_API_PATH = '/api/v1/resources';

/**
 * Request retry configuration
 */
const RETRY_CONFIG = {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: axiosRetry.isNetworkOrIdempotentRequestError
};

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_CONFIG = {
  maxRequests: 100,
  perMilliseconds: 60000
};

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  ttl: 300000, // 5 minutes
  maxSize: 1000
};

/**
 * Interface for resource query parameters
 */
interface ResourceQueryParams {
  type?: ResourceType;
  status?: ResourceStatus;
  spaceId?: string;
  page?: number;
  limit?: number;
}

/**
 * Interface for resource creation/update payload
 */
interface ResourcePayload {
  type: ResourceType;
  capacity: number;
  attributes: {
    name: string;
    description: string;
    equipment: string[];
    location: string;
    customFields?: Record<string, any>;
  };
  spaceId: string;
}

/**
 * ResourceApiClient class implementing comprehensive resource management functionality
 */
export class ResourceApiClient {
  private readonly axiosInstance;
  private cache: Map<string, { data: any; timestamp: number }>;

  constructor() {
    // Configure axios instance with retry and rate limiting
    this.axiosInstance = rateLimit(axiosInstance, RATE_LIMIT_CONFIG);
    axiosRetry(this.axiosInstance, RETRY_CONFIG);
    
    // Initialize cache
    this.cache = new Map();
  }

  /**
   * Retrieves a list of resources with optional filtering
   * @param params - Query parameters for filtering resources
   * @returns Promise resolving to list of resources
   */
  async getResources(params?: ResourceQueryParams): Promise<Resource[]> {
    try {
      const cacheKey = this.generateCacheKey('getResources', params);
      const cachedData = this.getCachedData(cacheKey);
      
      if (cachedData) {
        return cachedData;
      }

      const response = await this.axiosInstance.get<ResourceListResponse>(
        RESOURCES_API_PATH,
        { params }
      );

      this.setCachedData(cacheKey, response.data.data);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Retrieves a specific resource by ID
   * @param id - Resource identifier
   * @returns Promise resolving to resource details
   */
  async getResourceById(id: string): Promise<Resource> {
    try {
      const cacheKey = this.generateCacheKey('getResourceById', { id });
      const cachedData = this.getCachedData(cacheKey);

      if (cachedData) {
        return cachedData;
      }

      const response = await this.axiosInstance.get<ResourceResponse>(
        `${RESOURCES_API_PATH}/${id}`
      );

      this.setCachedData(cacheKey, response.data.data);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Creates a new resource
   * @param payload - Resource creation data
   * @returns Promise resolving to created resource
   */
  async createResource(payload: ResourcePayload): Promise<Resource> {
    try {
      const response = await this.axiosInstance.post<ResourceResponse>(
        RESOURCES_API_PATH,
        payload
      );

      this.invalidateCache();
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Updates an existing resource
   * @param id - Resource identifier
   * @param payload - Resource update data
   * @returns Promise resolving to updated resource
   */
  async updateResource(id: string, payload: Partial<ResourcePayload>): Promise<Resource> {
    try {
      const response = await this.axiosInstance.put<ResourceResponse>(
        `${RESOURCES_API_PATH}/${id}`,
        payload
      );

      this.invalidateCache();
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Updates resource status
   * @param id - Resource identifier
   * @param status - New resource status
   * @returns Promise resolving to updated resource
   */
  async updateResourceStatus(id: string, status: ResourceStatus): Promise<Resource> {
    try {
      const response = await this.axiosInstance.patch<ResourceResponse>(
        `${RESOURCES_API_PATH}/${id}/status`,
        { status }
      );

      this.invalidateCache();
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Deletes a resource
   * @param id - Resource identifier
   * @returns Promise resolving to deletion success
   */
  async deleteResource(id: string): Promise<boolean> {
    try {
      await this.axiosInstance.delete(`${RESOURCES_API_PATH}/${id}`);
      this.invalidateCache();
      return true;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handles API errors with proper error transformation
   * @param error - Error object from API call
   * @returns Transformed error
   */
  private handleError(error: any): never {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          throw new AuthenticationError(
            AuthErrorType.INVALID_TOKEN,
            'Authentication required for resource access'
          );
        case 403:
          throw new AuthenticationError(
            AuthErrorType.PERMISSION_DENIED,
            'Insufficient permissions for resource operation'
          );
        case 404:
          throw new Error('Resource not found');
        case 429:
          throw new AuthenticationError(
            AuthErrorType.SUSPICIOUS_ACTIVITY,
            'Too many requests, please try again later'
          );
        default:
          throw new Error(error.response.data?.message || 'Resource operation failed');
      }
    }
    throw new Error('Network error occurred during resource operation');
  }

  /**
   * Generates cache key for data caching
   * @param operation - API operation name
   * @param params - Operation parameters
   * @returns Cache key string
   */
  private generateCacheKey(operation: string, params?: any): string {
    return `${operation}:${JSON.stringify(params || {})}`;
  }

  /**
   * Retrieves cached data if valid
   * @param key - Cache key
   * @returns Cached data or null
   */
  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.ttl) {
      return cached.data;
    }
    return null;
  }

  /**
   * Sets data in cache
   * @param key - Cache key
   * @param data - Data to cache
   */
  private setCachedData(key: string, data: any): void {
    if (this.cache.size >= CACHE_CONFIG.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Invalidates all cached data
   */
  private invalidateCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const resourceApiClient = new ResourceApiClient();