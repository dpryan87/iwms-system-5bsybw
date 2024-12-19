import React, { useState, useCallback, memo, ReactNode } from 'react'; // react version ^18.0.0
import { Tabs as MuiTabs, Tab as MuiTab, Box } from '@mui/material'; // @mui/material version ^5.0.0
import { styled } from '@mui/material/styles'; // @mui/material version ^5.0.0
import { createAppTheme } from '../../styles/theme';

// Interfaces
interface ITab {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  icon?: string;
}

interface ITabsProps {
  tabs: ITab[];
  defaultTab?: number;
  onChange?: (index: number) => void;
  className?: string;
  ariaLabel?: string;
  lazyLoad?: boolean;
  customStyles?: object;
  vertical?: boolean;
}

// Styled components using theme-based styling
const StyledTabs = styled(MuiTabs)(({ theme }) => ({
  minHeight: 48,
  borderBottom: `1px solid ${theme.palette.divider}`,
  transition: `all ${theme.custom.transitions.duration.short}ms ${theme.custom.transitions.easing.easeInOut}`,
  
  [theme.breakpoints.down('sm')]: {
    minHeight: 40,
  },
  
  '& .MuiTabs-indicator': {
    height: 3,
    transition: `all ${theme.custom.transitions.duration.short}ms ${theme.custom.transitions.easing.easeInOut}`,
  },
}));

const StyledTab = styled(MuiTab)(({ theme }) => ({
  minHeight: 48,
  textTransform: 'none',
  fontWeight: theme.typography.fontWeightMedium,
  fontSize: theme.typography.body1.fontSize,
  transition: `all ${theme.custom.transitions.duration.short}ms ${theme.custom.transitions.easing.easeInOut}`,
  
  '&:hover': {
    opacity: 0.8,
    backgroundColor: theme.custom.interactive.hover,
  },
  
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: -2,
  },
  
  '&.Mui-selected': {
    fontWeight: theme.typography.fontWeightBold,
  },
  
  [theme.breakpoints.down('sm')]: {
    minHeight: 40,
    fontSize: theme.typography.body2.fontSize,
    padding: '6px 12px',
  },
}));

const TabPanelWrapper = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  role: 'tabpanel',
  outline: 'none',
  transition: `all ${theme.custom.transitions.duration.short}ms ${theme.custom.transitions.easing.easeInOut}`,
  
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.5),
  },
  
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

// TabPanel component with accessibility features
const TabPanel = memo(({ 
  value, 
  index, 
  children, 
  ariaLabel 
}: { 
  value: number; 
  index: number; 
  children: ReactNode; 
  ariaLabel: string; 
}) => {
  const isSelected = value === index;
  
  return (
    <TabPanelWrapper
      hidden={!isSelected}
      id={`tab-panel-${index}`}
      aria-labelledby={`tab-${index}`}
      aria-label={ariaLabel}
      tabIndex={isSelected ? 0 : -1}
      role="tabpanel"
    >
      {isSelected && children}
    </TabPanelWrapper>
  );
});

TabPanel.displayName = 'TabPanel';

// Main Tabs component
const Tabs: React.FC<ITabsProps> = ({
  tabs,
  defaultTab = 0,
  onChange,
  className,
  ariaLabel = 'Navigation tabs',
  lazyLoad = true,
  customStyles = {},
  vertical = false,
}) => {
  const [selectedTab, setSelectedTab] = useState(defaultTab);

  // Handle tab change with keyboard support
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
    onChange?.(newValue);
  }, [onChange]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const tabCount = tabs.length;
    let newIndex = selectedTab;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        newIndex = selectedTab > 0 ? selectedTab - 1 : tabCount - 1;
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        newIndex = selectedTab < tabCount - 1 ? selectedTab + 1 : 0;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = tabCount - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    setSelectedTab(newIndex);
    onChange?.(newIndex);
  }, [selectedTab, tabs.length, onChange]);

  return (
    <Box 
      className={className} 
      sx={{ 
        width: '100%',
        ...customStyles 
      }}
    >
      <StyledTabs
        value={selectedTab}
        onChange={handleTabChange}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        orientation={vertical ? 'vertical' : 'horizontal'}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        {tabs.map((tab, index) => (
          <StyledTab
            key={tab.id}
            id={`tab-${index}`}
            aria-controls={`tab-panel-${index}`}
            label={tab.label}
            disabled={tab.disabled}
            aria-label={tab.ariaLabel}
            icon={tab.icon ? <span className={tab.icon} /> : undefined}
            tabIndex={selectedTab === index ? 0 : -1}
          />
        ))}
      </StyledTabs>

      {tabs.map((tab, index) => (
        <TabPanel
          key={tab.id}
          value={selectedTab}
          index={index}
          ariaLabel={tab.ariaLabel || tab.label}
        >
          {(!lazyLoad || selectedTab === index) && tab.content}
        </TabPanel>
      ))}
    </Box>
  );
};

export default memo(Tabs);