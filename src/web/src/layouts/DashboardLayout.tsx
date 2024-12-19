import React, { useCallback, useEffect } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material'; // @version ^5.0.0
import { jssRTL } from 'stylis-plugin-rtl'; // @version ^2.1.0

// Internal imports
import Layout from '../components/common/Layout';
import { useAuth } from '../hooks/useAuth';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Constants for layout configuration
const DASHBOARD_PADDING = 24;
const DASHBOARD_BREAKPOINTS = {
  xs: 320,
  sm: 768,
  md: 1024,
  lg: 1440
};

const ACCESSIBILITY_ROLES = {
  main: 'main',
  navigation: 'navigation',
  complementary: 'complementary'
};

/**
 * Props interface for the DashboardLayout component with enhanced accessibility and RTL support
 */
interface IDashboardLayoutProps {
  /** Child components to be rendered within the layout */
  children: React.ReactNode;
  /** Page title */
  title: string;
  /** Optional subtitle for additional context */
  subtitle?: string;
  /** Optional action buttons or controls */
  actions?: React.ReactNode;
  /** RTL layout support */
  rtl?: boolean;
  /** Language code for accessibility */
  lang?: string;
  /** Error boundary configuration */
  errorConfig?: {
    fallback?: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  };
  /** Accessibility configuration */
  a11yConfig?: {
    announcePageChange?: boolean;
    skipLinks?: boolean;
    keyboardNav?: boolean;
  };
}

/**
 * Enhanced dashboard layout component that provides the main structure for the IWMS dashboard
 * with comprehensive accessibility, RTL support, and error handling capabilities.
 */
const DashboardLayout: React.FC<IDashboardLayoutProps> = React.memo(({
  children,
  title,
  subtitle,
  actions,
  rtl = false,
  lang = 'en',
  errorConfig,
  a11yConfig = {
    announcePageChange: true,
    skipLinks: true,
    keyboardNav: true
  }
}) => {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  
  // Authentication state
  const { state: authState } = useAuth();

  // Handle keyboard navigation
  const handleKeyboardNav = useCallback((event: KeyboardEvent) => {
    if (!a11yConfig.keyboardNav) return;

    if (event.key === 'Tab') {
      // Add visible focus indicators
      document.body.classList.add('keyboard-nav');
    }
  }, [a11yConfig.keyboardNav]);

  // Set up keyboard navigation listeners
  useEffect(() => {
    if (a11yConfig.keyboardNav) {
      window.addEventListener('keydown', handleKeyboardNav);
      return () => {
        window.removeEventListener('keydown', handleKeyboardNav);
      };
    }
  }, [handleKeyboardNav, a11yConfig.keyboardNav]);

  // Announce page changes for screen readers
  useEffect(() => {
    if (a11yConfig.announcePageChange) {
      const announcement = `${title}${subtitle ? `, ${subtitle}` : ''} page loaded`;
      const ariaLive = document.createElement('div');
      ariaLive.setAttribute('aria-live', 'polite');
      ariaLive.setAttribute('aria-atomic', 'true');
      ariaLive.classList.add('sr-only');
      ariaLive.textContent = announcement;
      document.body.appendChild(ariaLive);

      return () => {
        document.body.removeChild(ariaLive);
      };
    }
  }, [title, subtitle, a11yConfig.announcePageChange]);

  // Skip link for keyboard navigation
  const skipLink = a11yConfig.skipLinks && (
    <a
      href="#main-content"
      className="skip-link"
      style={{
        position: 'absolute',
        top: -50,
        left: rtl ? 'auto' : 0,
        right: rtl ? 0 : 'auto',
        zIndex: theme.zIndex.modal,
        padding: theme.spacing(1, 2),
        backgroundColor: theme.palette.background.paper,
        ':focus': {
          top: 0,
        }
      }}
    >
      Skip to main content
    </a>
  );

  return (
    <ErrorBoundary
      fallback={errorConfig?.fallback}
      onError={errorConfig?.onError}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          direction: rtl ? 'rtl' : 'ltr'
        }}
        lang={lang}
      >
        {skipLink}
        
        <Layout
          title={title}
          subtitle={subtitle}
          actions={actions}
          showBreadcrumbs={true}
        >
          <Box
            id="main-content"
            component="main"
            role={ACCESSIBILITY_ROLES.main}
            sx={{
              flexGrow: 1,
              padding: {
                xs: DASHBOARD_PADDING / 2,
                sm: DASHBOARD_PADDING,
                md: DASHBOARD_PADDING * 1.5
              },
              transition: theme.transitions.create(['padding', 'margin'], {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
              ...(rtl && {
                marginLeft: 'auto',
                marginRight: 0,
              })
            }}
          >
            {children}
          </Box>
        </Layout>
      </Box>
    </ErrorBoundary>
  );
});

// Display name for debugging
DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;