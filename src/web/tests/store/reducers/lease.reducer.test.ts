// External imports - versions specified
import { describe, it, expect, beforeEach } from 'jest'; // ^29.5.0

// Internal imports
import { leaseReducer } from '../../../src/store/reducers/lease.reducer';
import { leaseActions } from '../../../src/store/reducers/lease.reducer';
import { 
  createLease,
  updateLease,
  uploadLeaseDocument 
} from '../../../src/store/actions/lease.actions';
import { 
  ILease,
  LeaseStatus,
  NotificationType,
  NotificationStatus,
  ILeaseFinancials
} from '../../../src/types/lease.types';

describe('Lease Reducer', () => {
  // Mock initial state setup
  const initialState = {
    leases: [],
    selectedLease: null,
    loading: false,
    error: null,
    documentUploading: false,
    financialSyncStatus: 'idle' as const,
    lastSyncTimestamp: null,
    auditTrail: []
  };

  // Mock lease data
  const mockLease: ILease = {
    id: 'test-lease-1',
    propertyId: 'test-property-1',
    tenantId: 'test-tenant-1',
    status: LeaseStatus.ACTIVE,
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-12-31'),
    monthlyRent: 5000,
    annualRent: 60000,
    documents: [],
    terms: {
      securityDeposit: 10000,
      noticePeriod: 60,
      renewalOptions: {
        available: true,
        terms: 12,
        notificationPeriod: 90
      },
      specialClauses: [],
      restrictions: [],
      maintenanceResponsibilities: {
        landlord: [],
        tenant: []
      }
    },
    renewal: {
      isEligible: true,
      deadlineDate: new Date('2023-10-01'),
      status: 'PENDING',
    },
    financials: {
      baseRent: 5000,
      operatingCosts: 1000,
      utilities: 500,
      propertyTax: 800,
      insurance: 200,
      paymentSchedule: [],
      escalationSchedule: [],
      lastPaymentDate: new Date('2023-05-01'),
      outstandingBalance: 0
    },
    notifications: [],
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    lastModifiedBy: 'test-user'
  };

  beforeEach(() => {
    // Reset state before each test
    jest.clearAllMocks();
  });

  // CRUD Operation Tests
  describe('CRUD Operations', () => {
    it('should handle initial state', () => {
      expect(leaseReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    it('should handle setLeases action', () => {
      const leases = [mockLease];
      const newState = leaseReducer(initialState, leaseActions.setLeases(leases));
      expect(newState.leases).toEqual(leases);
      expect(newState.loading).toBeFalsy();
      expect(newState.error).toBeNull();
    });

    it('should handle addLease action', () => {
      const newState = leaseReducer(initialState, leaseActions.addLease(mockLease));
      expect(newState.leases).toHaveLength(1);
      expect(newState.leases[0]).toEqual(mockLease);
      expect(newState.auditTrail).toHaveLength(1);
      expect(newState.auditTrail[0].action).toBe('CREATE_LEASE');
    });

    it('should handle updateLease action', () => {
      const initialStateWithLease = {
        ...initialState,
        leases: [mockLease]
      };
      const updatedLease = {
        ...mockLease,
        monthlyRent: 6000
      };
      const newState = leaseReducer(initialStateWithLease, leaseActions.updateLease(updatedLease));
      expect(newState.leases[0].monthlyRent).toBe(6000);
      expect(newState.auditTrail).toHaveLength(1);
      expect(newState.auditTrail[0].action).toBe('UPDATE_LEASE');
    });

    it('should handle deleteLease action', () => {
      const initialStateWithLease = {
        ...initialState,
        leases: [mockLease]
      };
      const newState = leaseReducer(initialStateWithLease, leaseActions.deleteLease(mockLease.id));
      expect(newState.leases).toHaveLength(0);
      expect(newState.auditTrail).toHaveLength(1);
      expect(newState.auditTrail[0].action).toBe('DELETE_LEASE');
    });
  });

  // Document Management Tests
  describe('Document Management', () => {
    it('should handle document upload status', () => {
      const newState = leaseReducer(initialState, leaseActions.setDocumentUploading(true));
      expect(newState.documentUploading).toBeTruthy();
    });

    it('should handle adding lease document', () => {
      const initialStateWithLease = {
        ...initialState,
        leases: [mockLease]
      };
      const document = {
        id: 'doc-1',
        name: 'test-document.pdf',
        type: 'application/pdf',
        url: 'https://test.com/doc1',
        uploadedAt: new Date(),
        uploadedBy: 'test-user'
      };
      const newState = leaseReducer(
        initialStateWithLease,
        leaseActions.addLeaseDocument({ leaseId: mockLease.id, document })
      );
      expect(newState.leases[0].documents).toHaveLength(1);
      expect(newState.leases[0].documents[0]).toEqual(document);
      expect(newState.auditTrail).toHaveLength(1);
      expect(newState.auditTrail[0].action).toBe('ADD_DOCUMENT');
    });
  });

  // Financial Management Tests
  describe('Financial Management', () => {
    it('should handle updating financials', () => {
      const initialStateWithLease = {
        ...initialState,
        leases: [mockLease]
      };
      const updatedFinancials: ILeaseFinancials = {
        ...mockLease.financials,
        baseRent: 6000,
        outstandingBalance: 1000
      };
      const newState = leaseReducer(
        initialStateWithLease,
        leaseActions.updateFinancials({ leaseId: mockLease.id, financials: updatedFinancials })
      );
      expect(newState.leases[0].financials.baseRent).toBe(6000);
      expect(newState.leases[0].financials.outstandingBalance).toBe(1000);
      expect(newState.auditTrail).toHaveLength(1);
      expect(newState.auditTrail[0].action).toBe('UPDATE_FINANCIALS');
    });

    it('should handle financial sync status', () => {
      const newState = leaseReducer(initialState, leaseActions.setFinancialSyncStatus('syncing'));
      expect(newState.financialSyncStatus).toBe('syncing');
      expect(newState.lastSyncTimestamp).toBeTruthy();
    });
  });

  // Notification System Tests
  describe('Notification System', () => {
    it('should handle adding notifications', () => {
      const initialStateWithLease = {
        ...initialState,
        leases: [mockLease]
      };
      const notification = {
        leaseId: mockLease.id,
        type: NotificationType.PAYMENT_DUE,
        message: 'Payment due in 5 days',
        recipients: ['test-user']
      };
      const newState = leaseReducer(
        initialStateWithLease,
        leaseActions.addNotification(notification)
      );
      expect(newState.leases[0].notifications).toHaveLength(1);
      expect(newState.leases[0].notifications[0].type).toBe(NotificationType.PAYMENT_DUE);
      expect(newState.leases[0].notifications[0].status).toBe(NotificationStatus.PENDING);
    });
  });

  // State Management Tests
  describe('State Management', () => {
    it('should handle selecting lease', () => {
      const initialStateWithLease = {
        ...initialState,
        leases: [mockLease]
      };
      const newState = leaseReducer(
        initialStateWithLease,
        leaseActions.setSelectedLease(mockLease.id)
      );
      expect(newState.selectedLease).toEqual(mockLease);
    });

    it('should handle clearing selected lease', () => {
      const initialStateWithSelected = {
        ...initialState,
        leases: [mockLease],
        selectedLease: mockLease
      };
      const newState = leaseReducer(initialStateWithSelected, leaseActions.clearSelectedLease());
      expect(newState.selectedLease).toBeNull();
    });

    it('should handle error states', () => {
      const error = 'Test error message';
      const newState = leaseReducer(initialState, leaseActions.setError(error));
      expect(newState.error).toBe(error);
      expect(newState.loading).toBeFalsy();
    });

    it('should handle clearing errors', () => {
      const initialStateWithError = {
        ...initialState,
        error: 'Test error'
      };
      const newState = leaseReducer(initialStateWithError, leaseActions.clearError());
      expect(newState.error).toBeNull();
    });
  });
});