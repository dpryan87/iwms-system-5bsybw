/**
 * Axios Configuration
 * Configures and exports an Axios instance with comprehensive security features,
 * monitoring capabilities, and robust error handling for the IWMS web application
 * @version 1.0.0
 */

// @package axios v1.4.0
// @package axios-retry v3.5.0
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import { v4 as uuid } from 'uuid';

// Internal imports
import { API_VERSION, DEFAULT_API_CONFIG, API_HEADERS } from '../constants/api.constants';
import { getStoredToken } from '../utils/auth.utils';
import { AuthErrorType, AuthenticationError } from '../types/auth.types';

// Base URL configuration with environment fallback
const BASE_URL = process.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Default Axios configuration with security and monitoring features
 */
const AXIOS_CONFIG: AxiosRequestConfig = {
  baseURL: `${BASE_URL}/api/${API_VERSION}`,
  timeout: DEFAULT_API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'X-Request-ID': uuid(),
    'X-Client-Version': process.env.VITE_APP_VERSION,
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  },
  withCredentials: true,
  maxContentLength: DEFAULT_API_CONFIG.MAX_PAYLOAD_SIZE,
  validateStatus: status => status >= 200 && status < 300
};

/**
 * Create Axios instance with default configuration
 */
const axiosInstance: AxiosInstance = axios.create(AXIOS_CONFIG);

/**
 * Configure retry logic for failed requests
 */
axiosRetry(axiosInstance, {
  retries: DEFAULT_API_CONFIG.RETRY_ATTEMPTS,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error: AxiosError) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) &&
           !error.response?.status?.toString().startsWith('4');
  }
});

/**
 * Request interceptor for authentication and monitoring
 */
axiosInstance.interceptors.request.use(
  async (config: AxiosRequestConfig) => {
    try {
      // Start request timing for monitoring
      config.metadata = { startTime: Date.now() };

      // Add authentication token
      const token = await getStoredToken();
      if (token) {
        config.headers[API_HEADERS.AUTHORIZATION] = `Bearer ${token}`;
      }

      // Add rate limiting headers
      config.headers['X-RateLimit-Limit'] = DEFAULT_API_CONFIG.RATE_LIMIT;

      // Add request signature for additional security
      const signature = generateRequestSignature(config);
      config.headers['X-Request-Signature'] = signature;

      return config;
    } catch (error) {
      return Promise.reject(error);
    }
  },
  error => Promise.reject(error)
);

/**
 * Response interceptor for handling responses and errors
 */
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    try {
      // Complete request timing
      const duration = Date.now() - response.config.metadata.startTime;
      
      // Monitor rate limit status
      const remainingRequests = response.headers['x-ratelimit-remaining'];
      if (remainingRequests && parseInt(remainingRequests) < 100) {
        console.warn('Rate limit threshold approaching');
      }

      // Log response metrics
      logApiMetrics({
        endpoint: response.config.url!,
        duration,
        status: response.status,
        size: JSON.stringify(response.data).length
      });

      return response.data;
    } catch (error) {
      return Promise.reject(error);
    }
  },
  async (error: AxiosError) => {
    try {
      const originalRequest = error.config;

      // Handle 401 Unauthorized with token refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        // Token refresh logic would go here
        return axiosInstance(originalRequest);
      }

      // Handle rate limiting with exponential backoff
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        await new Promise(resolve => setTimeout(resolve, (parseInt(retryAfter) || 1) * 1000));
        return axiosInstance(originalRequest);
      }

      // Transform error for consistent handling
      const apiError = transformError(error);
      logApiError(apiError);

      return Promise.reject(apiError);
    } catch (error) {
      return Promise.reject(error);
    }
  }
);

/**
 * Generates request signature for security validation
 */
function generateRequestSignature(config: AxiosRequestConfig): string {
  const timestamp = Date.now().toString();
  const payload = `${config.method}:${config.url}:${timestamp}`;
  // In production, use a proper crypto library for HMAC
  return Buffer.from(payload).toString('base64');
}

/**
 * Logs API metrics for monitoring
 */
function logApiMetrics(metrics: {
  endpoint: string;
  duration: number;
  status: number;
  size: number;
}): void {
  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'development') {
    console.log('[API Metrics]', metrics);
  }
}

/**
 * Transforms Axios error into application-specific error
 */
function transformError(error: AxiosError): AuthenticationError {
  if (error.response) {
    switch (error.response.status) {
      case 401:
        return new AuthenticationError(
          AuthErrorType.INVALID_TOKEN,
          'Authentication token is invalid or expired'
        );
      case 403:
        return new AuthenticationError(
          AuthErrorType.PERMISSION_DENIED,
          'Insufficient permissions for this request'
        );
      case 429:
        return new AuthenticationError(
          AuthErrorType.SUSPICIOUS_ACTIVITY,
          'Too many requests, please try again later'
        );
      default:
        return new AuthenticationError(
          AuthErrorType.NETWORK_ERROR,
          error.response.data?.message || 'An unexpected error occurred'
        );
    }
  }
  
  return new AuthenticationError(
    AuthErrorType.NETWORK_ERROR,
    'Network error occurred'
  );
}

/**
 * Logs API errors for monitoring
 */
function logApiError(error: AuthenticationError): void {
  // In production, send to error monitoring service
  if (process.env.NODE_ENV === 'development') {
    console.error('[API Error]', {
      type: error.type,
      message: error.message,
      metadata: error.metadata
    });
  }
}

export default axiosInstance;