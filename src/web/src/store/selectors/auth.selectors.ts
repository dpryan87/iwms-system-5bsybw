// @package @reduxjs/toolkit v1.9.5
import { createSelector } from '@reduxjs/toolkit';
import { AuthState, IUser, UserRole } from '../../types/auth.types';

/**
 * Base selector to access the authentication state slice
 * Implements type-safe state access with strict null checks
 * 
 * @param state - Root application state
 * @returns Strongly typed authentication state
 */
export const selectAuthState = (state: { auth: AuthState }): AuthState => state.auth;

/**
 * Memoized selector for authentication status
 * Provides optimized boolean check for user authentication state
 * 
 * @returns Boolean indicating if user is authenticated
 */
export const selectIsAuthenticated = createSelector(
  [selectAuthState],
  (auth): boolean => auth.isAuthenticated
);

/**
 * Memoized selector for current user data
 * Implements null safety and complete user interface type checking
 * Aligned with ISO 27001 security requirements
 * 
 * @returns Current user data or null if not authenticated
 */
export const selectCurrentUser = createSelector(
  [selectAuthState],
  (auth): IUser | null => auth.user
);

/**
 * Enhanced role selector with strict type safety
 * Provides role-based access control information with null handling
 * Supports comprehensive RBAC implementation
 * 
 * @returns UserRole enum value or null if no user is authenticated
 */
export const selectUserRole = createSelector(
  [selectCurrentUser],
  (user): UserRole | null => user?.role ?? null
);

/**
 * Memoized selector for user permissions
 * Implements secure access to user permission array with null safety
 * 
 * @returns Array of permission strings or empty array if no user
 */
export const selectUserPermissions = createSelector(
  [selectCurrentUser],
  (user): string[] => user?.permissions ?? []
);

/**
 * Memoized selector for authentication loading state
 * Tracks authentication operations in progress
 * 
 * @returns Boolean indicating if authentication operation is in progress
 */
export const selectAuthLoading = createSelector(
  [selectAuthState],
  (auth): boolean => auth.loading
);

/**
 * Memoized selector for authentication errors
 * Provides type-safe access to error messages with null handling
 * 
 * @returns Error message string or null if no error
 */
export const selectAuthError = createSelector(
  [selectAuthState],
  (auth): string | null => auth.error
);

/**
 * Memoized selector for MFA requirement status
 * Tracks multi-factor authentication requirements
 * 
 * @returns Boolean indicating if MFA is required
 */
export const selectMfaRequired = createSelector(
  [selectAuthState],
  (auth): boolean => auth.isMfaRequired
);

/**
 * Memoized selector for session timeout status
 * Monitors user session expiration for security compliance
 * 
 * @returns Session timeout value in milliseconds
 */
export const selectSessionTimeout = createSelector(
  [selectAuthState],
  (auth): number => auth.sessionTimeout
);

/**
 * Memoized selector for last activity timestamp
 * Tracks user activity for session management
 * 
 * @returns Date of last activity or null if no activity recorded
 */
export const selectLastActivity = createSelector(
  [selectAuthState],
  (auth): Date | null => auth.lastActivity
);

/**
 * Memoized selector for security context
 * Provides access to additional security metadata
 * 
 * @returns Security context object with type safety
 */
export const selectSecurityContext = createSelector(
  [selectAuthState],
  (auth): Record<string, any> => auth.securityContext
);

/**
 * Permission check selector factory
 * Creates memoized selector for specific permission checks
 * 
 * @param permission - Permission string to check
 * @returns Memoized selector that returns boolean indicating permission status
 */
export const createPermissionSelector = (permission: string) => 
  createSelector(
    [selectUserPermissions],
    (permissions): boolean => permissions.includes(permission)
  );