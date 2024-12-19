import React, { useState, useCallback } from 'react';
import { Box, Container, useTheme, useMediaQuery, styled } from '@mui/material'; // @version ^5.0.0

// Internal imports
import Sidebar from './Sidebar';
import PageHeader from './PageHeader';

// Constants for layout dimensions and transitions
const DRAWER_WIDTH = 240;
const CONTENT_PADDING = 24;
const TRANSITION_DURATION = 225;

// Styled components for enhanced layout management
const LayoutRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  overflow: 'hidden',
  backgroundColor: theme.palette.background.default
}));

const LayoutContent = styled(Box, {
  shouldForwardProp: prop => !['open', 'isMobile'].includes(prop as string)
})<{ open: boolean; isMobile: boolean }>(({ theme, open, isMobile }) => ({
  flexGrow: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: TRANSITION_DURATION,
  }),
  marginLeft: isMobile ? 0 : open ? DRAWER_WIDTH : 0,
  [theme.breakpoints.up('lg')]: {
    marginLeft: open ? DRAWER_WIDTH : 0,
  },
}));

// Interface for Layout component props
interface ILayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  showBreadcrumbs?: boolean;
  actions?: React.ReactNode;
  isLoading?: boolean;
  direction?: 'ltr' | 'rtl';
}

/**
 * Main layout component that provides the application structure with responsive
 * sidebar navigation, header, and content area. Supports RTL layouts and
 * implements enhanced accessibility features.
 *
 * @param props - Layout component properties
 * @returns JSX.Element - Rendered layout component
 */
const Layout: React.FC<ILayoutProps> = React.memo(({
  children,
  title,
  subtitle,
  showBreadcrumbs = true,
  actions,
  isLoading = false,
  direction = 'ltr'
}) => {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));

  // State management
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // Event handlers
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const handleSidebarClose = useCallback(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  return (
    <LayoutRoot
      dir={direction}
      role="main"
      aria-label="Main application layout"
    >
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={handleSidebarClose}
        aria-label="Main navigation sidebar"
        data-testid="layout-sidebar"
      />

      {/* Main Content Area */}
      <LayoutContent
        open={sidebarOpen}
        isMobile={isMobile}
        component="main"
        sx={{
          backgroundColor: 'background.default',
          position: 'relative',
          paddingTop: { xs: 2, sm: 3 },
          paddingBottom: { xs: 2, sm: 3 },
        }}
      >
        {/* Page Header */}
        <PageHeader
          title={title}
          subtitle={subtitle}
          showBreadcrumbs={showBreadcrumbs}
          actions={actions}
          dir={direction}
        />

        {/* Main Content Container */}
        <Container
          maxWidth={false}
          sx={{
            flexGrow: 1,
            px: {
              xs: CONTENT_PADDING / 2,
              sm: CONTENT_PADDING,
              md: CONTENT_PADDING * 1.5
            },
            py: {
              xs: CONTENT_PADDING / 2,
              sm: CONTENT_PADDING
            },
            transition: theme.transitions.create(['padding'], {
              easing: theme.transitions.easing.sharp,
              duration: TRANSITION_DURATION,
            }),
          }}
        >
          {/* Loading State Handler */}
          {isLoading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '200px'
              }}
              role="progressbar"
              aria-busy="true"
              aria-label="Loading content"
            >
              {/* Add your loading component here */}
            </Box>
          ) : (
            children
          )}
        </Container>
      </LayoutContent>
    </LayoutRoot>
  );
});

// Display name for debugging
Layout.displayName = 'Layout';

export default Layout;