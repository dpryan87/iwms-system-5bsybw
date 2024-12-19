// External imports with versions
import { createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.5
import { AxiosError } from 'axios'; // ^1.4.0
import { retry } from 'axios-retry'; // ^3.5.0

// Internal imports
import { 
  ILease, 
  LeaseStatus, 
  LeaseDocument, 
  ILeaseFinancials,
  LeasePayload,
  LeaseApiResponse
} from '../../types/lease.types';
import LeaseService from '../../services/lease.service';

// Action type constants
export const LEASE_ACTION_TYPES = {
  CREATE_LEASE: 'leases/create',
  UPDATE_LEASE: 'leases/update',
  UPLOAD_DOCUMENT: 'leases/uploadDocument',
  VALIDATE_FINANCIALS: 'leases/validateFinancials'
} as const;

// Error types for specific handling
interface LeaseError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Creates a new lease with enhanced security and financial validation
 */
export const createLease = createAsyncThunk<
  ILease,
  LeasePayload,
  { rejectValue: LeaseError }
>(
  LEASE_ACTION_TYPES.CREATE_LEASE,
  async (leaseData, { rejectWithValue }) => {
    try {
      // Validate financial terms before proceeding
      const isFinancialsValid = LeaseService.validateFinancials(leaseData.financials);
      if (!isFinancialsValid) {
        return rejectWithValue({
          code: 'INVALID_FINANCIALS',
          message: 'Lease financial terms validation failed'
        });
      }

      // Create lease with retry logic for network resilience
      const retryConfig = {
        retries: 3,
        retryDelay: (retryCount: number) => retryCount * 1000,
        retryCondition: (error: AxiosError) => {
          return error.response?.status === 503 || error.response?.status === 429;
        }
      };

      const createdLease = await retry(
        async () => LeaseService.createNewLease(leaseData),
        retryConfig
      );

      return createdLease;
    } catch (error) {
      if (error instanceof AxiosError) {
        return rejectWithValue({
          code: error.response?.status.toString() || 'UNKNOWN',
          message: error.message,
          details: error.response?.data
        });
      }
      return rejectWithValue({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while creating the lease'
      });
    }
  }
);

/**
 * Updates an existing lease with security measures and audit logging
 */
export const updateLease = createAsyncThunk<
  ILease,
  { leaseId: string; leaseData: Partial<LeasePayload> },
  { rejectValue: LeaseError }
>(
  LEASE_ACTION_TYPES.UPDATE_LEASE,
  async ({ leaseId, leaseData }, { rejectWithValue }) => {
    try {
      // Validate financial terms if they're being updated
      if (leaseData.financials) {
        const isFinancialsValid = LeaseService.validateFinancials(leaseData.financials);
        if (!isFinancialsValid) {
          return rejectWithValue({
            code: 'INVALID_FINANCIALS',
            message: 'Updated financial terms validation failed'
          });
        }
      }

      // Update lease with retry logic
      const retryConfig = {
        retries: 3,
        retryDelay: (retryCount: number) => retryCount * 1000,
        retryCondition: (error: AxiosError) => {
          return error.response?.status === 503 || error.response?.status === 429;
        }
      };

      const updatedLease = await retry(
        async () => LeaseService.updateExistingLease(leaseId, leaseData),
        retryConfig
      );

      return updatedLease;
    } catch (error) {
      if (error instanceof AxiosError) {
        return rejectWithValue({
          code: error.response?.status.toString() || 'UNKNOWN',
          message: error.message,
          details: error.response?.data
        });
      }
      return rejectWithValue({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while updating the lease'
      });
    }
  }
);

/**
 * Interface for document upload metadata
 */
interface IDocumentMetadata {
  type: string;
  description?: string;
  expiryDate?: Date;
  isConfidential: boolean;
}

/**
 * Uploads and encrypts lease documents with security measures
 */
export const uploadLeaseDocument = createAsyncThunk<
  LeaseDocument,
  { leaseId: string; document: File; metadata: IDocumentMetadata },
  { rejectValue: LeaseError }
>(
  LEASE_ACTION_TYPES.UPLOAD_DOCUMENT,
  async ({ leaseId, document, metadata }, { rejectWithValue }) => {
    try {
      // Validate document size and type
      const maxSize = 25 * 1024 * 1024; // 25MB
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

      if (document.size > maxSize) {
        return rejectWithValue({
          code: 'INVALID_DOCUMENT_SIZE',
          message: 'Document size exceeds maximum allowed size of 25MB'
        });
      }

      if (!allowedTypes.includes(document.type)) {
        return rejectWithValue({
          code: 'INVALID_DOCUMENT_TYPE',
          message: 'Document type not supported'
        });
      }

      // Upload document with encryption and retry logic
      const retryConfig = {
        retries: 3,
        retryDelay: (retryCount: number) => retryCount * 1000,
        retryCondition: (error: AxiosError) => {
          return error.response?.status === 503 || error.response?.status === 429;
        }
      };

      const uploadedDocument = await retry(
        async () => LeaseService.uploadEncryptedDocument(leaseId, document, metadata),
        retryConfig
      );

      return uploadedDocument;
    } catch (error) {
      if (error instanceof AxiosError) {
        return rejectWithValue({
          code: error.response?.status.toString() || 'UNKNOWN',
          message: error.message,
          details: error.response?.data
        });
      }
      return rejectWithValue({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while uploading the document'
      });
    }
  }
);

/**
 * Validates lease financial terms
 */
export const validateLeaseFinancials = createAsyncThunk<
  boolean,
  ILeaseFinancials,
  { rejectValue: LeaseError }
>(
  LEASE_ACTION_TYPES.VALIDATE_FINANCIALS,
  async (financials, { rejectWithValue }) => {
    try {
      const isValid = await LeaseService.validateFinancialTerms(financials);
      return isValid;
    } catch (error) {
      return rejectWithValue({
        code: 'VALIDATION_ERROR',
        message: 'Financial terms validation failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }
);