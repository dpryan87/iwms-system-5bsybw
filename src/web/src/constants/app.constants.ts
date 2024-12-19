/**
 * @fileoverview Core application constants and configurations
 * @version 1.0.0
 * @license MIT
 */

// Type definitions
export interface BrowserConfig {
  minVersion: string;
  supports3D: boolean;
  limitations: string[];
}

export interface FileTypeConfig {
  maxSize: number;
  minResolution: string;
  validationRules: string[];
}

export interface FeatureConfig {
  enabled: boolean;
  expiresAt: Date;
  description: string;
}

export interface DateTimeFormat {
  dateFormat: string;
  timeFormat: string;
  timezone: string;
}

// Type aliases for better type safety
export type FileType = 'FLOOR_PLAN' | 'DOCUMENT' | 'IMAGE' | 'DATA_EXPORT';
export type Locale = 'en-US' | 'en-GB' | 'fr-FR' | 'de-DE' | 'es-ES';

/**
 * Core application configuration settings
 */
export const APP_CONFIG = {
  APP_NAME: 'Lightweight IWMS',
  APP_VERSION: '1.0.0',
  APP_ENVIRONMENT: process.env.NODE_ENV || 'development',
  SYSTEM_AVAILABILITY: 0.999, // 99.9% availability target
  API_TIMEOUT: 30000, // 30 seconds
  MAX_RETRY_ATTEMPTS: 3,
  CACHE_DURATION: 3600, // 1 hour in seconds
  ERROR_REPORTING_THRESHOLD: 0.01, // 1% error threshold
} as const;

/**
 * Browser compatibility configuration based on requirements
 */
export const SUPPORTED_BROWSERS = {
  CHROME: {
    minVersion: '90',
    supports3D: true,
    limitations: [],
  } as BrowserConfig,
  FIREFOX: {
    minVersion: '88',
    supports3D: true,
    limitations: [],
  } as BrowserConfig,
  SAFARI: {
    minVersion: '14',
    supports3D: false,
    limitations: ['Limited 3D rendering'],
  } as BrowserConfig,
  EDGE: {
    minVersion: '91',
    supports3D: true,
    limitations: [],
  } as BrowserConfig,
  MOBILE_SUPPORT: {
    CHROME: {
      minVersion: '90',
      supports3D: true,
      limitations: ['Touch optimization required'],
    } as BrowserConfig,
    SAFARI_IOS: {
      minVersion: '14',
      supports3D: false,
      limitations: ['iOS gesture handling', 'Limited 3D support'],
    } as BrowserConfig,
  },
} as const;

/**
 * File upload configurations and constraints
 */
export const FILE_UPLOAD_CONFIG = {
  MAX_FILE_SIZES: {
    FLOOR_PLAN: 52428800, // 50MB in bytes
    DOCUMENT: 15728640, // 15MB in bytes
    IMAGE: 10485760, // 10MB in bytes
    DATA_EXPORT: 52428800, // 50MB in bytes
  },
  ALLOWED_TYPES: {
    FLOOR_PLAN: ['.dwg', '.dxf', '.pdf'],
    DOCUMENT: ['.pdf', '.docx'],
    IMAGE: ['.png', '.jpg', '.jpeg'],
    DATA_EXPORT: ['.csv', '.xlsx'],
  },
  FILE_TYPE_CONFIGS: {
    FLOOR_PLAN: {
      maxSize: 52428800,
      minResolution: 'N/A',
      validationRules: ['AutoCAD 2018+ compatible', 'PDF/A-1b compliant'],
    } as FileTypeConfig,
    DOCUMENT: {
      maxSize: 15728640,
      minResolution: 'N/A',
      validationRules: ['Searchable text required', 'PDF/A compliant'],
    } as FileTypeConfig,
    IMAGE: {
      maxSize: 10485760,
      minResolution: '300dpi',
      validationRules: ['RGB color space', 'Maximum dimensions: 8000x8000px'],
    } as FileTypeConfig,
    DATA_EXPORT: {
      maxSize: 52428800,
      minResolution: 'N/A',
      validationRules: ['UTF-8 encoding required', 'Valid CSV/XLSX structure'],
    } as FileTypeConfig,
  },
} as const;

/**
 * Feature flag configurations
 */
export const FEATURE_FLAGS = {
  ENABLE_3D_VIEWER: {
    enabled: true,
    expiresAt: new Date('2024-12-31'),
    description: 'Interactive 3D floor plan visualization capability',
  } as FeatureConfig,
  ENABLE_REAL_TIME_UPDATES: {
    enabled: true,
    expiresAt: new Date('2024-12-31'),
    description: 'Real-time occupancy and resource status updates',
  } as FeatureConfig,
  ENABLE_OFFLINE_MODE: {
    enabled: false,
    expiresAt: new Date('2024-06-30'),
    description: 'Offline data access and synchronization capabilities',
  } as FeatureConfig,
} as const;

/**
 * Date and time formatting configurations
 */
export const DATE_TIME_FORMATS = {
  FORMATS: {
    'en-US': {
      dateFormat: 'MM/dd/yyyy',
      timeFormat: 'hh:mm a',
      timezone: 'America/New_York',
    },
    'en-GB': {
      dateFormat: 'dd/MM/yyyy',
      timeFormat: 'HH:mm',
      timezone: 'Europe/London',
    },
    'fr-FR': {
      dateFormat: 'dd/MM/yyyy',
      timeFormat: 'HH:mm',
      timezone: 'Europe/Paris',
    },
    'de-DE': {
      dateFormat: 'dd.MM.yyyy',
      timeFormat: 'HH:mm',
      timezone: 'Europe/Berlin',
    },
    'es-ES': {
      dateFormat: 'dd/MM/yyyy',
      timeFormat: 'HH:mm',
      timezone: 'Europe/Madrid',
    },
  } as Record<Locale, DateTimeFormat>,
  DEFAULT_TIMEZONE: 'UTC',
  SUPPORTED_LOCALES: ['en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES'] as Locale[],
} as const;

/**
 * Design system configuration constants
 */
export const DESIGN_SYSTEM = {
  SPACING: {
    UNIT: 8, // Base spacing unit in pixels
    GRID: {
      COLUMNS: 12,
      GUTTER: 16,
      MARGIN: 24,
    },
  },
  TYPOGRAPHY: {
    BASE_SIZE: 16,
    SCALE_RATIO: 1.25,
    FONT_FAMILY: {
      PRIMARY: '"Roboto", "Helvetica", "Arial", sans-serif',
      MONOSPACE: '"Roboto Mono", monospace',
    },
  },
  BREAKPOINTS: {
    MOBILE: 320,
    TABLET: 768,
    DESKTOP: 1024,
    LARGE: 1440,
  },
} as const;

// Ensure all exports are read-only at runtime
Object.freeze(APP_CONFIG);
Object.freeze(SUPPORTED_BROWSERS);
Object.freeze(FILE_UPLOAD_CONFIG);
Object.freeze(FEATURE_FLAGS);
Object.freeze(DATE_TIME_FORMATS);
Object.freeze(DESIGN_SYSTEM);