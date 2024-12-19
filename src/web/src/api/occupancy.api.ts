/**
 * Occupancy API Client Module
 * Handles occupancy-related HTTP requests with comprehensive security, monitoring and error handling
 * @version 1.0.0
 */

// @package axios v1.4.0
// @package axios-retry v3.5.0
// @package axios-rate-limit v1.3.0
import { AxiosResponse } from 'axios';
import retry from 'axios-retry';
import rateLimit from 'axios-rate-limit';

// Internal imports
import axiosInstance from './axios.config';
import { 
  OccupancyData, 
  OccupancyTrend, 
  OccupancyFilter, 
  OccupancyAlert, 
  OccupancyAlertType,
  AlertSeverity,
  isOccupancyData,
  isOccupancyAlert
} from '../types/occupancy.types';

// Constants
const OCCUPANCY_API_PATH = '/api/v1/occupancy';
const CACHE_TTL = 30000; // 30 seconds
const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_PERIOD = 60000; // 1 minute

// Configure rate limiting
const rateLimitedAxios = rateLimit(axiosInstance, {
  maxRequests: RATE_LIMIT_REQUESTS,
  perMilliseconds: RATE_LIMIT_PERIOD
});

// Local cache for occupancy data
const occupancyCache = new Map<string, { data: OccupancyData; timestamp: number }>();

/**
 * Retrieves current occupancy data for a specific space with enhanced security and caching
 * @param spaceId - Unique identifier for the space
 * @returns Promise resolving to current occupancy data
 * @throws Error if request fails or validation fails
 */
export async function getCurrentOccupancy(spaceId: string): Promise<OccupancyData> {
  try {
    // Validate spaceId
    if (!spaceId || typeof spaceId !== 'string') {
      throw new Error('Invalid space ID provided');
    }

    // Check cache
    const cached = occupancyCache.get(spaceId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Make API request
    const response = await rateLimitedAxios.get<OccupancyData>(
      `${OCCUPANCY_API_PATH}/${spaceId}`,
      {
        headers: {
          'Cache-Control': 'no-cache',
          'X-Request-Type': 'OccupancyData'
        }
      }
    );

    // Validate response data
    if (!isOccupancyData(response.data)) {
      throw new Error('Invalid occupancy data received from server');
    }

    // Update cache
    occupancyCache.set(spaceId, {
      data: response.data,
      timestamp: Date.now()
    });

    return response.data;
  } catch (error) {
    console.error('[Occupancy API] getCurrentOccupancy error:', error);
    throw error;
  }
}

/**
 * Retrieves occupancy trend analysis with enhanced filtering and pagination
 * @param spaceId - Space identifier for trend analysis
 * @param filter - Filter parameters for trend data
 * @returns Promise resolving to occupancy trend data
 * @throws Error if request fails or validation fails
 */
export async function getOccupancyTrends(
  spaceId: string,
  filter: OccupancyFilter
): Promise<OccupancyTrend> {
  try {
    // Validate input parameters
    if (!spaceId || !filter.timeRange) {
      throw new Error('Invalid parameters for trend analysis');
    }

    // Validate time range
    if (filter.timeRange.end <= filter.timeRange.start) {
      throw new Error('Invalid time range: end must be after start');
    }

    // Transform filter to query parameters
    const queryParams = new URLSearchParams({
      startDate: filter.timeRange.start.toISOString(),
      endDate: filter.timeRange.end.toISOString(),
      minUtilization: filter.minUtilization.toString(),
      maxUtilization: filter.maxUtilization.toString()
    });

    // Make API request with retry capability
    const response = await rateLimitedAxios.get<OccupancyTrend>(
      `${OCCUPANCY_API_PATH}/${spaceId}/trends?${queryParams}`,
      {
        'axios-retry': {
          retries: 3,
          retryDelay: retry.exponentialDelay,
          retryCondition: (error) => {
            return retry.isNetworkOrIdempotentRequestError(error) ||
                   error.response?.status === 429;
          }
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('[Occupancy API] getOccupancyTrends error:', error);
    throw error;
  }
}

/**
 * Updates occupancy data with enhanced validation and audit logging
 * @param data - Updated occupancy data
 * @returns Promise resolving to void on successful update
 * @throws Error if update fails or validation fails
 */
export async function updateOccupancyData(data: OccupancyData): Promise<void> {
  try {
    // Validate input data
    if (!isOccupancyData(data)) {
      throw new Error('Invalid occupancy data structure');
    }

    // Validate utilization rate bounds
    if (data.utilizationRate < 0 || data.utilizationRate > 100) {
      throw new Error('Utilization rate must be between 0 and 100');
    }

    // Make API request with security headers
    await rateLimitedAxios.post(
      `${OCCUPANCY_API_PATH}/update`,
      data,
      {
        headers: {
          'X-Request-Type': 'OccupancyUpdate',
          'X-Checksum': generateDataChecksum(data)
        }
      }
    );

    // Clear cache entry for updated space
    occupancyCache.delete(data.spaceId);
  } catch (error) {
    console.error('[Occupancy API] updateOccupancyData error:', error);
    throw error;
  }
}

/**
 * Subscribes to real-time occupancy alerts for a space
 * @param spaceId - Space identifier to monitor
 * @param callback - Callback function for handling alerts
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToOccupancyAlerts(
  spaceId: string,
  callback: (alert: OccupancyAlert) => void
): () => void {
  const ws = new WebSocket(`${process.env.VITE_WS_URL}/occupancy/alerts/${spaceId}`);
  
  ws.onmessage = (event) => {
    try {
      const alert = JSON.parse(event.data);
      if (isOccupancyAlert(alert)) {
        callback(alert);
      }
    } catch (error) {
      console.error('[Occupancy API] Alert parsing error:', error);
    }
  };

  return () => {
    ws.close();
  };
}

/**
 * Generates checksum for data validation
 * @param data - Data to generate checksum for
 * @returns Checksum string
 */
function generateDataChecksum(data: OccupancyData): string {
  const payload = `${data.spaceId}:${data.timestamp.toISOString()}:${data.occupantCount}`;
  return Buffer.from(payload).toString('base64');
}