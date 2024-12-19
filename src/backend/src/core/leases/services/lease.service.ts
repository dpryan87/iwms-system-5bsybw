// @package inversify v6.0.1
// @package winston v3.8.2
// @package node-cron v3.0.2
// @package retry-ts v0.1.3
import { injectable } from 'inversify';
import { Logger } from 'winston';
import * as cron from 'node-cron';
import { retry, RetryPolicy } from 'retry-ts';

import { ILease, LeaseStatus, ILeaseDocument } from '../interfaces/lease.interface';
import { LeaseRepository } from '../repositories/lease.repository';
import { FinancialService } from '../../../integrations/financial/financial.service';

const RENEWAL_CHECK_SCHEDULE = '0 0 * * *'; // Daily at midnight
const RENEWAL_NOTICE_DAYS = 90;
const PAYMENT_RETRY_ATTEMPTS = 3;

/**
 * Enhanced service class implementing secure lease management business logic
 * with comprehensive monitoring and automation capabilities
 */
@injectable()
export class LeaseService {
  private readonly retryPolicy: RetryPolicy;

  constructor(
    private readonly leaseRepository: LeaseRepository,
    private readonly financialService: FinancialService,
    private readonly logger: Logger
  ) {
    this.setupRenewalChecker();
    this.initializeRetryPolicy();
  }

  /**
   * Creates a new lease with enhanced validation and security measures
   * @param leaseData - Lease data to create
   * @returns Promise resolving to created lease entity
   */
  async createLease(leaseData: Partial<ILease>): Promise<ILease> {
    try {
      this.logger.info('Creating new lease', { propertyId: leaseData.propertyId });

      // Validate lease data
      const validationResult = await this.validateLeaseData(leaseData);
      if (!validationResult.isValid) {
        throw new Error(`Invalid lease data: ${validationResult.errors.join(', ')}`);
      }

      // Create lease with secure repository
      const createdLease = await this.leaseRepository.createLease({
        ...leaseData,
        status: LeaseStatus.DRAFT,
        auditTrail: {
          changes: [{
            timestamp: new Date(),
            userId: leaseData.lastModifiedBy || 'SYSTEM',
            field: 'creation',
            oldValue: null,
            newValue: 'Lease created'
          }],
          reviews: []
        }
      });

      // Setup financial tracking
      await this.setupFinancialTracking(createdLease);

      this.logger.info('Lease created successfully', { leaseId: createdLease.id });
      return createdLease;
    } catch (error) {
      this.logger.error('Failed to create lease', { error, leaseData });
      throw error;
    }
  }

  /**
   * Updates lease status with enhanced security and financial sync
   * @param leaseId - Lease identifier
   * @param status - New lease status
   * @returns Promise resolving to updated lease
   */
  async updateLeaseStatus(leaseId: string, status: LeaseStatus): Promise<ILease> {
    try {
      this.logger.info('Updating lease status', { leaseId, status });

      // Validate status transition
      const currentLease = await this.leaseRepository.findOneOrFail(leaseId);
      this.validateStatusTransition(currentLease.status, status);

      // Update with retry mechanism
      const updatedLease = await retry(
        async () => this.leaseRepository.updateLease(leaseId, {
          status,
          auditTrail: {
            ...currentLease.auditTrail,
            changes: [
              ...currentLease.auditTrail.changes,
              {
                timestamp: new Date(),
                userId: 'SYSTEM',
                field: 'status',
                oldValue: currentLease.status,
                newValue: status
              }
            ]
          }
        }),
        this.retryPolicy
      );

      // Sync with financial system if needed
      if (this.requiresFinancialSync(status)) {
        await this.syncFinancialStatus(updatedLease);
      }

      this.logger.info('Lease status updated successfully', { leaseId, status });
      return updatedLease;
    } catch (error) {
      this.logger.error('Failed to update lease status', { error, leaseId, status });
      throw error;
    }
  }

  /**
   * Securely processes lease payment through financial system
   * @param leaseId - Lease identifier
   * @param amount - Payment amount
   * @returns Promise resolving to payment success status
   */
  async processLeasePayment(leaseId: string, amount: number): Promise<boolean> {
    try {
      this.logger.info('Processing lease payment', { leaseId, amount });

      const lease = await this.leaseRepository.findOneOrFail(leaseId);
      
      // Validate payment amount
      if (!this.validatePaymentAmount(lease, amount)) {
        throw new Error('Invalid payment amount');
      }

      // Process payment with retry mechanism
      const paymentResult = await retry(
        async () => this.financialService.processLeasePayment({
          id: `pmt-${Date.now()}`,
          leaseId,
          amount,
          currency: 'USD',
          dueDate: new Date(),
          status: 'PENDING',
          paymentMethod: lease.billingDetails.paymentMethod,
          processingGateway: 'default',
          securityHash: this.generateSecurityHash(leaseId, amount),
          auditTrail: []
        }),
        this.retryPolicy
      );

      if (paymentResult.success) {
        await this.updateLeasePaymentStatus(lease, paymentResult);
      }

      this.logger.info('Payment processed successfully', { 
        leaseId, 
        transactionId: paymentResult.transactionId 
      });
      
      return paymentResult.success;
    } catch (error) {
      this.logger.error('Failed to process payment', { error, leaseId, amount });
      throw error;
    }
  }

