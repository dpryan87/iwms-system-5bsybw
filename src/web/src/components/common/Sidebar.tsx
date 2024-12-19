import React, { memo, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  useTheme,
  useMediaQuery,
  Divider,
  Tooltip,
  Box
} from '@mui/material'; // @version ^5.0.0
import {
  Dashboard as DashboardIcon,
  Map as MapIcon,
  Description as DescriptionIcon,
  People as PeopleIcon,
  Inventory as InventoryIcon,
  Settings as SettingsIcon,
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material'; // @version ^5.0.0

// Internal imports
import { ROUTES } from '../../constants/routes.constants';
import { useAuth } from '../../hooks/useAuth';
import ErrorBoundary from '../../components/common/ErrorBoundary';

// Constants
const DRAWER_WIDTH = 240;

// Interfaces
interface ISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

interface INavigationItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: string[];
  'aria-label': string;
  'data-testid': string;
  isActive?: boolean;
  onClick?: () => void;
}

// Navigation items configuration with role-based access
const NAVIGATION_ITEMS: INavigationItem[] = [
  {
    label: 'Dashboard',
    path: ROUTES.DASHBOARD.path,
    icon: <DashboardIcon />,
    roles: ['admin', 'user'],
    'aria-label': 'Navigate to Dashboard',
    'data-testid': 'nav-dashboard'
  },
  {
    label: 'Floor Plans',
    path: ROUTES.FLOOR_PLANS.path,
    icon: <MapIcon />,
    roles: ['admin', 'user'],
    'aria-label': 'Navigate to Floor Plans',
    'data-testid': 'nav-floor-plans'
  },
  {
    label: 'Leases',
    path: ROUTES.LEASES.path,
    icon: <DescriptionIcon />,
    roles: ['admin'],
    'aria-label': 'Navigate to Leases',
    'data-testid': 'nav-leases'
  },
  {
    label: 'Occupancy',
    path: ROUTES.OCCUPANCY.path,
    icon: <PeopleIcon />,
    roles: ['admin', 'user'],
    'aria-label': 'Navigate to Occupancy',
    'data-testid': 'nav-occupancy'
  },
  {
    label: 'Resources',
    path: ROUTES.RESOURCES.path,
    icon: <InventoryIcon />,
    roles: ['admin', 'user'],
    'aria-label': 'Navigate to Resources',
    'data-testid': 'nav-resources'
  },
  {
    label: 'Settings',
    path: ROUTES.SETTINGS.path,
    icon: <SettingsIcon />,
    roles: ['admin'],
    'aria-label': 'Navigate to Settings',
    'data-testid': 'nav-settings'
  }
];

// Custom hook for managing navigation items with role-based filtering
const useNavigationItems = (authState: ReturnType<typeof useAuth>['state']) => {
  const location = useLocation();
  const navigate = useNavigate();

  return useMemo(() => {
    if (!authState.user) return [];

    return NAVIGATION_ITEMS.filter(item => {
      // Check if user has required role for this item
      return item.roles.some(role => 
        authState.user?.permissions.includes(role)
      );
    }).map(item => ({
      ...item,
      isActive: location.pathname.startsWith(item.path),
      onClick: () => navigate(item.path)
    }));
  }, [authState.user, location.pathname, navigate]);
};

const Sidebar: React.FC<ISidebarProps> = memo(({
  isOpen,
  onClose,
  className,
  'aria-label': ariaLabel = 'Navigation Sidebar',
  'data-testid': dataTestId = 'sidebar'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { state: authState } = useAuth();
  const navigationItems = useNavigationItems(authState);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Drawer styles
  const drawerStyles = {
    width: DRAWER_WIDTH,
    flexShrink: 0,
    '& .MuiDrawer-paper': {
      width: DRAWER_WIDTH,
      boxSizing: 'border-box',
      backgroundColor: theme.palette.background.paper,
      borderRight: `1px solid ${theme.palette.divider}`,
      transition: theme.transitions.create(['width', 'margin'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
    },
  };

  const drawerContent = (
    <Box
      role="navigation"
      aria-label={ariaLabel}
      data-testid={dataTestId}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
        <IconButton
          onClick={handleClose}
          aria-label="Close navigation"
          data-testid="sidebar-close-button"
        >
          <ChevronLeftIcon />
        </IconButton>
      </Box>
      <Divider />
      <List sx={{ flex: 1, pt: 2 }}>
        {navigationItems.map((item) => (
          <Tooltip
            key={item.path}
            title={item.label}
            placement="right"
            arrow
            enterDelay={500}
          >
            <ListItem
              button
              onClick={item.onClick}
              selected={item.isActive}
              aria-label={item['aria-label']}
              data-testid={item['data-testid']}
              sx={{
                mb: 1,
                borderRadius: 1,
                mx: 1,
                '&.Mui-selected': {
                  backgroundColor: theme.palette.action.selected,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: item.isActive ? theme.palette.primary.main : 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  variant: 'body2',
                  color: item.isActive ? 'primary' : 'textPrimary',
                }}
              />
            </ListItem>
          </Tooltip>
        ))}
      </List>
    </Box>
  );

  return (
    <ErrorBoundary>
      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        anchor="left"
        open={isOpen}
        onClose={handleClose}
        className={className}
        sx={drawerStyles}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
      >
        {drawerContent}
      </Drawer>
    </ErrorBoundary>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;