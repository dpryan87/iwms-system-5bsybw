// @package inversify v6.0.1
// @package inversify-express-utils v6.4.3
// @package express v4.18.2
import { injectable } from 'inversify';
import { 
  controller, 
  httpGet, 
  httpPost, 
  httpPut,
  request,
  response
} from 'inversify-express-utils';
import { Request, Response } from 'express';
import { compress, rateLimit } from 'express';

import { ResourceService } from '../services/resource.service';
import { resourceSchema, validateResourceAttributes } from '../validation/resource.schema';
import { ErrorHandler } from '@common/error';
import { sanitizeInput } from '../../../common/utils/validation.util';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../../common/constants/messages';
import { ErrorCodes } from '../../../common/constants/error-codes';
import { IResource, ResourceType, IResourceSearchCriteria } from '../interfaces/resource.interface';

/**
 * REST API controller for workplace resource management
 * Implements secure, validated, and monitored HTTP endpoints
 */
@injectable()
@controller('/api/v1/resources')
@compress()
@rateLimit({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})
export class ResourceController {
  constructor(
    private readonly resourceService: ResourceService,
    private readonly errorHandler: ErrorHandler
  ) {}

  /**
   * Creates a new workplace resource with validation
   * @route POST /api/v1/resources
   */
  @httpPost('/')
  async createResource(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      // Sanitize input data
      const sanitizedData = this.sanitizeResourceData(req.body);

      // Validate request payload
      const validationResult = await resourceSchema.validate(sanitizedData);
      if (!validationResult.isValid) {
        return this.errorHandler.handleError(res, {
          code: ErrorCodes.VALIDATION_ERROR,
          message: ERROR_MESSAGES.VALIDATION_ERROR.replace(
            '{details}',
            validationResult.errors?.join(', ') || ''
          )
        });
      }

      // Validate type-specific attributes
      const attributesValidation = validateResourceAttributes(
        sanitizedData.attributes,
        sanitizedData.type as ResourceType
      );
      if (attributesValidation.error) {
        return this.errorHandler.handleError(res, {
          code: ErrorCodes.VALIDATION_ERROR,
          message: ERROR_MESSAGES.VALIDATION_ERROR.replace(
            '{details}',
            attributesValidation.error.details.map(d => d.message).join(', ')
          )
        });
      }

      // Create resource
      const resource = await this.resourceService.createResource(sanitizedData);

      // Set cache control and ETag
      const etag = this.generateETag(resource);
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

      return res.status(201).json({
        message: SUCCESS_MESSAGES.RESOURCE_CREATED
          .replace('{resourceType}', resource.type)
          .replace('{resourceId}', resource.id),
        data: resource
      });

    } catch (error) {
      return this.errorHandler.handleError(res, error);
    }
  }

  /**
   * Retrieves paginated resources in a space with caching
   * @route GET /api/v1/resources/space/:spaceId
   */
  @httpGet('/space/:spaceId')
  async getResourcesBySpace(
    @request() req: Request,
    @response() res: Response
  ): Promise<Response> {
    try {
      const spaceId = sanitizeInput(req.params.spaceId);
      
      // Validate pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      if (page < 1 || limit < 1 || limit > 100) {
        return this.errorHandler.handleError(res, {
          code: ErrorCodes.VALIDATION_ERROR,
          message: ERROR_MESSAGES.VALIDATION_ERROR.replace(
            '{details}',
            'Invalid pagination parameters'
          )
        });
      }

      // Build search criteria
      const criteria: IResourceSearchCriteria = {
        page,
        limit,
        types: req.query.types ? (req.query.types as string).split(',') as ResourceType[] : undefined,
        statuses: req.query.statuses ? (req.query.statuses as string).split(',') : undefined,
        capacityRange: req.query.minCapacity && req.query.maxCapacity ? {
          min: parseInt(req.query.minCapacity as string),
          max: parseInt(req.query.maxCapacity as string)
        } : undefined
      };

      // Check conditional request headers
      const ifNoneMatch = req.header('If-None-Match');
      const cacheKey = this.generateCacheKey(spaceId, criteria);
      
      if (ifNoneMatch && ifNoneMatch === cacheKey) {
        return res.status(304).send();
      }

      // Get resources
      const result = await this.resourceService.getResourcesBySpace(spaceId, criteria);

      // Set cache headers
      res.setHeader('ETag', cacheKey);
      res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes cache

      return res.status(200).json({
        message: SUCCESS_MESSAGES.OPERATION_SUCCESSFUL.replace(
          '{details}',
          `Retrieved ${result.items.length} resources`
        ),
        data: result
      });

    } catch (error) {
      return this.errorHandler.handleError(res, error);
    }
  }

  /**
   * Sanitizes resource input data
   * @private
   */
  private sanitizeResourceData(data: any): IResource {
    return {
      ...data,
      attributes: {
        ...data.attributes,
        name: sanitizeInput(data.attributes.name, { maxLength: 100 }),
        description: data.attributes.description ? 
          sanitizeInput(data.attributes.description, { maxLength: 500 }) : 
          undefined,
        location: sanitizeInput(data.attributes.location, { 
          allowSpecialChars: false 
        })
      }
    };
  }

  /**
   * Generates ETag for resource caching
   * @private
   */
  private generateETag(resource: IResource): string {
    return Buffer.from(JSON.stringify({
      id: resource.id,
      updatedAt: resource.updatedAt
    })).toString('base64');
  }

  /**
   * Generates cache key for space resources
   * @private
   */
  private generateCacheKey(spaceId: string, criteria: IResourceSearchCriteria): string {
    return Buffer.from(JSON.stringify({
      spaceId,
      criteria,
      timestamp: Math.floor(Date.now() / 300000) // 5-minute granularity
    })).toString('base64');
  }
}