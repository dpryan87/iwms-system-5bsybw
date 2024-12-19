// @package typeorm v0.3.0
// @package typeorm-encrypted v0.8.0
import { 
  Entity, Column, PrimaryGeneratedColumn, 
  OneToMany, ManyToOne, BeforeUpdate 
} from 'typeorm';
import { Encrypt } from 'typeorm-encrypted';
import { 
  ILease, LeaseStatus, EscalationType,
  RenewalStatus, ComplianceStatus,
  ILeaseDocument, ILeaseTerms,
  ILeaseRenewal, LeaseAudit
} from '../interfaces/lease.interface';
import { leaseSchema } from '../validation/lease.schema';

/**
 * Enhanced TypeORM entity class representing a secure lease with audit trails
 * Implements comprehensive data security and compliance tracking
 */
@Entity('leases')
export class Lease implements ILease {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  propertyId: string;

  @Column('uuid')
  tenantId: string;

  @Column({
    type: 'enum',
    enum: LeaseStatus,
    default: LeaseStatus.DRAFT
  })
  status: LeaseStatus;

  @Column('timestamp')
  startDate: Date;

  @Column('timestamp')
  endDate: Date;

  @Encrypt()
  @Column('decimal', { precision: 10, scale: 2 })
  monthlyRent: number;

  @OneToMany(() => LeaseDocument, document => document.lease, {
    cascade: true,
    eager: true
  })
  documents: ILeaseDocument[];

  @Encrypt()
  @Column('jsonb')
  terms: ILeaseTerms;

  @Column('jsonb')
  renewal: ILeaseRenewal;

  @Column('jsonb')
  auditTrail: LeaseAudit;

  @Column({
    type: 'enum',
    enum: ComplianceStatus,
    default: ComplianceStatus.PENDING
  })
  complianceStatus: ComplianceStatus;

  @Column('varchar', { length: 255 })
  lastModifiedBy: string;

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  /**
   * Initializes a new secure lease entity with audit capabilities
   * @param data - Partial lease data for initialization
   */
  constructor(data?: Partial<ILease>) {
    if (data) {
      Object.assign(this, data);
      this.auditTrail = this.auditTrail || { changes: [], reviews: [] };
      this.documents = this.documents || [];
      this.complianceStatus = ComplianceStatus.PENDING;
      this.createdAt = new Date();
      this.updatedAt = new Date();
    }
  }

  /**
   * Validates lease data against enhanced security schema
   * @returns Promise<boolean> indicating validation success
   */
  async validate(): Promise<boolean> {
    try {
      const validationResult = await leaseSchema.validateAsync(this, {
        abortEarly: false,
        stripUnknown: true
      });
      return !!validationResult;
    } catch (error) {
      this.updateAuditTrail(
        'Validation failed',
        this.lastModifiedBy,
        error.details
      );
      return false;
    }
  }

  /**
   * Checks lease expiration with notification triggers
   * @returns boolean indicating if lease is expired
   */
  isExpired(): boolean {
    const currentDate = new Date();
    const isExpired = currentDate > this.endDate;

    if (isExpired && this.status !== LeaseStatus.EXPIRED) {
      this.status = LeaseStatus.EXPIRED;
      this.updateAuditTrail(
        'Lease expired',
        'SYSTEM',
        { oldStatus: this.status, newStatus: LeaseStatus.EXPIRED }
      );
    }

    return isExpired;
  }

  /**
   * Calculates lease renewal date with compliance checks
   * @returns Date indicating when renewal process should begin
   */
  calculateRenewalDate(): Date {
    const renewalNoticeDays = this.renewal?.noticePeriodDays || 90;
    const renewalDate = new Date(this.endDate);
    renewalDate.setDate(renewalDate.getDate() - renewalNoticeDays);

    if (renewalDate <= new Date() && 
        this.status !== LeaseStatus.PENDING_RENEWAL && 
        !this.isExpired()) {
      this.status = LeaseStatus.PENDING_RENEWAL;
      this.updateAuditTrail(
        'Lease pending renewal',
        'SYSTEM',
        { renewalDate, noticeDays: renewalNoticeDays }
      );
    }

    return renewalDate;
  }

  /**
   * Updates lease audit trail with change history
   * @param change - Description of the change
   * @param userId - ID of user making the change
   * @param details - Additional change details
   */
  updateAuditTrail(change: string, userId: string, details?: unknown): void {
    if (!this.auditTrail) {
      this.auditTrail = { changes: [], reviews: [] };
    }

    this.auditTrail.changes.push({
      timestamp: new Date(),
      userId,
      field: change,
      oldValue: null,
      newValue: details || null
    });

    this.lastModifiedBy = userId;
    this.updatedAt = new Date();
  }

  /**
   * Lifecycle hook to update timestamps and audit trail
   */
  @BeforeUpdate()
  updateTimestamps(): void {
    this.updatedAt = new Date();
  }
}

export { Lease };