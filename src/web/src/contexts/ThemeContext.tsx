import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'; // react ^18.0.0
import { ThemeProvider as MuiThemeProvider, useMediaQuery } from '@mui/material/styles'; // @mui/material ^5.0.0
import createAppTheme, { ThemeMode, CustomTheme } from '../styles/theme';
import { COLORS, TRANSITIONS, SPACING } from '../constants/theme.constants';

// Constants
const STORAGE_KEYS = {
  THEME_MODE: 'iwms-theme-mode',
  HIGH_CONTRAST: 'iwms-high-contrast',
  SYSTEM_PREFERENCE: 'iwms-system-preference'
} as const;

const INITIAL_THEME = 'light' as ThemeMode;
const TRANSITION_DURATION = TRANSITIONS.duration.standard;

// Interface definitions
interface ThemeContextType {
  currentTheme: CustomTheme;
  themeMode: ThemeMode;
  isHighContrastMode: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  toggleHighContrastMode: () => void;
  isSystemPreference: boolean;
  setSystemPreference: (useSystem: boolean) => void;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

// Create context with meaningful default values
const ThemeContext = createContext<ThemeContextType | null>(null);

// Utility function to get initial theme settings
const getInitialTheme = () => {
  try {
    const storedMode = localStorage.getItem(STORAGE_KEYS.THEME_MODE) as ThemeMode | null;
    const storedHighContrast = localStorage.getItem(STORAGE_KEYS.HIGH_CONTRAST) === 'true';
    const storedSystemPreference = localStorage.getItem(STORAGE_KEYS.SYSTEM_PREFERENCE) === 'true';

    return {
      mode: storedMode || INITIAL_THEME,
      highContrast: storedHighContrast,
      systemPreference: storedSystemPreference
    };
  } catch (error) {
    console.warn('Failed to read theme preferences from localStorage:', error);
    return {
      mode: INITIAL_THEME,
      highContrast: false,
      systemPreference: true
    };
  }
};

// Custom hook for accessing theme context
export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

// Theme Provider Component
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Get system color scheme preference
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  
  // Initialize state from stored preferences
  const initialTheme = getInitialTheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(initialTheme.mode);
  const [isHighContrastMode, setIsHighContrastMode] = useState(initialTheme.highContrast);
  const [isSystemPreference, setIsSystemPreference] = useState(initialTheme.systemPreference);

  // Create theme based on current settings
  const currentTheme = useMemo(() => {
    const mode = isHighContrastMode ? 'high-contrast' : themeMode;
    return createAppTheme(mode);
  }, [themeMode, isHighContrastMode]);

  // Update theme based on system preference
  useEffect(() => {
    if (isSystemPreference) {
      setThemeModeState(prefersDarkMode ? 'dark' : 'light');
    }
  }, [prefersDarkMode, isSystemPreference]);

  // Theme mode setter with validation
  const setThemeMode = useCallback((mode: ThemeMode) => {
    if (!['light', 'dark'].includes(mode)) {
      console.error(`Invalid theme mode: ${mode}`);
      return;
    }
    setThemeModeState(mode);
    localStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);
  }, []);

  // Toggle between light and dark themes
  const toggleTheme = useCallback(() => {
    if (isSystemPreference) {
      setIsSystemPreference(false);
      localStorage.setItem(STORAGE_KEYS.SYSTEM_PREFERENCE, 'false');
    }
    setThemeMode(themeMode === 'light' ? 'dark' : 'light');
  }, [themeMode, isSystemPreference, setThemeMode]);

  // Toggle high contrast mode
  const toggleHighContrastMode = useCallback(() => {
    setIsHighContrastMode(prev => {
      const newValue = !prev;
      localStorage.setItem(STORAGE_KEYS.HIGH_CONTRAST, String(newValue));
      return newValue;
    });
  }, []);

  // System preference setter
  const setSystemPreference = useCallback((useSystem: boolean) => {
    setIsSystemPreference(useSystem);
    localStorage.setItem(STORAGE_KEYS.SYSTEM_PREFERENCE, String(useSystem));
    if (useSystem) {
      setThemeModeState(prefersDarkMode ? 'dark' : 'light');
    }
  }, [prefersDarkMode]);

  // Context value
  const contextValue = useMemo(() => ({
    currentTheme,
    themeMode,
    isHighContrastMode,
    setThemeMode,
    toggleTheme,
    toggleHighContrastMode,
    isSystemPreference,
    setSystemPreference
  }), [
    currentTheme,
    themeMode,
    isHighContrastMode,
    setThemeMode,
    toggleTheme,
    toggleHighContrastMode,
    isSystemPreference,
    setSystemPreference
  ]);

  // Apply smooth transitions for theme changes
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--theme-transition',
      `${TRANSITION_DURATION}ms`
    );
    document.documentElement.style.setProperty(
      '--theme-transition-timing',
      TRANSITIONS.easing.easeInOut
    );
  }, []);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={currentTheme}>
        <div
          style={{
            minHeight: '100vh',
            transition: `background-color ${TRANSITION_DURATION}ms ${TRANSITIONS.easing.easeInOut}`,
            backgroundColor: currentTheme.palette.background.default
          }}
        >
          {children}
        </div>
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;