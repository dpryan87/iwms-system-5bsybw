/**
 * @fileoverview Enhanced User Routes with comprehensive security features
 * Implements secure RBAC-based routing with rate limiting and request validation
 * @version 1.0.0
 */

// External dependencies
import { Router } from 'express'; // v4.18.2
import { authenticate, authorize } from 'inversify-express-utils'; // v6.3.2
import rateLimit from 'express-rate-limit'; // v6.7.0

// Internal imports
import { UserController } from '../controllers/user.controller';
import { UserRole } from '../interfaces/user.interface';
import { validateSchema } from '../../../common/utils/validation.util';
import { createUserSchema, updateUserSchema } from '../validation/user.schema';
import { ErrorCodes } from '../../../common/constants/error-codes';

// Route prefix constant
const ROUTE_PREFIX = '/api/users';

// Rate limiting configuration
const rateLimitConfig = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Configures and returns Express router with secured user management endpoints
 * Implements RBAC, rate limiting, and request validation
 */
const configureUserRoutes = (): Router => {
  const router = Router();

  // Apply rate limiting to all routes
  router.use(rateLimitConfig);

  // Create new user - SYSTEM_ADMIN only
  router.post('/',
    authenticate(),
    authorize([UserRole.SYSTEM_ADMIN]),
    async (req, res) => {
      try {
        // Validate request body
        const validationResult = await validateSchema(req.body, createUserSchema);
        if (!validationResult.isValid) {
          return res.status(ErrorCodes.VALIDATION_ERROR).json({
            error: 'Validation failed',
            details: validationResult.errors
          });
        }

        const result = await UserController.createUser(req.body);
        return res.status(201).json(result);
      } catch (error) {
        return res.status(error.code || ErrorCodes.INTERNAL_SERVER_ERROR).json({
          error: error.message,
          code: error.code
        });
      }
    }
  );

  // Update user - SYSTEM_ADMIN or self update
  router.put('/:id',
    authenticate(),
    authorize([UserRole.SYSTEM_ADMIN, UserRole.FACILITY_MANAGER]),
    async (req, res) => {
      try {
        const userId = req.params.id;

        // Validate self-update permission
        if (req.user.role !== UserRole.SYSTEM_ADMIN && req.user.id !== userId) {
          return res.status(ErrorCodes.AUTHORIZATION_ERROR).json({
            error: 'Insufficient permissions to update user',
            code: ErrorCodes.AUTHORIZATION_ERROR
          });
        }

        // Validate request body
        const validationResult = await validateSchema(req.body, updateUserSchema);
        if (!validationResult.isValid) {
          return res.status(ErrorCodes.VALIDATION_ERROR).json({
            error: 'Validation failed',
            details: validationResult.errors
          });
        }

        const result = await UserController.updateUser(userId, req.body);
        return res.json(result);
      } catch (error) {
        return res.status(error.code || ErrorCodes.INTERNAL_SERVER_ERROR).json({
          error: error.message,
          code: error.code
        });
      }
    }
  );

  // Delete user - SYSTEM_ADMIN only
  router.delete('/:id',
    authenticate(),
    authorize([UserRole.SYSTEM_ADMIN]),
    async (req, res) => {
      try {
        const userId = req.params.id;
        await UserController.deleteUser(userId);
        return res.status(204).send();
      } catch (error) {
        return res.status(error.code || ErrorCodes.INTERNAL_SERVER_ERROR).json({
          error: error.message,
          code: error.code
        });
      }
    }
  );

  // Get user by ID - Authenticated users
  router.get('/:id',
    authenticate(),
    async (req, res) => {
      try {
        const userId = req.params.id;
        const result = await UserController.getUserById(userId);
        return res.json(result);
      } catch (error) {
        return res.status(error.code || ErrorCodes.INTERNAL_SERVER_ERROR).json({
          error: error.message,
          code: error.code
        });
      }
    }
  );

  // Get user by email - Authenticated users
  router.get('/email/:email',
    authenticate(),
    async (req, res) => {
      try {
        const email = req.params.email;
        const result = await UserController.getUserByEmail(email);
        return res.json(result);
      } catch (error) {
        return res.status(error.code || ErrorCodes.INTERNAL_SERVER_ERROR).json({
          error: error.message,
          code: error.code
        });
      }
    }
  );

  return router;
};

// Export configured router
export const userRouter = configureUserRoutes();