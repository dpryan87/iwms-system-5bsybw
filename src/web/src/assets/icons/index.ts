/**
 * @fileoverview Central icon management system for the IWMS application
 * Provides consistent icon usage across the application with TypeScript safety
 * @version 1.0.0
 */

// @mui/icons-material v5.0.0
import {
  Dashboard,
  DashboardOutlined,
  Map,
  MapOutlined,
  Description,
  DescriptionOutlined,
  PeopleAlt,
  PeopleAltOutlined,
  Settings,
  SettingsOutlined,
  CheckCircle,
  Error,
  Info,
  Warning,
  Add,
  Edit,
  Delete,
  Close,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Search,
  FilterList,
  Sort,
} from '@mui/icons-material';

import { SvgIconProps } from '@mui/material';

// Constants
export const ICON_SIZE = 24;

export const ICON_COLOR_MAP = {
  success: '#4caf50',
  error: '#f44336',
  warning: '#ff9800',
  info: '#2196f3',
} as const;

// Type Definitions
interface IconComponent {
  component: typeof SvgIconProps;
  size?: number;
  color?: string;
}

interface NavigationIconSet {
  active: IconComponent;
  inactive: IconComponent;
}

interface IconGroupInterface {
  dashboard: NavigationIconSet;
  floorPlans: NavigationIconSet;
  leases: NavigationIconSet;
  occupancy: NavigationIconSet;
  settings: NavigationIconSet;
}

interface StatusIconInterface {
  success: IconComponent;
  error: IconComponent;
  warning: IconComponent;
  info: IconComponent;
}

interface ActionIconInterface {
  add: IconComponent;
  edit: IconComponent;
  delete: IconComponent;
  close: IconComponent;
}

interface ControlIconInterface {
  expand: IconComponent;
  collapse: IconComponent;
  search: IconComponent;
  filter: IconComponent;
  sort: IconComponent;
}

/**
 * Navigation icons with active/inactive states
 * Used in sidebar and main navigation components
 */
export const navigationIcons: IconGroupInterface = {
  dashboard: {
    active: { component: Dashboard, size: ICON_SIZE },
    inactive: { component: DashboardOutlined, size: ICON_SIZE },
  },
  floorPlans: {
    active: { component: Map, size: ICON_SIZE },
    inactive: { component: MapOutlined, size: ICON_SIZE },
  },
  leases: {
    active: { component: Description, size: ICON_SIZE },
    inactive: { component: DescriptionOutlined, size: ICON_SIZE },
  },
  occupancy: {
    active: { component: PeopleAlt, size: ICON_SIZE },
    inactive: { component: PeopleAltOutlined, size: ICON_SIZE },
  },
  settings: {
    active: { component: Settings, size: ICON_SIZE },
    inactive: { component: SettingsOutlined, size: ICON_SIZE },
  },
};

/**
 * Status indicator icons for notifications and alerts
 * Each icon maps to a semantic color defined in ICON_COLOR_MAP
 */
export const statusIcons: StatusIconInterface = {
  success: { component: CheckCircle, size: ICON_SIZE, color: ICON_COLOR_MAP.success },
  error: { component: Error, size: ICON_SIZE, color: ICON_COLOR_MAP.error },
  warning: { component: Warning, size: ICON_SIZE, color: ICON_COLOR_MAP.warning },
  info: { component: Info, size: ICON_SIZE, color: ICON_COLOR_MAP.info },
};

/**
 * Action icons for common CRUD operations
 * Consistent sizing across all action buttons
 */
export const actionIcons: ActionIconInterface = {
  add: { component: Add, size: ICON_SIZE },
  edit: { component: Edit, size: ICON_SIZE },
  delete: { component: Delete, size: ICON_SIZE },
  close: { component: Close, size: ICON_SIZE },
};

/**
 * UI control icons for data manipulation and navigation
 * Supports RTL layouts through directional awareness
 */
export const controlIcons: ControlIconInterface = {
  expand: { component: KeyboardArrowDown, size: ICON_SIZE },
  collapse: { component: KeyboardArrowUp, size: ICON_SIZE },
  search: { component: Search, size: ICON_SIZE },
  filter: { component: FilterList, size: ICON_SIZE },
  sort: { component: Sort, size: ICON_SIZE },
};

// Type exports for consuming components
export type {
  IconComponent,
  NavigationIconSet,
  IconGroupInterface,
  StatusIconInterface,
  ActionIconInterface,
  ControlIconInterface,
};