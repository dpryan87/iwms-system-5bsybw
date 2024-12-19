// External imports - @reduxjs/toolkit ^1.9.5
import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';

// Internal imports
import { 
  ILease, 
  LeaseStatus, 
  LeaseDocument, 
  NotificationType,
  NotificationStatus,
  ILeaseFinancials
} from '../../types/lease.types';

/**
 * Interface defining the lease reducer state structure with enhanced
 * security and financial tracking capabilities
 */
interface ILeaseState {
  leases: ILease[];
  selectedLease: ILease | null;
  loading: boolean;
  error: string | null;
  documentUploading: boolean;
  financialSyncStatus: 'idle' | 'syncing' | 'error';
  lastSyncTimestamp: number | null;
  auditTrail: Array<{
    action: string;
    timestamp: number;
    userId: string;
    details: Record<string, unknown>;
  }>;
}

/**
 * Initial state for the lease reducer with security and audit capabilities
 */
const initialState: ILeaseState = {
  leases: [],
  selectedLease: null,
  loading: false,
  error: null,
  documentUploading: false,
  financialSyncStatus: 'idle',
  lastSyncTimestamp: null,
  auditTrail: []
};

/**
 * Enhanced lease management slice with comprehensive CRUD operations,
 * document management, financial tracking, and security audit trails
 */
const leaseSlice = createSlice({
  name: 'lease',
  initialState,
  reducers: {
    // Lease CRUD Operations
    setLeases: (state, action: PayloadAction<ILease[]>) => {
      state.leases = action.payload;
      state.loading = false;
      state.error = null;
    },

    addLease: (state, action: PayloadAction<ILease>) => {
      state.leases.push(action.payload);
      state.auditTrail.push({
        action: 'CREATE_LEASE',
        timestamp: Date.now(),
        userId: action.payload.lastModifiedBy,
        details: { leaseId: action.payload.id }
      });
    },

    updateLease: (state, action: PayloadAction<ILease>) => {
      const index = state.leases.findIndex(lease => lease.id === action.payload.id);
      if (index !== -1) {
        state.leases[index] = action.payload;
        if (state.selectedLease?.id === action.payload.id) {
          state.selectedLease = action.payload;
        }
        state.auditTrail.push({
          action: 'UPDATE_LEASE',
          timestamp: Date.now(),
          userId: action.payload.lastModifiedBy,
          details: { leaseId: action.payload.id }
        });
      }
    },

    deleteLease: (state, action: PayloadAction<string>) => {
      state.leases = state.leases.filter(lease => lease.id !== action.payload);
      if (state.selectedLease?.id === action.payload) {
        state.selectedLease = null;
      }
      state.auditTrail.push({
        action: 'DELETE_LEASE',
        timestamp: Date.now(),
        userId: 'system', // Should be replaced with actual user ID
        details: { leaseId: action.payload }
      });
    },

    // Document Management
    setDocumentUploading: (state, action: PayloadAction<boolean>) => {
      state.documentUploading = action.payload;
    },

    addLeaseDocument: (state, action: PayloadAction<{ leaseId: string; document: LeaseDocument }>) => {
      const lease = state.leases.find(l => l.id === action.payload.leaseId);
      if (lease) {
        lease.documents.push(action.payload.document);
        state.auditTrail.push({
          action: 'ADD_DOCUMENT',
          timestamp: Date.now(),
          userId: action.payload.document.uploadedBy,
          details: { 
            leaseId: action.payload.leaseId,
            documentId: action.payload.document.id 
          }
        });
      }
    },

    // Financial Management
    updateFinancials: (state, action: PayloadAction<{ leaseId: string; financials: ILeaseFinancials }>) => {
      const lease = state.leases.find(l => l.id === action.payload.leaseId);
      if (lease) {
        lease.financials = action.payload.financials;
        state.auditTrail.push({
          action: 'UPDATE_FINANCIALS',
          timestamp: Date.now(),
          userId: lease.lastModifiedBy,
          details: { 
            leaseId: action.payload.leaseId,
            updateType: 'FINANCIAL_UPDATE'
          }
        });
      }
    },

    setFinancialSyncStatus: (state, action: PayloadAction<'idle' | 'syncing' | 'error'>) => {
      state.financialSyncStatus = action.payload;
      state.lastSyncTimestamp = Date.now();
    },

    // Notification Management
    addNotification: (state, action: PayloadAction<{ 
      leaseId: string; 
      type: NotificationType;
      message: string;
      recipients: string[];
    }>) => {
      const lease = state.leases.find(l => l.id === action.payload.leaseId);
      if (lease) {
        lease.notifications.push({
          id: crypto.randomUUID(),
          type: action.payload.type,
          triggerDate: new Date(),
          message: action.payload.message,
          status: NotificationStatus.PENDING,
          recipients: action.payload.recipients
        });
      }
    },

    // State Management
    setSelectedLease: (state, action: PayloadAction<string>) => {
      state.selectedLease = state.leases.find(lease => lease.id === action.payload) || null;
    },

    clearSelectedLease: (state) => {
      state.selectedLease = null;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },

    clearError: (state) => {
      state.error = null;
    }
  }
});

// Export actions
export const leaseActions = leaseSlice.actions;

// Export reducer
export const leaseReducer = leaseSlice.reducer;

// Memoized Selectors
export const selectAllLeases = (state: { lease: ILeaseState }) => state.lease.leases;

export const selectActiveLeases = createSelector(
  [selectAllLeases],
  (leases) => leases.filter(lease => lease.status === LeaseStatus.ACTIVE)
);

export const selectLeasesByStatus = createSelector(
  [selectAllLeases, (state: { lease: ILeaseState }, status: LeaseStatus) => status],
  (leases, status) => leases.filter(lease => lease.status === status)
);

export const selectUpcomingRenewals = createSelector(
  [selectAllLeases],
  (leases) => leases.filter(lease => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return lease.renewal.deadlineDate <= thirtyDaysFromNow && 
           lease.renewal.status === 'PENDING';
  })
);

export const selectLeasesByFinancialStatus = createSelector(
  [selectAllLeases, (state: { lease: ILeaseState }, minBalance: number) => minBalance],
  (leases, minBalance) => leases.filter(lease => 
    lease.financials.outstandingBalance > minBalance
  )
);

export const selectAuditTrail = (state: { lease: ILeaseState }) => state.lease.auditTrail;

// Type-safe selector for financial sync status
export const selectFinancialSyncStatus = (state: { lease: ILeaseState }) => ({
  status: state.lease.financialSyncStatus,
  lastSync: state.lease.lastSyncTimestamp
});