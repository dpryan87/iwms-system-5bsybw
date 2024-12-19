// External imports with versions
import { useCallback, useState, useEffect } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0

// Internal imports
import { 
  ILease, 
  LeaseStatus, 
  LeaseDocument, 
  ILeaseFinancials,
  LeasePayload,
  LeaseSearchParams,
  NotificationType,
  NotificationStatus
} from '../types/lease.types';
import LeaseService from '../services/lease.service';

// Error types for enhanced error handling
interface LeaseError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Hook return type for better type safety
interface UseLeaseReturn {
  // State
  leases: ILease[];
  loading: boolean;
  error: LeaseError | null;
  selectedLease: ILease | null;
  
  // Actions
  createLease: (leaseData: LeasePayload) => Promise<ILease>;
  updateLease: (id: string, leaseData: Partial<ILease>) => Promise<ILease>;
  deleteLease: (id: string) => Promise<void>;
  uploadDocument: (leaseId: string, document: File) => Promise<LeaseDocument>;
  validateFinancial: (financials: ILeaseFinancials) => Promise<boolean>;
  searchLeases: (params: LeaseSearchParams) => Promise<ILease[]>;
  selectLease: (id: string) => void;
  clearError: () => void;
}

/**
 * Enhanced custom hook for managing lease operations with security features
 * and comprehensive financial tracking capabilities
 */
export const useLease = (): UseLeaseReturn => {
  // Redux setup
  const dispatch = useDispatch();
  const leases = useSelector((state: any) => state.leases.items);
  
  // Local state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<LeaseError | null>(null);
  const [selectedLease, setSelectedLease] = useState<ILease | null>(null);

  /**
   * Creates a new lease with enhanced validation and security
   */
  const createLease = useCallback(async (leaseData: LeasePayload): Promise<ILease> => {
    setLoading(true);
    setError(null);
    
    try {
      // Validate financial data before proceeding
      await validateFinancial(leaseData.financials);
      
      // Create lease with security measures
      const newLease = await LeaseService.createNewLease(leaseData);
      
      // Update Redux store
      dispatch({ type: 'leases/leaseCreated', payload: newLease });
      
      return newLease;
    } catch (err: any) {
      const leaseError: LeaseError = {
        code: err.code || 'LEASE_CREATE_ERROR',
        message: err.message || 'Failed to create lease',
        details: err.details
      };
      setError(leaseError);
      throw leaseError;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Updates an existing lease with validation and security checks
   */
  const updateLease = useCallback(async (
    id: string, 
    leaseData: Partial<ILease>
  ): Promise<ILease> => {
    setLoading(true);
    setError(null);

    try {
      // Validate financial data if included in update
      if (leaseData.financials) {
        await validateFinancial(leaseData.financials);
      }

      // Update lease with security measures
      const updatedLease = await LeaseService.updateExistingLease(id, leaseData);
      
      // Update Redux store
      dispatch({ type: 'leases/leaseUpdated', payload: updatedLease });
      
      return updatedLease;
    } catch (err: any) {
      const leaseError: LeaseError = {
        code: err.code || 'LEASE_UPDATE_ERROR',
        message: err.message || 'Failed to update lease',
        details: err.details
      };
      setError(leaseError);
      throw leaseError;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Uploads and processes lease documents with security measures
   */
  const uploadDocument = useCallback(async (
    leaseId: string, 
    document: File
  ): Promise<LeaseDocument> => {
    setLoading(true);
    setError(null);

    try {
      const uploadedDocument = await LeaseService.uploadDocument(leaseId, document);
      
      // Update Redux store with new document
      dispatch({
        type: 'leases/documentUploaded',
        payload: { leaseId, document: uploadedDocument }
      });
      
      return uploadedDocument;
    } catch (err: any) {
      const leaseError: LeaseError = {
        code: err.code || 'DOCUMENT_UPLOAD_ERROR',
        message: err.message || 'Failed to upload document',
        details: err.details
      };
      setError(leaseError);
      throw leaseError;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Validates lease financial data with integration checks
   */
  const validateFinancial = useCallback(async (
    financials: ILeaseFinancials
  ): Promise<boolean> => {
    try {
      return await LeaseService.validateFinancials(financials);
    } catch (err: any) {
      const leaseError: LeaseError = {
        code: err.code || 'FINANCIAL_VALIDATION_ERROR',
        message: err.message || 'Failed to validate financial data',
        details: err.details
      };
      setError(leaseError);
      throw leaseError;
    }
  }, []);

  /**
   * Searches leases based on provided parameters
   */
  const searchLeases = useCallback(async (
    params: LeaseSearchParams
  ): Promise<ILease[]> => {
    setLoading(true);
    setError(null);

    try {
      const searchResults = await LeaseService.getLease(params);
      dispatch({ type: 'leases/searchCompleted', payload: searchResults });
      return searchResults;
    } catch (err: any) {
      const leaseError: LeaseError = {
        code: err.code || 'LEASE_SEARCH_ERROR',
        message: err.message || 'Failed to search leases',
        details: err.details
      };
      setError(leaseError);
      throw leaseError;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Deletes a lease with security confirmation
   */
  const deleteLease = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await LeaseService.deleteLease(id);
      dispatch({ type: 'leases/leaseDeleted', payload: id });
    } catch (err: any) {
      const leaseError: LeaseError = {
        code: err.code || 'LEASE_DELETE_ERROR',
        message: err.message || 'Failed to delete lease',
        details: err.details
      };
      setError(leaseError);
      throw leaseError;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Selects a lease for detailed view/edit
   */
  const selectLease = useCallback((id: string) => {
    const lease = leases.find((l: ILease) => l.id === id);
    setSelectedLease(lease || null);
  }, [leases]);

  /**
   * Clears any existing error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Return hook interface
  return {
    // State
    leases,
    loading,
    error,
    selectedLease,
    
    // Actions
    createLease,
    updateLease,
    deleteLease,
    uploadDocument,
    validateFinancial,
    searchLeases,
    selectLease,
    clearError
  };
};

export default useLease;