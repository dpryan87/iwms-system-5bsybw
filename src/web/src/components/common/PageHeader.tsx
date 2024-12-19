import React from 'react';
import { Box, Typography, Stack } from '@mui/material'; // @mui/material version ^5.0.0
import { generateBreadcrumbs } from './Breadcrumbs';
import { SPACING } from '../../constants/theme.constants';

// Interface for component props with comprehensive type checking
interface IPageHeaderProps {
  /** Main title of the page */
  title: string;
  /** Optional subtitle for additional context */
  subtitle?: string;
  /** Flag to show/hide breadcrumb navigation */
  showBreadcrumbs?: boolean;
  /** Optional action buttons or controls */
  actions?: React.ReactNode;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Direction for RTL support - 'ltr' | 'rtl' */
  dir?: 'ltr' | 'rtl';
}

/**
 * PageHeader component providing consistent layout and styling for page titles
 * with support for breadcrumbs, actions, and RTL layouts.
 * Implements F-pattern layout and WCAG 2.1 Level AA compliance.
 *
 * @param props - Component properties
 * @returns JSX.Element - Rendered page header component
 */
const PageHeader: React.FC<IPageHeaderProps> = React.memo(({
  title,
  subtitle,
  showBreadcrumbs = true,
  actions,
  className,
  dir = 'ltr'
}) => {
  // Error boundary for breadcrumb generation
  const renderBreadcrumbs = () => {
    try {
      if (!showBreadcrumbs) return null;
      return generateBreadcrumbs(window.location.pathname, {
        showHome: true,
        enableRTL: dir === 'rtl',
        maxItems: 5
      });
    } catch (error) {
      console.error('Error generating breadcrumbs:', error);
      return null;
    }
  };

  return (
    <Box
      component="header"
      className={className}
      sx={{
        padding: {
          xs: SPACING.grid(2),
          sm: SPACING.grid(3),
          md: SPACING.grid(4)
        },
        marginBottom: SPACING.grid(3),
        backgroundColor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        direction: dir
      }}
    >
      <Stack
        spacing={SPACING.unit}
        sx={{
          maxWidth: '100%',
          marginInlineStart: dir === 'rtl' ? 'auto' : 0,
          marginInlineEnd: dir === 'rtl' ? 0 : 'auto'
        }}
      >
        {/* Breadcrumb navigation with error handling */}
        {renderBreadcrumbs()}

        {/* Main content area with F-pattern layout */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={SPACING.unit * 2}
        >
          {/* Title and subtitle section */}
          <Stack spacing={SPACING.unit}>
            <Typography
              variant="h1"
              component="h1"
              sx={{
                fontSize: {
                  xs: '1.5rem',
                  sm: '1.75rem',
                  md: '2rem'
                },
                fontWeight: 600,
                color: 'text.primary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: { xs: '100%', sm: '60vw', md: '70vw' }
              }}
              aria-level={1}
            >
              {title}
            </Typography>

            {subtitle && (
              <Typography
                variant="subtitle1"
                sx={{
                  color: 'text.secondary',
                  fontSize: {
                    xs: '0.875rem',
                    sm: '1rem'
                  },
                  maxWidth: { xs: '100%', sm: '50vw', md: '60vw' }
                }}
                aria-label={`${title} subtitle`}
              >
                {subtitle}
              </Typography>
            )}
          </Stack>

          {/* Actions section with RTL support */}
          {actions && (
            <Box
              sx={{
                display: 'flex',
                gap: SPACING.unit,
                marginInlineStart: 'auto',
                flexShrink: 0,
                alignSelf: { xs: 'stretch', sm: 'center' }
              }}
              aria-label="Page actions"
            >
              {actions}
            </Box>
          )}
        </Stack>
      </Stack>
    </Box>
  );
});

// Display name for debugging
PageHeader.displayName = 'PageHeader';

export default PageHeader;