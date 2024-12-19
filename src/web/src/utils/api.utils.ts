// @package axios ^1.4.0
// @package axios-rate-limit ^1.3.0

import axios, { AxiosError, AxiosResponse } from 'axios';
import rateLimit from 'axios-rate-limit';
import { HTTP_METHODS, DEFAULT_API_CONFIG, API_HEADERS } from '../constants/api.constants';
import { getStoredToken } from '../utils/auth.utils';

/**
 * RFC 7807-compliant API error response interface
 */
export interface ApiErrorResponse {
  success: boolean;
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: Record<string, string[]>;
  instance?: string;
}

/**
 * Configuration for API request retry behavior
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  retryableStatuses: number[];
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: DEFAULT_API_CONFIG.RETRY_ATTEMPTS,
  baseDelay: DEFAULT_API_CONFIG.RETRY_DELAY,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
};

/**
 * Creates rate-limited axios instance with security headers
 */
const axiosInstance = rateLimit(axios.create({
  timeout: DEFAULT_API_CONFIG.TIMEOUT,
  maxContentLength: DEFAULT_API_CONFIG.MAX_PAYLOAD_SIZE,
  headers: {
    [API_HEADERS.CONTENT_TYPE]: 'application/json',
    [API_HEADERS.X_CONTENT_TYPE_OPTIONS]: 'nosniff',
    [API_HEADERS.STRICT_TRANSPORT_SECURITY]: 'max-age=31536000; includeSubDomains'
  }
}), { maxRequests: DEFAULT_API_CONFIG.RATE_LIMIT, perMilliseconds: 3600000 });

/**
 * Comprehensive error handling utility for API requests with monitoring and retry logic
 * @param error - Axios error object
 * @param retryConfig - Optional retry configuration
 * @returns Standardized error response
 */
export const handleApiError = async (
  error: AxiosError,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<ApiErrorResponse> => {
  const { response, config, message } = error;
  const retryCount = (config?.['retryCount'] as number) || 0;

  // Log error details for monitoring
  console.error('[API Error]', {
    url: config?.url,
    method: config?.method,
    status: response?.status,
    message,
    timestamp: new Date().toISOString()
  });

  // Check retry eligibility
  if (
    retryCount < retryConfig.maxRetries &&
    config &&
    response?.status &&
    retryConfig.retryableStatuses.includes(response.status)
  ) {
    const delay = retryConfig.baseDelay * Math.pow(2, retryCount);
    config['retryCount'] = retryCount + 1;

    // Wait with exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
    return axiosInstance(config);
  }

  // Format RFC 7807-compliant error response
  const errorResponse: ApiErrorResponse = {
    success: false,
    type: 'https://api.iwms.com/errors/',
    title: 'Request Failed',
    status: response?.status || 500,
    detail: message,
    instance: config?.url
  };

  // Enhance error details based on response
  if (response?.data?.errors) {
    errorResponse.errors = response.data.errors;
  }

  // Add specific error types
  switch (response?.status) {
    case 401:
      errorResponse.type += 'unauthorized';
      errorResponse.title = 'Authentication Required';
      break;
    case 403:
      errorResponse.type += 'forbidden';
      errorResponse.title = 'Access Denied';
      break;
    case 429:
      errorResponse.type += 'rate-limit-exceeded';
      errorResponse.title = 'Too Many Requests';
      break;
    default:
      errorResponse.type += 'internal-error';
  }

  return errorResponse;
};

/**
 * Transforms and validates API responses with security checks
 * @param response - Axios response object
 * @returns Validated and transformed response
 */
export const transformResponse = (response: AxiosResponse): any => {
  // Validate security headers
  const securityHeaders = {
    [API_HEADERS.X_CONTENT_TYPE_OPTIONS]: response.headers[API_HEADERS.X_CONTENT_TYPE_OPTIONS],
    [API_HEADERS.X_FRAME_OPTIONS]: response.headers[API_HEADERS.X_FRAME_OPTIONS],
    [API_HEADERS.X_XSS_PROTECTION]: response.headers[API_HEADERS.X_XSS_PROTECTION]
  };

  // Log response metrics
  console.debug('[API Response]', {
    url: response.config.url,
    method: response.config.method,
    status: response.status,
    size: JSON.stringify(response.data).length,
    timestamp: new Date().toISOString()
  });

  // Check response integrity
  if (!response.data) {
    throw new Error('Invalid response format');
  }

  // Transform successful response
  return {
    success: true,
    data: response.data,
    metadata: {
      timestamp: new Date().toISOString(),
      headers: securityHeaders,
      status: response.status
    }
  };
};

/**
 * Creates secure API request with authentication and monitoring
 * @param method - HTTP method
 * @param url - API endpoint URL
 * @param data - Request payload
 * @param headers - Additional headers
 * @returns Promise resolving to API response
 */
export const createApiRequest = async (
  method: keyof typeof HTTP_METHODS,
  url: string,
  data?: any,
  headers: Record<string, string> = {}
): Promise<any> => {
  try {
    // Get authentication token
    const token = await getStoredToken();
    if (token) {
      headers[API_HEADERS.AUTHORIZATION] = `Bearer ${token}`;
    }

    // Add request ID for tracing
    headers[API_HEADERS.X_REQUEST_ID] = crypto.randomUUID();

    const response = await axiosInstance({
      method,
      url,
      data,
      headers: {
        ...headers,
        [API_HEADERS.X_API_KEY]: process.env.REACT_APP_API_KEY
      }
    });

    return transformResponse(response);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return handleApiError(error);
    }
    throw error;
  }
};

// Export convenience methods for API requests
export const apiGet = (url: string, headers?: Record<string, string>) =>
  createApiRequest(HTTP_METHODS.GET, url, undefined, headers);

export const apiPost = (url: string, data?: any, headers?: Record<string, string>) =>
  createApiRequest(HTTP_METHODS.POST, url, data, headers);

export const apiPut = (url: string, data?: any, headers?: Record<string, string>) =>
  createApiRequest(HTTP_METHODS.PUT, url, data, headers);

export const apiDelete = (url: string, headers?: Record<string, string>) =>
  createApiRequest(HTTP_METHODS.DELETE, url, undefined, headers);