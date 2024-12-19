// External imports
import { createSelector } from '@reduxjs/toolkit'; // ^1.9.5

// Internal imports
import { 
  ILease, 
  LeaseStatus, 
  ILeaseFinancials, 
  ILeaseNotification,
  NotificationStatus 
} from '../../types/lease.types';

// Types
interface RootState {
  lease: ILeaseState;
}

interface ILeaseState {
  leases: ILease[];
  loading: boolean;
  error: string | null;
  selectedLeaseId: string | null;
}

/**
 * Base selector to access the lease state slice from root state
 * @param state - Root application state
 * @returns The complete lease state slice
 */
export const selectLeaseState = (state: RootState): ILeaseState => state.lease;

/**
 * Memoized selector to retrieve all leases
 * Optimized for minimal recomputation when lease data changes
 */
export const selectAllLeases = createSelector(
  [selectLeaseState],
  (leaseState): ILease[] => leaseState.leases
);

/**
 * Memoized selector to get a specific lease by ID
 * @param leaseId - Unique identifier of the lease
 */
export const selectLeaseById = createSelector(
  [selectAllLeases, (_state: RootState, leaseId: string) => leaseId],
  (leases, leaseId): ILease | undefined => 
    leases.find(lease => lease.id === leaseId)
);

/**
 * Memoized selector to get leases filtered by status
 * @param status - Desired lease status to filter by
 */
export const selectLeasesByStatus = createSelector(
  [selectAllLeases, (_state: RootState, status: LeaseStatus) => status],
  (leases, status): ILease[] =>
    leases.filter(lease => lease.status === status)
);

/**
 * Memoized selector for accessing lease financial data with calculations
 * Includes computed metrics and aggregated financial information
 */
export const selectLeaseFinancials = createSelector(
  [selectLeaseById],
  (lease): ILeaseFinancials | undefined => {
    if (!lease) return undefined;

    const { financials } = lease;
    
    // Return enhanced financial data with computed metrics
    return {
      ...financials,
      totalMonthlyObligations: 
        financials.baseRent +
        financials.operatingCosts +
        financials.utilities +
        financials.propertyTax +
        financials.insurance,
      outstandingPayments: financials.paymentSchedule.filter(
        payment => payment.status === 'PENDING' || payment.status === 'OVERDUE'
      ),
      nextEscalation: financials.escalationSchedule.find(
        escalation => !escalation.applied && new Date(escalation.effectiveDate) > new Date()
      )
    };
  }
);

/**
 * Memoized selector for lease notifications with filtering and prioritization
 * Handles notification filtering, sorting, and status-based grouping
 */
export const selectLeaseNotifications = createSelector(
  [selectLeaseById],
  (lease): ILeaseNotification[] => {
    if (!lease) return [];

    return lease.notifications
      .filter(notification => 
        notification.status !== NotificationStatus.RESOLVED
      )
      .sort((a, b) => {
        // Sort by status priority
        const statusPriority = {
          [NotificationStatus.ESCALATED]: 0,
          [NotificationStatus.PENDING]: 1,
          [NotificationStatus.SENT]: 2,
          [NotificationStatus.ACKNOWLEDGED]: 3
        };

        // First sort by status priority
        const statusDiff = 
          statusPriority[a.status] - statusPriority[b.status];
        
        if (statusDiff !== 0) return statusDiff;

        // Then sort by date
        return new Date(b.triggerDate).getTime() - 
               new Date(a.triggerDate).getTime();
      });
  }
);

/**
 * Memoized selector for upcoming lease renewals
 * Filters and sorts leases based on renewal deadlines
 */
export const selectUpcomingRenewals = createSelector(
  [selectAllLeases],
  (leases): ILease[] => {
    const today = new Date();
    const threeMonthsFromNow = new Date(
      today.getFullYear(),
      today.getMonth() + 3,
      today.getDate()
    );

    return leases
      .filter(lease => 
        lease.status === LeaseStatus.ACTIVE &&
        lease.renewal.isEligible &&
        new Date(lease.renewal.deadlineDate) <= threeMonthsFromNow
      )
      .sort((a, b) => 
        new Date(a.renewal.deadlineDate).getTime() - 
        new Date(b.renewal.deadlineDate).getTime()
      );
  }
);

/**
 * Memoized selector for lease financial metrics
 * Calculates aggregate financial metrics across all leases
 */
export const selectLeaseFinancialMetrics = createSelector(
  [selectAllLeases],
  (leases) => {
    const metrics = leases.reduce((acc, lease) => {
      const { financials } = lease;
      return {
        totalAnnualRent: acc.totalAnnualRent + (lease.annualRent || 0),
        totalOutstandingBalance: 
          acc.totalOutstandingBalance + financials.outstandingBalance,
        totalSecurityDeposits: 
          acc.totalSecurityDeposits + lease.terms.securityDeposit,
        activeLeaseCount: 
          acc.activeLeaseCount + (lease.status === LeaseStatus.ACTIVE ? 1 : 0)
      };
    }, {
      totalAnnualRent: 0,
      totalOutstandingBalance: 0,
      totalSecurityDeposits: 0,
      activeLeaseCount: 0
    });

    return {
      ...metrics,
      averageAnnualRent: 
        metrics.activeLeaseCount > 0 
          ? metrics.totalAnnualRent / metrics.activeLeaseCount 
          : 0
    };
  }
);