  /**
   * Enhanced scheduled task for lease renewal monitoring
   * @returns Promise resolving to void
   */
  private async checkLeaseRenewals(): Promise<void> {
    try {
      this.logger.info('Starting lease renewal check');

      const expiringLeases = await this.leaseRepository.findExpiringLeases(RENEWAL_NOTICE_DAYS);
      
      for (const lease of expiringLeases) {
        await this.processLeaseRenewal(lease);
      }

      this.logger.info('Lease renewal check completed', { 
        processed: expiringLeases.length 
      });
    } catch (error) {
      this.logger.error('Lease renewal check failed', { error });
      throw error;
    }
  }

  /**
   * Initializes retry policy for critical operations
   */
  private initializeRetryPolicy(): void {
    this.retryPolicy = {
      maxAttempts: PAYMENT_RETRY_ATTEMPTS,
      backoff: {
        initialDelay: 1000,
        maxDelay: 10000,
        factor: 2
      }
    };
  }

  /**
   * Sets up automated renewal checking schedule
   */
  private setupRenewalChecker(): void {
    cron.schedule(RENEWAL_CHECK_SCHEDULE, async () => {
      try {
        await this.checkLeaseRenewals();
      } catch (error) {
        this.logger.error('Scheduled renewal check failed', { error });
      }
    });
  }

  /**
   * Validates lease data comprehensively
   */
  private async validateLeaseData(data: Partial<ILease>): Promise<{ 
    isValid: boolean; 
    errors: string[] 
  }> {
    const errors: string[] = [];

    // Add comprehensive validation logic here
    if (!data.propertyId) errors.push('Property ID is required');
    if (!data.tenantId) errors.push('Tenant ID is required');
    if (!data.startDate || !data.endDate) errors.push('Lease dates are required');
    if (data.startDate && data.endDate && new Date(data.startDate) >= new Date(data.endDate)) {
      errors.push('End date must be after start date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates lease status transitions
   */
  private validateStatusTransition(currentStatus: LeaseStatus, newStatus: LeaseStatus): void {
    const validTransitions: Record<LeaseStatus, LeaseStatus[]> = {
      [LeaseStatus.DRAFT]: [LeaseStatus.PENDING_APPROVAL, LeaseStatus.ACTIVE],
      [LeaseStatus.PENDING_APPROVAL]: [LeaseStatus.ACTIVE, LeaseStatus.DRAFT],
      [LeaseStatus.ACTIVE]: [LeaseStatus.PENDING_RENEWAL, LeaseStatus.PENDING_TERMINATION],
      [LeaseStatus.PENDING_RENEWAL]: [LeaseStatus.ACTIVE, LeaseStatus.RENEWED],
      [LeaseStatus.RENEWED]: [LeaseStatus.ACTIVE],
      [LeaseStatus.PENDING_TERMINATION]: [LeaseStatus.TERMINATED],
      [LeaseStatus.TERMINATED]: [],
      [LeaseStatus.EXPIRED]: [],
      [LeaseStatus.IN_DISPUTE]: [LeaseStatus.ACTIVE, LeaseStatus.TERMINATED],
      [LeaseStatus.ON_HOLD]: [LeaseStatus.ACTIVE, LeaseStatus.TERMINATED]
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  /**
   * Processes lease renewal with notifications
   */
  private async processLeaseRenewal(lease: ILease): Promise<void> {
    const renewalDate = new Date(lease.endDate);
    renewalDate.setDate(renewalDate.getDate() - RENEWAL_NOTICE_DAYS);

    if (new Date() >= renewalDate && lease.status === LeaseStatus.ACTIVE) {
      await this.updateLeaseStatus(lease.id, LeaseStatus.PENDING_RENEWAL);
      
      // Additional renewal processing logic here
    }
  }

  /**
   * Checks if financial sync is required for status
   */
  private requiresFinancialSync(status: LeaseStatus): boolean {
    return [
      LeaseStatus.ACTIVE,
      LeaseStatus.RENEWED,
      LeaseStatus.TERMINATED
    ].includes(status);
  }

  /**
   * Syncs lease status with financial system
   */
  private async syncFinancialStatus(lease: ILease): Promise<void> {
    await this.financialService.syncFinancialData({
      entities: ['payments'],
      fullSync: false,
      validateOnly: false
    });
  }

  /**
   * Generates security hash for payment verification
   */
  private generateSecurityHash(leaseId: string, amount: number): string {
    return require('crypto')
      .createHash('sha256')
      .update(`${leaseId}${amount}${process.env.PAYMENT_SECRET}`)
      .digest('hex');
  }

  /**
   * Updates lease payment status after processing
   */
  private async updateLeasePaymentStatus(lease: ILease, paymentResult: any): Promise<void> {
    await this.leaseRepository.updateLease(lease.id, {
      billingDetails: {
        ...lease.billingDetails,
        lastPaymentDate: new Date(),
        lastPaymentAmount: paymentResult.amount,
        lastTransactionId: paymentResult.transactionId
      }
    });
  }
}