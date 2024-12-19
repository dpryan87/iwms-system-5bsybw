/// <reference types="vite/client" />

/**
 * Type definitions for Vite environment variables used in the IWMS application
 * @version 4.4.0
 */

/**
 * Environment variable interface for the IWMS application
 * Provides type safety for all configuration values used across the application
 */
interface ImportMetaEnv {
  /** Base URL for API endpoints */
  readonly VITE_API_URL: string;

  /** WebSocket server URL for real-time updates */
  readonly VITE_WS_URL: string;

  /** Application title used in browser and UI */
  readonly VITE_APP_TITLE: string;

  /** Auth0 authentication domain */
  readonly VITE_AUTH0_DOMAIN: string;

  /** Auth0 client identifier */
  readonly VITE_AUTH0_CLIENT_ID: string;

  /** Auth0 API audience identifier */
  readonly VITE_AUTH0_AUDIENCE: string;

  /** API version for endpoint versioning */
  readonly VITE_API_VERSION: string;

  /** Current deployment environment */
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production';

  /** Flag to enable/disable analytics tracking */
  readonly VITE_ENABLE_ANALYTICS: string;

  /** Application logging level */
  readonly VITE_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Augments the ImportMeta interface to include environment variables
 * This enables TypeScript to recognize env variables on the import.meta object
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Ensures environment variables are treated as readonly
 * Prevents accidental modification of environment configuration at runtime
 */
declare module '*.svg' {
  import * as React from 'react';
  const SVGComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export default SVGComponent;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.json' {
  const content: any;
  export default content;
}