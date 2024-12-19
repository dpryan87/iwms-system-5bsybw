import React, { useState, useCallback, useEffect, memo } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material'; // @version ^5.0.0
import { Menu as MenuIcon } from '@mui/icons-material'; // @version ^5.0.0
import { styled } from '@mui/material/styles'; // @version ^5.0.0

// Internal imports
import Sidebar from '../components/common/Sidebar';
import PageHeader from '../components/common/PageHeader';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Constants
const DRAWER_WIDTH = 240;
const APPBAR_HEIGHT = 64;
const TRANSITION_DURATION = 225;

// Styled components
const Root = styled(Box)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default
}));

const StyledAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== 'open'
})<{ open?: boolean }>(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: TRANSITION_DURATION,
  }),
  ...(open && {
    marginLeft: DRAWER_WIDTH,
    width: `calc(100% - ${DRAWER_WIDTH}px)`,
    [theme.breakpoints.up('md')]: {
      width: `calc(100% - ${DRAWER_WIDTH}px)`,
    },
  }),
}));

const MainContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'open'
})<{ open?: boolean }>(({ theme, open }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: TRANSITION_DURATION,
  }),
  marginLeft: 0,
  ...(open && {
    [theme.breakpoints.up('md')]: {
      marginLeft: DRAWER_WIDTH,
    },
  }),
}));

// Props interface
interface IMainLayoutProps {
  children: React.ReactNode;
  title: string;
  showBreadcrumbs?: boolean;
  className?: string;
  onSidebarToggle?: (isOpen: boolean) => void;
  headerProps?: Partial<typeof PageHeader>;
}

// Component
const MainLayout: React.FC<IMainLayoutProps> = memo(({
  children,
  title,
  showBreadcrumbs = true,
  className,
  onSidebarToggle,
  headerProps
}) => {
  // Hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  const [isLoading, setIsLoading] = useState(false);

  // Effect to handle responsive sidebar state
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  // Handlers
  const handleSidebarToggle = useCallback(() => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    onSidebarToggle?.(newState);
  }, [isSidebarOpen, onSidebarToggle]);

  const handleSidebarClose = useCallback(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
      onSidebarToggle?.(false);
    }
  }, [isMobile, onSidebarToggle]);

  const handleError = useCallback((error: Error) => {
    console.error('Layout error:', error);
    setIsLoading(false);
  }, []);

  return (
    <ErrorBoundary>
      <Root className={className}>
        {/* App Bar */}
        <StyledAppBar 
          position="fixed" 
          open={isSidebarOpen}
          elevation={1}
        >
          <Toolbar
            sx={{
              pr: '24px',
              minHeight: APPBAR_HEIGHT,
              justifyContent: 'space-between',
            }}
          >
            <IconButton
              edge="start"
              color="inherit"
              aria-label="toggle sidebar"
              onClick={handleSidebarToggle}
              sx={{
                marginRight: '36px',
                ...(isSidebarOpen && { display: { md: 'none' } }),
              }}
            >
              <MenuIcon />
            </IconButton>

            <PageHeader
              title={title}
              showBreadcrumbs={showBreadcrumbs}
              {...headerProps}
            />
          </Toolbar>
        </StyledAppBar>

        {/* Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={handleSidebarClose}
          onError={handleError}
        />

        {/* Main Content */}
        <MainContent
          component="main"
          open={isSidebarOpen}
          sx={{
            flexGrow: 1,
            height: '100vh',
            overflow: 'auto',
            pt: `${APPBAR_HEIGHT + theme.spacing(4)}px`,
          }}
        >
          {isLoading ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight="200px"
            >
              <CircularProgress />
            </Box>
          ) : (
            children
          )}
        </MainContent>
      </Root>
    </ErrorBoundary>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;