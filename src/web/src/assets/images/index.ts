/**
 * @fileoverview Central index file for managing and exporting all image assets used throughout the IWMS web application.
 * Provides strongly-typed image metadata and organized asset groupings for logos, icons, floor plans, and UI elements.
 * @version 1.0.0
 */

/**
 * Comprehensive interface for image asset metadata with accessibility and performance considerations
 */
export interface ImageMetadata {
  /** Image source path relative to assets directory */
  src: string;
  /** Mandatory alternative text for accessibility compliance */
  alt: string;
  /** Original image width in pixels */
  width: number;
  /** Original image height in pixels */
  height: number;
  /** Image loading strategy hint */
  loading: 'lazy' | 'eager';
  /** Image format for proper rendering */
  format: 'png' | 'svg' | 'webp';
  /** Base64 encoded thumbnail for progressive loading */
  placeholder: string;
}

/**
 * Application logo for header and branding with high-resolution support
 */
export const logo: ImageMetadata = {
  src: '/assets/images/logo/iwms-logo.svg',
  alt: 'Lightweight IWMS Platform Logo',
  width: 240,
  height: 60,
  loading: 'eager',
  format: 'svg',
  placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQwIiBoZWlnaHQ9IjYwIi8+'
};

/**
 * Default placeholder for floor plan loading states with progressive enhancement
 */
export const floorPlanPlaceholder: ImageMetadata = {
  src: '/assets/images/floor-plans/placeholder.webp',
  alt: 'Floor plan loading placeholder',
  width: 800,
  height: 600,
  loading: 'lazy',
  format: 'webp',
  placeholder: 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAIAAAAA'
};

/**
 * Comprehensive icon set for different resource types in floor plans with consistent styling
 */
export const resourceIcons: Record<string, ImageMetadata> = {
  desk: {
    src: '/assets/images/icons/resources/desk.svg',
    alt: 'Desk workspace icon',
    width: 24,
    height: 24,
    loading: 'eager',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiLz4='
  },
  meetingRoom: {
    src: '/assets/images/icons/resources/meeting-room.svg',
    alt: 'Meeting room icon',
    width: 24,
    height: 24,
    loading: 'eager',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiLz4='
  },
  office: {
    src: '/assets/images/icons/resources/office.svg',
    alt: 'Private office icon',
    width: 24,
    height: 24,
    loading: 'eager',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiLz4='
  },
  phoneRoom: {
    src: '/assets/images/icons/resources/phone-room.svg',
    alt: 'Phone room icon',
    width: 24,
    height: 24,
    loading: 'eager',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiLz4='
  },
  collaboration: {
    src: '/assets/images/icons/resources/collaboration.svg',
    alt: 'Collaboration space icon',
    width: 24,
    height: 24,
    loading: 'eager',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiLz4='
  }
};

/**
 * Status indicators for real-time occupancy visualization with accessibility support
 */
export const occupancyIcons: Record<string, ImageMetadata> = {
  occupied: {
    src: '/assets/images/icons/occupancy/occupied.svg',
    alt: 'Space occupied indicator',
    width: 16,
    height: 16,
    loading: 'eager',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiLz4='
  },
  available: {
    src: '/assets/images/icons/occupancy/available.svg',
    alt: 'Space available indicator',
    width: 16,
    height: 16,
    loading: 'eager',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiLz4='
  },
  reserved: {
    src: '/assets/images/icons/occupancy/reserved.svg',
    alt: 'Space reserved indicator',
    width: 16,
    height: 16,
    loading: 'eager',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiLz4='
  },
  maintenance: {
    src: '/assets/images/icons/occupancy/maintenance.svg',
    alt: 'Space under maintenance indicator',
    width: 16,
    height: 16,
    loading: 'eager',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiLz4='
  }
};

/**
 * Common UI state and feedback images with consistent visual language
 */
export const uiAssets: Record<string, ImageMetadata> = {
  emptyState: {
    src: '/assets/images/ui/empty-state.svg',
    alt: 'No content available illustration',
    width: 240,
    height: 180,
    loading: 'lazy',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQwIiBoZWlnaHQ9IjE4MCIvPg=='
  },
  loadingSpinner: {
    src: '/assets/images/ui/loading-spinner.svg',
    alt: 'Content loading indicator',
    width: 48,
    height: 48,
    loading: 'eager',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiLz4='
  },
  errorState: {
    src: '/assets/images/ui/error-state.svg',
    alt: 'Error occurred illustration',
    width: 240,
    height: 180,
    loading: 'lazy',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQwIiBoZWlnaHQ9IjE4MCIvPg=='
  },
  successState: {
    src: '/assets/images/ui/success-state.svg',
    alt: 'Operation completed successfully illustration',
    width: 240,
    height: 180,
    loading: 'lazy',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQwIiBoZWlnaHQ9IjE4MCIvPg=='
  },
  noResults: {
    src: '/assets/images/ui/no-results.svg',
    alt: 'No search results found illustration',
    width: 240,
    height: 180,
    loading: 'lazy',
    format: 'svg',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQwIiBoZWlnaHQ9IjE4MCIvPg=='
  }
};