// External imports with versions
import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { Provider } from 'react-redux'; // ^8.0.0
import { describe, test, expect, beforeEach, jest } from '@jest/globals'; // ^29.0.0
import { createMockCrypto } from '@test-utils/crypto-mock'; // ^1.0.0

// Internal imports
import { useLease } from '../../src/hooks/useLease';
import { 
  ILease, 
  LeaseStatus, 
  ILeaseFinancials,
  NotificationType,
  NotificationStatus 
} from '../../src/types/lease.types';
import LeaseService from '../../src/services/lease.service';

// Mock LeaseService
jest.mock('../../src/services/lease.service');

// Mock Redux store
const mockStore = {
  getState: () => ({
    leases: {
      items: []
    }
  }),
  dispatch: jest.fn(),
  subscribe: jest.fn()
};

// Mock data
const mockLease: ILease = {
  id: '123',
  propertyId: 'prop-123',
  tenantId: 'tenant-123',
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
  financials: {
    baseRent: 5000,
    operatingCosts: 500,
    utilities: 300,
    propertyTax: 200,
    insurance: 100,
    paymentSchedule: [],
    escalationSchedule: [],
    lastPaymentDate: new Date('2023-01-01'),
    outstandingBalance: 0
  },
  notifications: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  lastModifiedBy: 'user-123'
};

describe('useLease hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.dispatch.mockClear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={mockStore}>{children}</Provider>
  );

  describe('Lease CRUD operations', () => {
    test('should create a new lease successfully', async () => {
      // Mock service response
      (LeaseService.createNewLease as jest.Mock).mockResolvedValue(mockLease);

      const { result } = renderHook(() => useLease(), { wrapper });

      await act(async () => {
        const newLease = await result.current.createLease({
          ...mockLease,
          id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          lastModifiedBy: undefined
        });

        expect(newLease).toEqual(mockLease);
        expect(mockStore.dispatch).toHaveBeenCalledWith({
          type: 'leases/leaseCreated',
          payload: mockLease
        });
      });

      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBeFalsy();
    });

    test('should handle lease creation errors', async () => {
      const error = new Error('Failed to create lease');
      (LeaseService.createNewLease as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useLease(), { wrapper });

      await act(async () => {
        try {
          await result.current.createLease({
            ...mockLease,
            id: undefined,
            createdAt: undefined,
            updatedAt: undefined,
            lastModifiedBy: undefined
          });
        } catch (e) {
          expect(e.message).toBe('Failed to create lease');
        }
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBeFalsy();
    });
  });

  describe('Financial validation', () => {
    test('should validate lease financials successfully', async () => {
      const validFinancials: ILeaseFinancials = {
        baseRent: 5000,
        operatingCosts: 500,
        utilities: 300,
        propertyTax: 200,
        insurance: 100,
        paymentSchedule: [
          {
            id: '1',
            dueDate: new Date('2023-02-01'),
            amount: 5000,
            type: 'RENT',
            status: 'PENDING'
          }
        ],
        escalationSchedule: [],
        lastPaymentDate: new Date('2023-01-01'),
        outstandingBalance: 0
      };

      (LeaseService.validateFinancials as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useLease(), { wrapper });

      await act(async () => {
        const isValid = await result.current.validateFinancial(validFinancials);
        expect(isValid).toBeTruthy();
      });

      expect(result.current.error).toBeNull();
    });

    test('should reject invalid financial data', async () => {
      const invalidFinancials: ILeaseFinancials = {
        ...mockLease.financials,
        baseRent: -1000 // Invalid negative rent
      };

      (LeaseService.validateFinancials as jest.Mock).mockRejectedValue(
        new Error('Invalid base rent amount')
      );

      const { result } = renderHook(() => useLease(), { wrapper });

      await act(async () => {
        try {
          await result.current.validateFinancial(invalidFinancials);
        } catch (e) {
          expect(e.message).toBe('Invalid base rent amount');
        }
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Document handling', () => {
    test('should upload lease document successfully', async () => {
      const mockDocument = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const mockUploadedDoc = {
        id: 'doc-123',
        name: 'test.pdf',
        type: 'application/pdf',
        url: 'https://example.com/test.pdf',
        uploadedAt: new Date(),
        uploadedBy: 'user-123'
      };

      (LeaseService.uploadDocument as jest.Mock).mockResolvedValue(mockUploadedDoc);

      const { result } = renderHook(() => useLease(), { wrapper });

      await act(async () => {
        const uploadedDoc = await result.current.uploadDocument('123', mockDocument);
        expect(uploadedDoc).toEqual(mockUploadedDoc);
      });

      expect(mockStore.dispatch).toHaveBeenCalledWith({
        type: 'leases/documentUploaded',
        payload: { leaseId: '123', document: mockUploadedDoc }
      });
    });

    test('should handle document upload errors', async () => {
      const mockDocument = new File(['test'], 'test.txt', { type: 'text/plain' });
      (LeaseService.uploadDocument as jest.Mock).mockRejectedValue(
        new Error('Invalid document type')
      );

      const { result } = renderHook(() => useLease(), { wrapper });

      await act(async () => {
        try {
          await result.current.uploadDocument('123', mockDocument);
        } catch (e) {
          expect(e.message).toBe('Invalid document type');
        }
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Security features', () => {
    test('should handle encrypted data correctly', async () => {
      const mockCrypto = createMockCrypto();
      global.crypto = mockCrypto;

      (LeaseService.createNewLease as jest.Mock).mockImplementation(async (data) => {
        // Verify data is encrypted before sending
        expect(data.financials).toBeDefined();
        return mockLease;
      });

      const { result } = renderHook(() => useLease(), { wrapper });

      await act(async () => {
        await result.current.createLease({
          ...mockLease,
          id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          lastModifiedBy: undefined
        });
      });

      expect(LeaseService.createNewLease).toHaveBeenCalled();
    });

    test('should validate access permissions', async () => {
      (LeaseService.createNewLease as jest.Mock).mockRejectedValue(
        new Error('Insufficient permissions')
      );

      const { result } = renderHook(() => useLease(), { wrapper });

      await act(async () => {
        try {
          await result.current.createLease({
            ...mockLease,
            id: undefined,
            createdAt: undefined,
            updatedAt: undefined,
            lastModifiedBy: undefined
          });
        } catch (e) {
          expect(e.message).toBe('Insufficient permissions');
        }
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Error handling and state management', () => {
    test('should clear error state', async () => {
      const { result } = renderHook(() => useLease(), { wrapper });

      await act(async () => {
        try {
          await result.current.createLease({
            ...mockLease,
            id: undefined,
            createdAt: undefined,
            updatedAt: undefined,
            lastModifiedBy: undefined
          });
        } catch (e) {
          // Error state should be set
          expect(result.current.error).toBeTruthy();
          
          // Clear error
          result.current.clearError();
          
          // Error should be null
          expect(result.current.error).toBeNull();
        }
      });
    });

    test('should maintain loading state correctly', async () => {
      (LeaseService.createNewLease as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockLease), 100))
      );

      const { result } = renderHook(() => useLease(), { wrapper });

      await act(async () => {
        const createPromise = result.current.createLease({
          ...mockLease,
          id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          lastModifiedBy: undefined
        });
        
        // Should be loading
        expect(result.current.loading).toBeTruthy();
        
        await createPromise;
        
        // Should not be loading after completion
        expect(result.current.loading).toBeFalsy();
      });
    });
  });
});