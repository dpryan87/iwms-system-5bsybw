// @package inversify v6.0.1
// @package express v4.18.2
// @package inversify-express-utils v6.4.3
// @package express-rate-limit v6.7.0

import { injectable } from 'inversify';
import { Request, Response } from 'express';
import { controller, httpPost, httpPut, httpGet } from 'inversify-express-utils';
import rateLimit from 'express-rate-limit';

import { LeaseService } from '../services/lease.service';
import { 
  ILease, 
  LeaseStatus, 
  ILeaseDocument, 
  ILeaseAudit 
} from '../interfaces/lease.interface';
import { 
  errorHandler, 
  ValidationError 
} from '../../../common/middleware/error-handler.middleware';
import { logger } from '../../../common/utils/logger.util';
import { ERROR_MESSAGES } from '../../../common/constants/messages';
import { ErrorCodes } from '../../../common/constants/error-codes';

// Rate limiting configuration
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED
};

/**
 * Enhanced controller handling lease management HTTP endpoints
 * Implements secure operations with validation and audit capabilities
 */
@controller('/api/v1/leases')
@injectable()
export class LeaseController {
  constructor(
    private readonly leaseService: LeaseService,
    private readonly logger: typeof logger
  ) {}

  /**
   * Creates a new lease with enhanced validation and security
   * @route POST /api/v1/leases
   */
  @httpPost('/')
  @rateLimit(rateLimitConfig)
  async createLease(req: Request, res: Response): Promise<Response> {
    try {
      const correlationId = req.headers['x-correlation-id'] as string;
      this.logger.info('Creating new lease', { correlationId, body: req.body });

      const leaseData: Partial<ILease> = req.body;
      const validationResult = await this.leaseService.validateLeaseData(leaseData);

      if (!validationResult.isValid) {
        throw new ValidationError(
          'Lease validation failed',
          validationResult.errors
        );
      }

      const createdLease = await this.leaseService.createLease(leaseData);

      await this.leaseService.auditLeaseOperation({
        leaseId: createdLease.id,
        action: 'CREATE',
        userId: req.user?.id || 'SYSTEM',
        details: { correlationId }
      });

      return res.status(201).json(createdLease);
    } catch (error) {
      return errorHandler(error, req, res);
    }
  }

  /**
   * Updates lease status with security checks and audit trail
   * @route PUT /api/v1/leases/:id/status
   */
  @httpPut('/:id/status')
  @rateLimit(rateLimitConfig)
  async updateLeaseStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const correlationId = req.headers['x-correlation-id'] as string;

      this.logger.info('Updating lease status', { 
        correlationId, 
        leaseId: id, 
        status 
      });

      if (!Object.values(LeaseStatus).includes(status)) {
        throw new ValidationError('Invalid lease status', ['Status not supported']);
      }

      const updatedLease = await this.leaseService.updateLeaseStatus(id, status);

      await this.leaseService.auditLeaseOperation({
        leaseId: id,
        action: 'UPDATE_STATUS',
        userId: req.user?.id || 'SYSTEM',
        details: { 
          correlationId,
          oldStatus: updatedLease.status,
          newStatus: status
        }
      });

      return res.json(updatedLease);
    } catch (error) {
      return errorHandler(error, req, res);
    }
  }

  /**
   * Processes lease payment with enhanced security
   * @route POST /api/v1/leases/:id/payments
   */
  @httpPost('/:id/payments')
  @rateLimit(rateLimitConfig)
  async processPayment(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      const correlationId = req.headers['x-correlation-id'] as string;

      this.logger.info('Processing lease payment', { 
        correlationId, 
        leaseId: id, 
        amount 
      });

      const paymentResult = await this.leaseService.processLeasePayment(id, amount);

      await this.leaseService.auditLeaseOperation({
        leaseId: id,
        action: 'PROCESS_PAYMENT',
        userId: req.user?.id || 'SYSTEM',
        details: { 
          correlationId,
          amount,
          transactionId: paymentResult.transactionId
        }
      });

      return res.json(paymentResult);
    } catch (error) {
      return errorHandler(error, req, res);
    }
  }

  /**
   * Retrieves lease details with security checks
   * @route GET /api/v1/leases/:id
   */
  @httpGet('/:id')
  @rateLimit(rateLimitConfig)
  async getLease(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const correlationId = req.headers['x-correlation-id'] as string;

      this.logger.info('Retrieving lease details', { 
        correlationId, 
        leaseId: id 
      });

      const lease = await this.leaseService.getLease(id);

      if (!lease) {
        throw new ValidationError(
          ERROR_MESSAGES.RESOURCE_NOT_FOUND,
          ['Lease not found']
        );
      }

      await this.leaseService.auditLeaseOperation({
        leaseId: id,
        action: 'VIEW',
        userId: req.user?.id || 'SYSTEM',
        details: { correlationId }
      });

      return res.json(lease);
    } catch (error) {
      return errorHandler(error, req, res);
    }
  }
}