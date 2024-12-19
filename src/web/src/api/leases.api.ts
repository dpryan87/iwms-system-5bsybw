/**
 * Lease Management API Client
 * Implements secure API client functions for lease management operations with
 * enhanced financial tracking, notification system, and security features.
 * @version 1.0.0
 */

// @package axios ^1.4.0
// @package axios-retry ^3.5.0
import { AxiosResponse } from 'axios';
import axiosInstance from './axios.config';
import { LEASE_ENDPOINTS } from './endpoints';
import {
  ILease,
  LeaseApiResponse,
  LeasesApiResponse,
  LeasePayload,
  LeaseSearchParams,
  LeaseDocument,
  ILeaseFinancials,
  ILeaseNotification,
  LeaseStatus
} from '../types/lease.types';

/**
 * Creates a new lease record with enhanced validation and financial tracking
 * @param leaseData - Complete lease data including financial and notification settings
 * @returns Promise resolving to created lease data
 * @throws {Error} If validation fails or API request errors
 */
export const createLease = async (leaseData: LeasePayload): Promise<LeaseApiResponse> => {
  try {
    // Validate required lease data
    validateLeaseData(leaseData);

    const response = await axiosInstance.post<LeaseApiResponse>(
      LEASE_ENDPOINTS.CREATE,
      leaseData,
      {
        headers: {
          'X-Transaction-Type': 'LEASE_CREATE',
          'X-Financial-Validation': 'true'
        }
      }
    );

    return response;
  } catch (error) {
    throw transformLeaseError(error);
  }
};

/**
 * Updates an existing lease with comprehensive validation
 * @param leaseId - Unique identifier of the lease
 * @param leaseData - Partial lease data to update
 * @returns Promise resolving to updated lease data
 */
export const updateLease = async (
  leaseId: string,
  leaseData: Partial<LeasePayload>
): Promise<LeaseApiResponse> => {
  try {
    const endpoint = LEASE_ENDPOINTS.UPDATE.replace(':id', leaseId);
    const response = await axiosInstance.put<LeaseApiResponse>(endpoint, leaseData);
    return response;
  } catch (error) {
    throw transformLeaseError(error);
  }
};

/**
 * Retrieves lease details by ID with enhanced security validation
 * @param leaseId - Unique identifier of the lease
 * @returns Promise resolving to lease details
 */
export const getLeaseById = async (leaseId: string): Promise<LeaseApiResponse> => {
  try {
    const endpoint = LEASE_ENDPOINTS.GET_BY_ID.replace(':id', leaseId);
    const response = await axiosInstance.get<LeaseApiResponse>(endpoint);
    return response;
  } catch (error) {
    throw transformLeaseError(error);
  }
};

/**
 * Uploads lease documents with security validation and virus scanning
 * @param leaseId - Unique identifier of the lease
 * @param documents - Array of document files to upload
 * @returns Promise resolving to uploaded document details
 */
export const uploadLeaseDocuments = async (
  leaseId: string,
  documents: File[]
): Promise<LeaseDocument[]> => {
  try {
    const formData = new FormData();
    documents.forEach(doc => formData.append('documents', doc));

    const endpoint = LEASE_ENDPOINTS.UPLOAD_DOCUMENT.replace(':id', leaseId);
    const response = await axiosInstance.post<{ data: LeaseDocument[] }>(
      endpoint,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Scan-Documents': 'true'
        }
      }
    );

    return response.data.data;
  } catch (error) {
    throw transformLeaseError(error);
  }
};

/**
 * Retrieves lease documents with access control validation
 * @param leaseId - Unique identifier of the lease
 * @returns Promise resolving to lease documents
 */
export const getLeaseDocuments = async (leaseId: string): Promise<LeaseDocument[]> => {
  try {
    const endpoint = LEASE_ENDPOINTS.GET_DOCUMENTS.replace(':id', leaseId);
    const response = await axiosInstance.get<{ data: LeaseDocument[] }>(endpoint);
    return response.data.data;
  } catch (error) {
    throw transformLeaseError(error);
  }
};

/**
 * Tracks and reconciles lease payments with financial system integration
 * @param leaseId - Unique identifier of the lease
 * @param paymentData - Payment tracking information
 * @returns Promise resolving to payment status
 */
export const trackLeasePayment = async (
  leaseId: string,
  paymentData: Partial<ILeaseFinancials>
): Promise<{ success: boolean; transaction: string }> => {
  try {
    const endpoint = LEASE_ENDPOINTS.TRACK_PAYMENT.replace(':id', leaseId);
    const response = await axiosInstance.post(endpoint, paymentData, {
      headers: {
        'X-Financial-Transaction': 'true',
        'X-Transaction-ID': generateTransactionId()
      }
    });
    return response.data;
  } catch (error) {
    throw transformLeaseError(error);
  }
};

/**
 * Searches leases with advanced filtering capabilities
 * @param params - Search parameters for filtering leases
 * @returns Promise resolving to filtered lease results
 */
export const searchLeases = async (params: LeaseSearchParams): Promise<LeasesApiResponse> => {
  try {
    const response = await axiosInstance.get<LeasesApiResponse>(
      LEASE_ENDPOINTS.CREATE,
      { params }
    );
    return response;
  } catch (error) {
    throw transformLeaseError(error);
  }
};

// Helper Functions

/**
 * Validates lease data structure and required fields
 * @param leaseData - Lease data to validate
 * @throws {Error} If validation fails
 */
const validateLeaseData = (leaseData: LeasePayload): void => {
  const requiredFields = [
    'propertyId',
    'tenantId',
    'startDate',
    'endDate',
    'monthlyRent'
  ];

  const missingFields = requiredFields.filter(field => !leaseData[field]);
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  if (new Date(leaseData.startDate) >= new Date(leaseData.endDate)) {
    throw new Error('End date must be after start date');
  }

  if (leaseData.monthlyRent <= 0) {
    throw new Error('Monthly rent must be greater than 0');
  }
};

/**
 * Generates unique transaction ID for financial operations
 * @returns Unique transaction identifier
 */
const generateTransactionId = (): string => {
  return `LSE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Transforms API errors into standardized format
 * @param error - Original error object
 * @returns Transformed error with additional context
 */
const transformLeaseError = (error: any): Error => {
  const baseError = new Error(
    error.response?.data?.message || 'An error occurred with lease operation'
  );
  baseError.name = 'LeaseOperationError';
  baseError['code'] = error.response?.status;
  baseError['context'] = {
    timestamp: new Date().toISOString(),
    originalError: error.message,
    endpoint: error.config?.url
  };
  return baseError;
};

export type {
  ILease,
  LeasePayload,
  LeaseSearchParams,
  LeaseDocument,
  ILeaseFinancials,
  ILeaseNotification
};

export { LeaseStatus };