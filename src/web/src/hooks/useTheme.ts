import { useCallback } from 'react'; // react ^18.0.0
import { useTheme as useMuiTheme, Theme } from '@mui/material/styles'; // @mui/material ^5.0.0
import { useThemeContext, ThemeMode } from '../contexts/ThemeContext';

/**
 * Interface defining the return type of the useTheme hook
 */
interface ThemeHookReturn {
  /** Current Material-UI theme object */
  theme: Theme;
  /** Current theme mode (light/dark/high-contrast) */
  themeMode: ThemeMode;
  /** Flag indicating if high contrast mode is active */
  isHighContrastMode: boolean;
  /** Function to toggle between light and dark themes */
  toggleTheme: () => void;
  /** Function to toggle high contrast mode */
  toggleHighContrastMode: () => void;
  /** Function to explicitly set theme mode */
  setThemeMode: (mode: ThemeMode) => void;
}

/**
 * Custom hook providing comprehensive theme management functionality with accessibility features
 * 
 * Features:
 * - Light/Dark mode toggling
 * - High contrast mode for accessibility
 * - Material-UI theme integration
 * - Theme persistence
 * - WCAG 2.1 Level AA compliance
 * 
 * @returns {ThemeHookReturn} Object containing theme state and management functions
 * 
 * @example
 * ```tsx
 * const { theme, toggleTheme, isHighContrastMode, toggleHighContrastMode } = useTheme();
 * 
 * return (
 *   <Button 
 *     onClick={toggleTheme}
 *     sx={{ backgroundColor: theme.palette.primary.main }}
 *   >
 *     Toggle Theme
 *   </Button>
 * );
 * ```
 */
const useTheme = (): ThemeHookReturn => {
  // Get theme context and Material-UI theme
  const {
    currentTheme,
    themeMode,
    isHighContrastMode,
    setThemeMode: setContextThemeMode,
    toggleTheme: toggleContextTheme,
    toggleHighContrastMode: toggleContextHighContrast
  } = useThemeContext();

  // Get Material-UI theme object
  const theme = useMuiTheme();

  // Memoized theme toggle function
  const toggleTheme = useCallback(() => {
    toggleContextTheme();
  }, [toggleContextTheme]);

  // Memoized high contrast mode toggle
  const toggleHighContrastMode = useCallback(() => {
    toggleContextHighContrast();
  }, [toggleContextHighContrast]);

  // Memoized theme mode setter
  const setThemeMode = useCallback((mode: ThemeMode) => {
    if (!['light', 'dark'].includes(mode)) {
      console.error(`Invalid theme mode: ${mode}. Must be 'light' or 'dark'`);
      return;
    }
    setContextThemeMode(mode);
  }, [setContextThemeMode]);

  // Validate theme mode and high contrast settings
  if (!['light', 'dark'].includes(themeMode)) {
    console.warn(`Invalid theme mode detected: ${themeMode}. Defaulting to 'light'`);
    setThemeMode('light');
  }

  return {
    theme,
    themeMode,
    isHighContrastMode,
    toggleTheme,
    toggleHighContrastMode,
    setThemeMode
  };
};

export default useTheme;