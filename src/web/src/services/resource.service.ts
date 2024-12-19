// axios-retry v3.5.0
// winston v3.8.0
// ws v8.0.0

import axiosRetry from 'axios-retry';
import { Logger } from 'winston';
import WebSocket from 'ws';
import { ResourceType, ResourceStatus, Resource, ResourceResponse, ResourceListResponse } from '../types/resource.types';
import { isTokenValid } from '../utils/auth.utils';
import axios, { AxiosInstance } from 'axios';

/**
 * Cache configuration for resource data
 */
interface ResourceCache {
  data: Map<string, Resource>;
  timestamp: Date;
  ttl: number;
}

/**
 * WebSocket message types for real-time resource updates
 */
enum ResourceWebSocketMessageType {
  STATUS_UPDATE = 'RESOURCE_STATUS_UPDATE',
  ALLOCATION_UPDATE = 'RESOURCE_ALLOCATION_UPDATE',
  MAINTENANCE_UPDATE = 'RESOURCE_MAINTENANCE_UPDATE'
}

/**
 * Enhanced service class for secure resource management with real-time capabilities
 * Implements comprehensive resource operations with caching and WebSocket updates
 */
export class ResourceService {
  private readonly axios: AxiosInstance;
  private readonly cache: ResourceCache;
  private wsConnection: WebSocket | null;
  private readonly logger: Logger;
  private readonly API_BASE_URL: string;
  private readonly WS_BASE_URL: string;

  /**
   * Initializes the resource service with enhanced security and monitoring
   * @param logger - Winston logger instance for operation tracking
   */
  constructor(logger: Logger) {
    this.logger = logger;
    this.API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
    this.WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3000/ws';
    this.wsConnection = null;
    
    // Initialize axios instance with retry mechanism
    this.axios = axios.create({
      baseURL: this.API_BASE_URL,
      timeout: 10000
    });

    // Configure axios retry strategy
    axiosRetry(this.axios, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
      }
    });

    // Initialize resource cache
    this.cache = {
      data: new Map<string, Resource>(),
      timestamp: new Date(),
      ttl: 300000 // 5 minutes cache TTL
    };

    this.setupAxiosInterceptors();
  }

  /**
   * Configures axios interceptors for request/response handling
   */
  private setupAxiosInterceptors(): void {
    this.axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    this.axios.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error('Response interceptor error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Establishes WebSocket connection for real-time resource updates
   * @param authToken - Valid authentication token
   */
  private setupWebSocket(authToken: string): void {
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      return;
    }

    this.wsConnection = new WebSocket(`${this.WS_BASE_URL}/resources?token=${authToken}`);

    this.wsConnection.onopen = () => {
      this.logger.info('WebSocket connection established for resource updates');
    };

    this.wsConnection.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        this.handleWebSocketUpdate(update);
      } catch (error) {
        this.logger.error('Error processing WebSocket message:', error);
      }
    };

    this.wsConnection.onerror = (error) => {
      this.logger.error('WebSocket error:', error);
    };

    this.wsConnection.onclose = () => {
      this.logger.info('WebSocket connection closed');
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.setupWebSocket(authToken), 5000);
    };
  }

  /**
   * Handles incoming WebSocket updates for resources
   * @param update - Resource update message
   */
  private handleWebSocketUpdate(update: any): void {
    if (!update.type || !update.data) {
      return;
    }

    switch (update.type) {
      case ResourceWebSocketMessageType.STATUS_UPDATE:
        this.handleStatusUpdate(update.data);
        break;
      case ResourceWebSocketMessageType.ALLOCATION_UPDATE:
        this.handleAllocationUpdate(update.data);
        break;
      case ResourceWebSocketMessageType.MAINTENANCE_UPDATE:
        this.handleMaintenanceUpdate(update.data);
        break;
      default:
        this.logger.warn('Unknown WebSocket update type:', update.type);
    }
  }

  /**
   * Updates resource status in cache
   * @param data - Status update data
   */
  private handleStatusUpdate(data: { resourceId: string; status: ResourceStatus }): void {
    const resource = this.cache.data.get(data.resourceId);
    if (resource) {
      resource.status = data.status;
      this.cache.data.set(data.resourceId, resource);
    }
  }

  /**
   * Updates resource allocation in cache
   * @param data - Allocation update data
   */
  private handleAllocationUpdate(data: { resourceId: string; spaceId: string }): void {
    const resource = this.cache.data.get(data.resourceId);
    if (resource) {
      resource.spaceId = data.spaceId;
      this.cache.data.set(data.resourceId, resource);
    }
  }

  /**
   * Updates resource maintenance status in cache
   * @param data - Maintenance update data
   */
  private handleMaintenanceUpdate(data: { resourceId: string; status: ResourceStatus }): void {
    const resource = this.cache.data.get(data.resourceId);
    if (resource) {
      resource.status = data.status;
      this.cache.data.set(data.resourceId, resource);
    }
  }

  /**
   * Fetches resources with comprehensive filtering and security
   * @param filters - Resource filter criteria
   * @param authToken - Authentication token
   * @returns Promise resolving to filtered resources
   */
  public async fetchResources(
    filters: Record<string, any>,
    authToken: string
  ): Promise<Resource[]> {
    try {
      // Validate authentication token
      if (!isTokenValid(authToken)) {
        throw new Error('Invalid or expired authentication token');
      }

      // Setup WebSocket connection for real-time updates
      this.setupWebSocket(authToken);

      // Check cache validity
      const cacheAge = Date.now() - this.cache.timestamp.getTime();
      if (cacheAge < this.cache.ttl && this.cache.data.size > 0) {
        return this.filterCachedResources(filters);
      }

      // Fetch fresh data from API
      const response = await this.axios.get<ResourceListResponse>('/resources', {
        params: filters,
        headers: { Authorization: `Bearer ${authToken}` }
      });

      // Update cache
      this.updateCache(response.data.data);

      return response.data.data;
    } catch (error) {
      this.logger.error('Error fetching resources:', error);
      throw error;
    }
  }

  /**
   * Filters cached resources based on provided criteria
   * @param filters - Filter criteria
   * @returns Filtered resources array
   */
  private filterCachedResources(filters: Record<string, any>): Resource[] {
    return Array.from(this.cache.data.values()).filter(resource => {
      return Object.entries(filters).every(([key, value]) => {
        return resource[key as keyof Resource] === value;
      });
    });
  }

  /**
   * Updates the resource cache with fresh data
   * @param resources - Updated resource array
   */
  private updateCache(resources: Resource[]): void {
    this.cache.data.clear();
    resources.forEach(resource => {
      this.cache.data.set(resource.id, resource);
    });
    this.cache.timestamp = new Date();
  }

  /**
   * Subscribes to real-time resource updates
   * @param resourceId - Resource identifier
   * @param callback - Update callback function
   */
  public subscribeToUpdates(
    resourceId: string,
    callback: (resource: Resource) => void
  ): () => void {
    const handleUpdate = (event: any) => {
      if (event.resourceId === resourceId) {
        const resource = this.cache.data.get(resourceId);
        if (resource) {
          callback(resource);
        }
      }
    };

    // Return unsubscribe function
    return () => {
      if (this.wsConnection) {
        this.wsConnection.removeEventListener('message', handleUpdate);
      }
    };
  }
}

export default ResourceService;