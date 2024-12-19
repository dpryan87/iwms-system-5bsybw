import { createPalette, alpha } from '@mui/material/styles'; // @mui/material version ^5.0.0

// Type definitions
type ThemeMode = 'light' | 'dark' | 'high-contrast' | 'color-blind';

interface ContrastRatios {
  AA: number;
  AAA: number;
}

// Contrast ratios per WCAG 2.1 guidelines
const COLOR_CONTRAST_RATIO: ContrastRatios = {
  AA: 4.5,  // Minimum contrast for normal text
  AAA: 7.0  // Enhanced contrast for better accessibility
};

// Breakpoints following responsive design requirements
export const BREAKPOINTS = {
  xs: 320,  // Mobile breakpoint
  sm: 768,  // Tablet breakpoint
  md: 1024, // Desktop breakpoint
  lg: 1440, // Large desktop breakpoint
  xl: 1920  // Extra large screens
} as const;

// Comprehensive color system
export const COLORS = {
  light: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2',
      contrastText: '#ffffff'
    },
    background: {
      default: '#ffffff',
      paper: '#f5f5f5'
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
      disabled: 'rgba(0, 0, 0, 0.38)'
    }
  },
  dark: {
    primary: {
      main: '#90caf9',
      light: '#e3f2fd',
      dark: '#42a5f5',
      contrastText: '#000000'
    },
    secondary: {
      main: '#ce93d8',
      light: '#f3e5f5',
      dark: '#ab47bc',
      contrastText: '#000000'
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e'
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
      disabled: 'rgba(255, 255, 255, 0.5)'
    }
  },
  highContrast: {
    primary: {
      main: '#ffffff',
      light: '#ffffff',
      dark: '#ffffff',
      contrastText: '#000000'
    },
    secondary: {
      main: '#ffffff',
      light: '#ffffff',
      dark: '#ffffff',
      contrastText: '#000000'
    },
    background: {
      default: '#000000',
      paper: '#000000'
    },
    text: {
      primary: '#ffffff',
      secondary: '#ffffff',
      disabled: '#ffffff'
    }
  },
  semantic: {
    success: '#2e7d32',
    error: '#d32f2f',
    warning: '#ed6c02',
    info: '#0288d1'
  },
  surface: {
    elevation1: alpha('#000000', 0.05),
    elevation2: alpha('#000000', 0.08),
    elevation3: alpha('#000000', 0.11),
    elevation4: alpha('#000000', 0.12)
  },
  interactive: {
    hover: alpha('#000000', 0.04),
    selected: alpha('#000000', 0.08),
    disabled: alpha('#000000', 0.26),
    focus: alpha('#000000', 0.12)
  },
  colorBlind: {
    primary: '#0077bb',    // Blue - distinguishable for protanopia/deuteranopia
    secondary: '#ee7733',  // Orange - distinguishable for tritanopia
    success: '#009988',    // Teal
    error: '#cc3311',      // Red
    warning: '#ee3377',    // Magenta
    info: '#33bbee'        // Cyan
  }
} as const;

// Typography system with responsive scaling
export const TYPOGRAPHY = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  scale: {
    h1: '2.5rem',     // 40px
    h2: '2rem',       // 32px
    h3: '1.75rem',    // 28px
    h4: '1.5rem',     // 24px
    h5: '1.25rem',    // 20px
    h6: '1.125rem',   // 18px
    body1: '1rem',    // 16px
    body2: '0.875rem' // 14px
  },
  lineHeight: {
    heading: 1.2,
    body: 1.5,
    relaxed: 1.75
  },
  letterSpacing: {
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em'
  },
  textTransform: {
    uppercase: 'uppercase',
    lowercase: 'lowercase',
    capitalize: 'capitalize'
  },
  responsiveScale: (baseFontSize: number, minScale: number, maxScale: number): string => {
    const minFontSize = baseFontSize * minScale;
    const maxFontSize = baseFontSize * maxScale;
    const preferredSize = `${baseFontSize}vw`;
    
    return `clamp(${minFontSize}px, ${preferredSize}, ${maxFontSize}px)`;
  }
} as const;

// Helper function for responsive typography
export const getResponsiveFontSize = (
  baseFontSize: number,
  minScale: number,
  maxScale: number
): string => {
  const minSize = Math.round(baseFontSize * minScale);
  const maxSize = Math.round(baseFontSize * maxScale);
  const preferredSize = `${(baseFontSize / BREAKPOINTS.md) * 100}vw`;
  
  return `clamp(${minSize}px, ${preferredSize}, ${maxSize}px)`;
};

// 8px grid system for consistent spacing
export const SPACING = {
  unit: 8,
  grid: (multiplier: number): number => multiplier * 8,
  inset: {
    xs: 8,    // 8px
    sm: 16,   // 16px
    md: 24,   // 24px
    lg: 32,   // 32px
    xl: 40    // 40px
  }
} as const;

// Z-index system for layering
export const Z_INDEX = {
  drawer: 1200,
  modal: 1300,
  snackbar: 1400,
  tooltip: 1500,
  popover: 1600
} as const;

// Transition configurations
export const TRANSITIONS = {
  duration: {
    shortest: 150,
    shorter: 200,
    short: 250,
    standard: 300,
    complex: 375,
    enteringScreen: 225,
    leavingScreen: 195
  },
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)'
  }
} as const;

// Shadow definitions for elevation
export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
} as const;