import React, { memo } from 'react';
import { Box, Container, useTheme, useMediaQuery } from '@mui/material';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { useAuth } from '../hooks/useAuth';

/**
 * Props interface for the AuthLayout component
 */
interface IAuthLayoutProps {
  /** Child components to render within the layout */
  children: React.ReactNode;
  /** Whether to show the logo in the layout */
  showLogo?: boolean;
  /** Maximum width of the content container */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Optional custom styles */
  style?: React.CSSProperties;
}

/**
 * AuthLayout Component
 * 
 * Provides a secure and accessible layout structure for authentication pages
 * with responsive design and proper ARIA attributes.
 * 
 * @param props - Component props
 * @returns JSX.Element
 */
const AuthLayout: React.FC<IAuthLayoutProps> = memo(({ 
  children,
  showLogo = true,
  maxWidth = 'xs',
  style
}) => {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Auth context for security state
  const { state: { loading, error } } = useAuth();

  /**
   * Handles keyboard navigation for accessibility
   */
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Focus on the first focusable element
      const firstFocusable = document.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }
  };

  return (
    <ErrorBoundary>
      <Box
        component="main"
        role="main"
        aria-label="Authentication page"
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.palette.background.default,
          padding: isMobile ? theme.spacing(2) : theme.spacing(4),
          ...style
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Logo Section */}
        {showLogo && (
          <Box
            component="header"
            role="banner"
            sx={{
              marginBottom: theme.spacing(4),
              textAlign: 'center'
            }}
          >
            {/* Logo would be implemented here */}
          </Box>
        )}

        {/* Main Content Container */}
        <Container
          maxWidth={maxWidth}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: theme.palette.background.paper,
            borderRadius: theme.shape.borderRadius,
            boxShadow: theme.shadows[3],
            padding: theme.spacing(3),
            position: 'relative',
            '& > *': {
              width: '100%'
            }
          }}
        >
          {/* Loading and Error States */}
          {loading && (
            <Box
              role="status"
              aria-label="Loading"
              aria-live="polite"
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: theme.zIndex.modal + 1
              }}
            >
              {/* Loading indicator would be implemented here */}
            </Box>
          )}

          {/* Error Message */}
          {error && (
            <Box
              role="alert"
              aria-live="assertive"
              sx={{
                marginBottom: theme.spacing(2),
                color: theme.palette.error.main
              }}
            >
              {error}
            </Box>
          )}

          {/* Main Content */}
          <Box
            role="region"
            aria-label="Authentication form"
            sx={{
              width: '100%'
            }}
          >
            {children}
          </Box>
        </Container>

        {/* Footer Section */}
        <Box
          component="footer"
          role="contentinfo"
          sx={{
            marginTop: theme.spacing(4),
            textAlign: 'center',
            color: theme.palette.text.secondary
          }}
        >
          {/* Footer content would be implemented here */}
        </Box>
      </Box>
    </ErrorBoundary>
  );
});

// Display name for debugging
AuthLayout.displayName = 'AuthLayout';

export default AuthLayout;