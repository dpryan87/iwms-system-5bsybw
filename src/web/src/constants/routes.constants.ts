/**
 * @fileoverview Route constants and configurations for the IWMS application
 * Provides centralized, type-safe route definitions and navigation configurations
 * @version 1.0.0
 */

/**
 * Interface for route configuration with metadata
 */
interface RouteConfig {
  path: string;
  title: string;
  icon?: string;
  exact?: boolean;
  isProtected?: boolean;
  children?: Record<string, RouteConfig>;
}

/**
 * Type for route parameters in dynamic routes
 */
type RouteParams = Record<string, string>;

/**
 * Helper function to generate type-safe route paths with parameters
 * @param route - Route pattern with parameter placeholders
 * @param params - Object containing parameter values
 * @returns Generated route path with replaced parameters
 */
export const generatePath = (route: string, params: RouteParams = {}): string => {
  let path = route;
  const paramMatches = route.match(/:[a-zA-Z]+/g) || [];
  
  paramMatches.forEach(param => {
    const paramName = param.slice(1); // Remove : prefix
    if (!params[paramName]) {
      throw new Error(`Missing required parameter: ${paramName}`);
    }
    path = path.replace(param, encodeURIComponent(params[paramName]));
  });

  return path;
};

/**
 * Authentication related routes
 */
export const AUTH: RouteConfig = {
  path: '/auth',
  title: 'Authentication',
  isProtected: false,
  children: {
    LOGIN: { path: '/auth/login', title: 'Login' },
    LOGOUT: { path: '/auth/logout', title: 'Logout' },
    FORGOT_PASSWORD: { path: '/auth/forgot-password', title: 'Forgot Password' },
    RESET_PASSWORD: { path: '/auth/reset-password/:token', title: 'Reset Password' },
    CALLBACK: { path: '/auth/callback', title: 'Auth Callback' },
    MFA: { path: '/auth/mfa', title: 'Multi-Factor Authentication' }
  }
};

/**
 * Dashboard related routes
 */
export const DASHBOARD: RouteConfig = {
  path: '/',
  title: 'Dashboard',
  icon: 'dashboard',
  exact: true,
  isProtected: true,
  children: {
    OVERVIEW: { path: '/dashboard', title: 'Overview' },
    ANALYTICS: { path: '/dashboard/analytics', title: 'Analytics' },
    REPORTS: { path: '/dashboard/reports', title: 'Reports' },
    NOTIFICATIONS: { path: '/dashboard/notifications', title: 'Notifications' }
  }
};

/**
 * Floor plan management routes
 */
export const FLOOR_PLANS: RouteConfig = {
  path: '/floor-plans',
  title: 'Floor Plans',
  icon: 'floorplan',
  isProtected: true,
  children: {
    LIST: { path: '/floor-plans/list', title: 'All Floor Plans' },
    VIEW: { path: '/floor-plans/view/:id', title: 'View Floor Plan' },
    EDIT: { path: '/floor-plans/edit/:id', title: 'Edit Floor Plan' },
    CREATE: { path: '/floor-plans/create', title: 'Create Floor Plan' },
    UPLOAD: { path: '/floor-plans/upload', title: 'Upload Floor Plan' },
    SPACES: { path: '/floor-plans/:id/spaces', title: 'Manage Spaces' },
    RESOURCES: { path: '/floor-plans/:id/resources', title: 'Manage Resources' },
    HISTORY: { path: '/floor-plans/:id/history', title: 'Floor Plan History' }
  }
};

/**
 * Lease management routes
 */
export const LEASES: RouteConfig = {
  path: '/leases',
  title: 'Leases',
  icon: 'document',
  isProtected: true,
  children: {
    LIST: { path: '/leases/list', title: 'All Leases' },
    VIEW: { path: '/leases/view/:id', title: 'View Lease' },
    EDIT: { path: '/leases/edit/:id', title: 'Edit Lease' },
    CREATE: { path: '/leases/create', title: 'Create Lease' },
    CALENDAR: { path: '/leases/calendar', title: 'Lease Calendar' },
    RENEWALS: { path: '/leases/renewals', title: 'Lease Renewals' },
    DOCUMENTS: { path: '/leases/:id/documents', title: 'Lease Documents' },
    PAYMENTS: { path: '/leases/:id/payments', title: 'Lease Payments' },
    HISTORY: { path: '/leases/:id/history', title: 'Lease History' }
  }
};

/**
 * Occupancy monitoring routes
 */
export const OCCUPANCY: RouteConfig = {
  path: '/occupancy',
  title: 'Occupancy',
  icon: 'people',
  isProtected: true,
  children: {
    DASHBOARD: { path: '/occupancy/dashboard', title: 'Occupancy Dashboard' },
    ANALYTICS: { path: '/occupancy/analytics', title: 'Occupancy Analytics' },
    HEATMAP: { path: '/occupancy/heatmap', title: 'Occupancy Heatmap' },
    TRENDS: { path: '/occupancy/trends', title: 'Occupancy Trends' },
    REPORTS: { path: '/occupancy/reports', title: 'Occupancy Reports' },
    REAL_TIME: { path: '/occupancy/real-time', title: 'Real-Time Occupancy' },
    HISTORICAL: { path: '/occupancy/historical', title: 'Historical Occupancy' },
    FORECASTS: { path: '/occupancy/forecasts', title: 'Occupancy Forecasts' }
  }
};

/**
 * Resource management routes
 */
export const RESOURCES: RouteConfig = {
  path: '/resources',
  title: 'Resources',
  icon: 'inventory',
  isProtected: true,
  children: {
    LIST: { path: '/resources/list', title: 'All Resources' },
    VIEW: { path: '/resources/view/:id', title: 'View Resource' },
    EDIT: { path: '/resources/edit/:id', title: 'Edit Resource' },
    CREATE: { path: '/resources/create', title: 'Create Resource' },
    ALLOCATION: { path: '/resources/allocation', title: 'Resource Allocation' },
    CALENDAR: { path: '/resources/calendar', title: 'Resource Calendar' },
    MAINTENANCE: { path: '/resources/:id/maintenance', title: 'Resource Maintenance' },
    BOOKINGS: { path: '/resources/:id/bookings', title: 'Resource Bookings' }
  }
};

/**
 * System settings routes
 */
export const SETTINGS: RouteConfig = {
  path: '/settings',
  title: 'Settings',
  icon: 'settings',
  isProtected: true,
  children: {
    PROFILE: { path: '/settings/profile', title: 'User Profile' },
    PREFERENCES: { path: '/settings/preferences', title: 'Preferences' },
    NOTIFICATIONS: { path: '/settings/notifications', title: 'Notification Settings' },
    SECURITY: { path: '/settings/security', title: 'Security Settings' },
    INTEGRATIONS: { path: '/settings/integrations', title: 'Integrations' },
    TEAMS: { path: '/settings/teams', title: 'Team Management' },
    AUDIT_LOGS: { path: '/settings/audit-logs', title: 'Audit Logs' },
    API_KEYS: { path: '/settings/api-keys', title: 'API Keys' }
  }
};

/**
 * Combined routes object for export
 */
export const ROUTES = {
  AUTH,
  DASHBOARD,
  FLOOR_PLANS,
  LEASES,
  OCCUPANCY,
  RESOURCES,
  SETTINGS
} as const;