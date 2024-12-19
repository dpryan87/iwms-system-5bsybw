// @package jest ^29.0.0
// @package axios ^1.4.0

import { 
  handleApiError, 
  transformResponse, 
  buildQueryParams,
  isSuccessResponse 
} from '../../src/utils/api.utils';
import { HTTP_STATUS } from '../../src/constants/api.constants';
import { ERROR_MESSAGES } from '../../src/constants/error.constants';
import { AxiosError, AxiosResponse } from 'axios';

describe('API Utilities', () => {
  // Mock setup
  const mockAxiosError = (status: number, data?: any): AxiosError => ({
    isAxiosError: true,
    name: 'AxiosError',
    message: 'Mock Axios Error',
    config: {
      url: 'https://api.iwms.com/test',
      method: 'GET',
      headers: {}
    },
    response: {
      status,
      data,
      headers: {},
      statusText: 'Error',
      config: {}
    },
    toJSON: () => ({})
  } as AxiosError);

  const mockAxiosResponse = (status: number, data: any, headers = {}): AxiosResponse => ({
    status,
    data,
    headers: {
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-xss-protection': '1; mode=block',
      ...headers
    },
    statusText: 'OK',
    config: {
      url: 'https://api.iwms.com/test',
      method: 'GET'
    }
  } as AxiosResponse);

  describe('handleApiError', () => {
    it('should handle network errors with retry logic', async () => {
      const error = mockAxiosError(HTTP_STATUS.SERVICE_UNAVAILABLE);
      const result = await handleApiError(error);

      expect(result).toEqual(expect.objectContaining({
        success: false,
        type: 'https://api.iwms.com/errors/internal-error',
        status: HTTP_STATUS.SERVICE_UNAVAILABLE
      }));
    });

    it('should handle authentication errors', async () => {
      const error = mockAxiosError(HTTP_STATUS.UNAUTHORIZED);
      const result = await handleApiError(error);

      expect(result).toEqual(expect.objectContaining({
        success: false,
        type: 'https://api.iwms.com/errors/unauthorized',
        title: 'Authentication Required',
        status: HTTP_STATUS.UNAUTHORIZED
      }));
    });

    it('should handle rate limiting errors', async () => {
      const error = mockAxiosError(HTTP_STATUS.TOO_MANY_REQUESTS);
      const result = await handleApiError(error);

      expect(result).toEqual(expect.objectContaining({
        success: false,
        type: 'https://api.iwms.com/errors/rate-limit-exceeded',
        title: 'Too Many Requests',
        status: HTTP_STATUS.TOO_MANY_REQUESTS
      }));
    });

    it('should include validation errors from response', async () => {
      const validationErrors = {
        errors: {
          field1: ['Invalid value'],
          field2: ['Required field']
        }
      };
      const error = mockAxiosError(HTTP_STATUS.BAD_REQUEST, validationErrors);
      const result = await handleApiError(error);

      expect(result.errors).toEqual(validationErrors.errors);
    });
  });

  describe('transformResponse', () => {
    it('should transform successful response with security headers', () => {
      const mockData = { id: 1, name: 'Test' };
      const response = mockAxiosResponse(HTTP_STATUS.OK, mockData);
      const result = transformResponse(response);

      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: mockData,
        metadata: expect.objectContaining({
          headers: expect.objectContaining({
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'DENY',
            'x-xss-protection': '1; mode=block'
          })
        })
      }));
    });

    it('should validate required security headers', () => {
      const response = mockAxiosResponse(HTTP_STATUS.OK, {}, {});
      expect(() => transformResponse(response)).not.toThrow();
    });

    it('should handle empty response data', () => {
      const response = mockAxiosResponse(HTTP_STATUS.OK, null);
      expect(() => transformResponse(response)).toThrow('Invalid response format');
    });

    it('should include response metadata', () => {
      const mockData = { id: 1, name: 'Test' };
      const response = mockAxiosResponse(HTTP_STATUS.OK, mockData);
      const result = transformResponse(response);

      expect(result.metadata).toEqual(expect.objectContaining({
        timestamp: expect.any(String),
        status: HTTP_STATUS.OK
      }));
    });
  });

  describe('isSuccessResponse', () => {
    it('should identify successful response codes', () => {
      expect(isSuccessResponse({ status: HTTP_STATUS.OK })).toBe(true);
      expect(isSuccessResponse({ status: 201 })).toBe(true);
      expect(isSuccessResponse({ status: 204 })).toBe(true);
    });

    it('should identify error response codes', () => {
      expect(isSuccessResponse({ status: HTTP_STATUS.BAD_REQUEST })).toBe(false);
      expect(isSuccessResponse({ status: HTTP_STATUS.UNAUTHORIZED })).toBe(false);
      expect(isSuccessResponse({ status: HTTP_STATUS.FORBIDDEN })).toBe(false);
      expect(isSuccessResponse({ status: HTTP_STATUS.TOO_MANY_REQUESTS })).toBe(false);
    });

    it('should handle undefined status', () => {
      expect(isSuccessResponse({})).toBe(false);
      expect(isSuccessResponse(null)).toBe(false);
      expect(isSuccessResponse(undefined)).toBe(false);
    });
  });

  describe('buildQueryParams', () => {
    it('should build query string with proper encoding', () => {
      const params = {
        search: 'test query',
        page: 1,
        filters: ['active', 'pending']
      };
      const result = buildQueryParams(params);
      expect(result).toBe('search=test%20query&page=1&filters=active&filters=pending');
    });

    it('should handle null and undefined values', () => {
      const params = {
        param1: null,
        param2: undefined,
        param3: 'value'
      };
      const result = buildQueryParams(params);
      expect(result).toBe('param3=value');
    });

    it('should handle array parameters', () => {
      const params = {
        ids: [1, 2, 3],
        tags: ['tag1', 'tag2']
      };
      const result = buildQueryParams(params);
      expect(result).toBe('ids=1&ids=2&ids=3&tags=tag1&tags=tag2');
    });

    it('should encode special characters', () => {
      const params = {
        query: 'test&query=value',
        special: '@#$%'
      };
      const result = buildQueryParams(params);
      expect(result).toBe('query=test%26query%3Dvalue&special=%40%23%24%25');
    });
  });
});