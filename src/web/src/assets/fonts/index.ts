import { TYPOGRAPHY } from '../../constants/theme.constants';
import memoize from 'lodash/memoize'; // @version ^4.17.21

// Type definitions
type FontWeight = 300 | 400 | 500 | 700;
type FontDisplay = 'auto' | 'block' | 'swap' | 'fallback' | 'optional';

interface FontFamily {
  family: string;
  weights: Record<FontWeight, string>;
  display: FontDisplay;
  fallback: string[];
  subset?: string[];
}

interface FluidFontSize {
  min: number;
  max: number;
  unit: 'px' | 'rem';
  scale: number;
}

// Global constants
const FONT_FILE_FORMATS = ['woff2', 'woff'] as const;
const BASE_FONT_SIZE = 16;
const VIEWPORT_CONSTRAINTS = {
  min: 320,
  max: 1440
} as const;

/**
 * Primary font configuration for body text and general UI elements
 * Implements WCAG 2.1 Level AA compliance with proper contrast and readability
 */
export const PRIMARY_FONT: FontFamily = {
  family: 'Inter',
  weights: {
    300: 'Inter-Light',
    400: 'Inter-Regular',
    500: 'Inter-Medium',
    700: 'Inter-Bold'
  },
  display: 'swap', // Ensures text remains visible during webfont load
  fallback: [
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif'
  ],
  subset: ['latin', 'latin-ext'] // Support for extended Latin characters
};

/**
 * Secondary font configuration for headings and emphasis
 * Maintains visual hierarchy while ensuring accessibility
 */
export const SECONDARY_FONT: FontFamily = {
  family: 'Roboto',
  weights: {
    300: 'Roboto-Light',
    400: 'Roboto-Regular',
    500: 'Roboto-Medium',
    700: 'Roboto-Bold'
  },
  display: 'optional', // Optimizes loading for less critical font
  fallback: [
    'system-ui',
    'Arial',
    'sans-serif'
  ]
};

/**
 * Standardized font weights supporting multiple scripts and maintaining
 * consistent visual weight across different writing systems
 */
export const FONT_WEIGHTS = {
  light: 300 as FontWeight,
  regular: 400 as FontWeight,
  medium: 500 as FontWeight,
  bold: 700 as FontWeight
} as const;

/**
 * Fluid typography scale with viewport-based calculations
 * Ensures readability across all device sizes while maintaining proportions
 */
export const FONT_SIZES = {
  base: BASE_FONT_SIZE,
  scale: {
    h1: { min: 32, max: 40, unit: 'px', scale: 1.5 },
    h2: { min: 28, max: 36, unit: 'px', scale: 1.4 },
    h3: { min: 24, max: 32, unit: 'px', scale: 1.3 },
    h4: { min: 20, max: 28, unit: 'px', scale: 1.2 },
    h5: { min: 18, max: 24, unit: 'px', scale: 1.1 },
    h6: { min: 16, max: 20, unit: 'px', scale: 1.05 },
    body1: { min: 16, max: 16, unit: 'px', scale: 1 },
    body2: { min: 14, max: 14, unit: 'px', scale: 0.875 },
    caption: { min: 12, max: 12, unit: 'px', scale: 0.75 }
  },
  // Pre-calculated fluid sizes for common use cases
  fluid: {
    h1: calculateFluidFontSize(40, VIEWPORT_CONSTRAINTS.min, VIEWPORT_CONSTRAINTS.max, { minScale: 0.8 }),
    h2: calculateFluidFontSize(36, VIEWPORT_CONSTRAINTS.min, VIEWPORT_CONSTRAINTS.max, { minScale: 0.8 }),
    h3: calculateFluidFontSize(32, VIEWPORT_CONSTRAINTS.min, VIEWPORT_CONSTRAINTS.max, { minScale: 0.75 }),
    h4: calculateFluidFontSize(28, VIEWPORT_CONSTRAINTS.min, VIEWPORT_CONSTRAINTS.max, { minScale: 0.75 }),
    h5: calculateFluidFontSize(24, VIEWPORT_CONSTRAINTS.min, VIEWPORT_CONSTRAINTS.max, { minScale: 0.8 }),
    h6: calculateFluidFontSize(20, VIEWPORT_CONSTRAINTS.min, VIEWPORT_CONSTRAINTS.max, { minScale: 0.8 })
  }
} as const;

/**
 * Generates fluid font size calculations based on viewport width
 * Implements smooth scaling between minimum and maximum viewport sizes
 * 
 * @param baseSize - Base font size in pixels
 * @param minWidth - Minimum viewport width
 * @param maxWidth - Maximum viewport width
 * @param options - Additional configuration options
 * @returns CSS calc() expression for fluid font scaling
 */
const calculateFluidFontSize = memoize((
  baseSize: number,
  minWidth: number,
  maxWidth: number,
  options: {
    minScale?: number;
    maxScale?: number;
    unit?: 'px' | 'rem';
  } = {}
): string => {
  const {
    minScale = 0.75,
    maxScale = 1,
    unit = 'px'
  } = options;

  const minSize = Math.round(baseSize * minScale);
  const maxSize = Math.round(baseSize * maxScale);
  const slope = (maxSize - minSize) / (maxWidth - minWidth);
  const yAxisIntersection = -minWidth * slope + minSize;

  // Convert to rem if specified
  const minSizeUnit = unit === 'rem' ? `${minSize / BASE_FONT_SIZE}rem` : `${minSize}px`;
  const maxSizeUnit = unit === 'rem' ? `${maxSize / BASE_FONT_SIZE}rem` : `${maxSize}px`;

  return `clamp(${minSizeUnit}, calc(${yAxisIntersection}px + ${slope * 100}vw), ${maxSizeUnit})`;
});

export default {
  PRIMARY_FONT,
  SECONDARY_FONT,
  FONT_WEIGHTS,
  FONT_SIZES,
  calculateFluidFontSize
};