import { createTheme, ThemeOptions } from '@mui/material/styles'; // @mui/material version ^5.0.0
import { useMediaQuery } from '@mui/material'; // @mui/material version ^5.0.0
import {
  COLORS,
  TYPOGRAPHY,
  BREAKPOINTS,
  SPACING,
  SHADOWS,
  TRANSITIONS,
  Z_INDEX
} from '../constants/theme.constants';

// Type definitions
export type ThemeMode = 'light' | 'dark' | 'high-contrast';
export type CustomTheme = ReturnType<typeof createAppTheme>;

/**
 * Creates a customized Material-UI theme with comprehensive styling and accessibility features
 * @param mode - The theme mode to apply (light/dark/high-contrast)
 * @returns A fully configured Material-UI theme object
 */
const createAppTheme = (mode: ThemeMode = 'light') => {
  // Base theme options
  const themeOptions: ThemeOptions = {
    // Breakpoint configuration for responsive design
    breakpoints: {
      values: {
        xs: BREAKPOINTS.xs,
        sm: BREAKPOINTS.sm,
        md: BREAKPOINTS.md,
        lg: BREAKPOINTS.lg,
        xl: BREAKPOINTS.xl,
      },
    },

    // Palette configuration based on theme mode
    palette: {
      mode: mode === 'high-contrast' ? 'dark' : mode,
      ...(mode === 'light' && COLORS.light),
      ...(mode === 'dark' && COLORS.dark),
      ...(mode === 'high-contrast' && COLORS.highContrast),
      success: { main: COLORS.semantic.success },
      error: { main: COLORS.semantic.error },
      warning: { main: COLORS.semantic.warning },
      info: { main: COLORS.semantic.info },
    },

    // Typography configuration with responsive scaling
    typography: {
      fontFamily: TYPOGRAPHY.fontFamily,
      h1: {
        fontSize: TYPOGRAPHY.scale.h1,
        lineHeight: TYPOGRAPHY.lineHeight.heading,
        letterSpacing: TYPOGRAPHY.letterSpacing.tight,
      },
      h2: {
        fontSize: TYPOGRAPHY.scale.h2,
        lineHeight: TYPOGRAPHY.lineHeight.heading,
      },
      h3: {
        fontSize: TYPOGRAPHY.scale.h3,
        lineHeight: TYPOGRAPHY.lineHeight.heading,
      },
      h4: {
        fontSize: TYPOGRAPHY.scale.h4,
        lineHeight: TYPOGRAPHY.lineHeight.heading,
      },
      h5: {
        fontSize: TYPOGRAPHY.scale.h5,
        lineHeight: TYPOGRAPHY.lineHeight.heading,
      },
      h6: {
        fontSize: TYPOGRAPHY.scale.h6,
        lineHeight: TYPOGRAPHY.lineHeight.heading,
      },
      body1: {
        fontSize: TYPOGRAPHY.scale.body1,
        lineHeight: TYPOGRAPHY.lineHeight.body,
      },
      body2: {
        fontSize: TYPOGRAPHY.scale.body2,
        lineHeight: TYPOGRAPHY.lineHeight.body,
      },
    },

    // Spacing configuration using 8px grid system
    spacing: SPACING.unit,

    // Shadow configuration for elevation
    shadows: [
      'none',
      SHADOWS.sm,
      SHADOWS.md,
      SHADOWS.lg,
      SHADOWS.xl,
      // Fill remaining shadow array positions with repeated xl shadow
      ...Array(20).fill(SHADOWS.xl),
    ],

    // Z-index configuration
    zIndex: Z_INDEX,

    // Component-specific style overrides
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: SPACING.unit,
            padding: `${SPACING.inset.xs}px ${SPACING.inset.sm}px`,
            transition: `all ${TRANSITIONS.duration.short}ms ${TRANSITIONS.easing.easeInOut}`,
          },
          contained: {
            boxShadow: SHADOWS.sm,
            '&:hover': {
              boxShadow: SHADOWS.md,
            },
          },
        },
        defaultProps: {
          disableElevation: true,
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: SPACING.unit,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: SPACING.unit * 2,
            boxShadow: SHADOWS.sm,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: SPACING.unit * 2,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: SHADOWS.sm,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: 'none',
            boxShadow: SHADOWS.lg,
          },
        },
      },
    },
  };

  // Create the theme with custom options
  const theme = createTheme(themeOptions);

  // Add custom theme extensions
  return {
    ...theme,
    custom: {
      mode,
      transitions: TRANSITIONS,
      surface: COLORS.surface,
      interactive: COLORS.interactive,
    },
  };
};

export default createAppTheme;

// Utility hook for responsive design
export const useResponsive = () => {
  const isMobile = useMediaQuery((theme: CustomTheme) => 
    theme.breakpoints.down('sm')
  );
  const isTablet = useMediaQuery((theme: CustomTheme) => 
    theme.breakpoints.between('sm', 'md')
  );
  const isDesktop = useMediaQuery((theme: CustomTheme) => 
    theme.breakpoints.up('md')
  );

  return { isMobile, isTablet, isDesktop };
};