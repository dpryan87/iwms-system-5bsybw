/**
 * Enhanced Protected Route Component
 * Implements secure route protection with comprehensive authentication,
 * role-based access control, and security monitoring.
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/auth.types';

/**
 * Security options for enhanced route protection
 */
interface SecurityOptions {
  enforceIpLock?: boolean;
  requireDeviceVerification?: boolean;
  sessionValidityMinutes?: number;
  auditAccess?: boolean;
}

/**
 * Props interface for ProtectedRoute component
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  requireMFA?: boolean;
  securityOptions?: SecurityOptions;
}

/**
 * Enhanced ProtectedRoute component with comprehensive security features
 * Implements role-based access control, session validation, and security monitoring
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requireMFA = false,
  securityOptions = {
    enforceIpLock: true,
    requireDeviceVerification: true,
    sessionValidityMinutes: 30,
    auditAccess: true
  }
}) => {
  // Get enhanced auth context with security features
  const { 
    state: { 
      isAuthenticated, 
      user, 
      isMfaRequired,
      securityContext 
    },
    validateSession,
    logSecurityEvent
  } = useAuth();

  /**
   * Validates user role against allowed roles with inheritance
   * @param userRole Current user's role
   * @param allowedRoles Array of allowed roles
   * @returns boolean indicating if user has sufficient role access
   */
  const hasValidRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
    // Role hierarchy for inheritance
    const roleHierarchy = {
      [UserRole.SYSTEM_ADMIN]: [
        UserRole.SYSTEM_ADMIN,
        UserRole.FACILITY_MANAGER,
        UserRole.SPACE_PLANNER,
        UserRole.BU_ADMIN
      ],
      [UserRole.FACILITY_MANAGER]: [
        UserRole.FACILITY_MANAGER,
        UserRole.SPACE_PLANNER,
        UserRole.BU_ADMIN
      ],
      [UserRole.SPACE_PLANNER]: [
        UserRole.SPACE_PLANNER,
        UserRole.BU_ADMIN
      ],
      [UserRole.BU_ADMIN]: [
        UserRole.BU_ADMIN
      ]
    };

    // Get inherited roles for user's role
    const inheritedRoles = roleHierarchy[userRole] || [userRole];

    // Check if user's inherited roles intersect with allowed roles
    return allowedRoles.some(role => inheritedRoles.includes(role));
  };

  /**
   * Validates security context and session
   */
  useEffect(() => {
    const validateSecurityContext = async () => {
      try {
        // Validate session including token freshness
        const sessionValid = await validateSession();
        
        if (!sessionValid) {
          logSecurityEvent('session_invalid', {
            userId: user?.id,
            timestamp: new Date(),
            context: securityContext
          });
          return;
        }

        // Additional security validations
        if (securityOptions.enforceIpLock && 
            !user?.allowedIpAddresses?.includes(securityContext?.ipAddress)) {
          logSecurityEvent('ip_validation_failed', {
            userId: user?.id,
            ipAddress: securityContext?.ipAddress
          });
          return;
        }

        if (securityOptions.auditAccess) {
          logSecurityEvent('route_access', {
            userId: user?.id,
            timestamp: new Date(),
            allowedRoles,
            userRole: user?.role
          });
        }

      } catch (error) {
        logSecurityEvent('security_validation_failed', {
          error: error.message,
          userId: user?.id
        });
      }
    };

    if (isAuthenticated && user) {
      validateSecurityContext();
    }
  }, [isAuthenticated, user, validateSession, securityOptions]);

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    logSecurityEvent('unauthorized_access_attempt', {
      timestamp: new Date(),
      targetRoute: window.location.pathname
    });
    return <Navigate to="/login" replace />;
  }

  // Enforce MFA if required
  if (requireMFA && isMfaRequired) {
    logSecurityEvent('mfa_required', {
      userId: user.id,
      timestamp: new Date()
    });
    return <Navigate to="/mfa-verification" replace />;
  }

  // Validate user role
  if (!hasValidRole(user.role, allowedRoles)) {
    logSecurityEvent('insufficient_permissions', {
      userId: user.id,
      userRole: user.role,
      requiredRoles: allowedRoles,
      timestamp: new Date()
    });
    return <Navigate to="/unauthorized" replace />;
  }

  // Render protected route with security context
  return (
    <React.Fragment>
      {children}
    </React.Fragment>
  );
};

export default ProtectedRoute;