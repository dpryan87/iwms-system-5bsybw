import React, { useMemo } from 'react';
import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from '@mui/material'; // @mui/material version ^5.0.0
import { NavigateNext } from '@mui/icons-material'; // @mui/icons-material version ^5.0.0
import { useLocation } from 'react-router-dom'; // react-router-dom version ^6.0.0
import { useTranslation } from 'react-i18next'; // react-i18next version ^12.0.0
import { SPACING } from '../../constants/theme.constants';

// Constants
const BREADCRUMB_ARIA_LABEL = 'Page navigation breadcrumb';
const MAX_LABEL_LENGTH = 25;

// Interfaces
interface IBreadcrumbsProps {
  className?: string;
  showHome?: boolean;
  separator?: React.ReactNode;
  maxItems?: number;
  enableRTL?: boolean;
  onNavigate?: (path: string) => void;
}

interface IBreadcrumb {
  label: string;
  path: string;
  isLast: boolean;
  translationKey?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generates breadcrumb items from the current route path
 * @param pathname - Current route pathname
 * @param options - Configuration options for breadcrumb generation
 * @returns Array of breadcrumb items
 */
export const generateBreadcrumbs = React.memo((
  pathname: string,
  options: { showHome?: boolean; enableRTL?: boolean; maxItems?: number }
): IBreadcrumb[] => {
  const { showHome = true, enableRTL = false, maxItems } = options;

  // Sanitize pathname
  const sanitizedPath = pathname.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
  if (!sanitizedPath) return [];

  // Split path into segments
  const segments = sanitizedPath.split('/').filter(Boolean);
  let breadcrumbs: IBreadcrumb[] = [];
  let currentPath = '';

  // Generate breadcrumb items
  breadcrumbs = segments.map((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;

    // Convert segment to readable label
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return {
      label: label.length > MAX_LABEL_LENGTH 
        ? `${label.slice(0, MAX_LABEL_LENGTH)}...` 
        : label,
      path: currentPath,
      isLast,
      translationKey: `breadcrumbs.${segment}`,
      metadata: {
        position: index + 1,
        segment
      }
    };
  });

  // Add home breadcrumb if enabled
  if (showHome) {
    breadcrumbs.unshift({
      label: 'Home',
      path: '/',
      isLast: breadcrumbs.length === 0,
      translationKey: 'breadcrumbs.home',
      metadata: {
        position: 0,
        segment: 'home'
      }
    });
  }

  // Apply RTL transformation if enabled
  if (enableRTL) {
    breadcrumbs.reverse();
  }

  // Apply maxItems limit if specified
  if (maxItems && breadcrumbs.length > maxItems) {
    const start = breadcrumbs.slice(0, 1);
    const end = breadcrumbs.slice(-2);
    breadcrumbs = [
      ...start,
      { label: '...', path: '', isLast: false },
      ...end
    ];
  }

  return breadcrumbs;
});

/**
 * Breadcrumbs component providing hierarchical navigation
 * with accessibility and internationalization support
 */
const Breadcrumbs: React.FC<IBreadcrumbsProps> = ({
  className,
  showHome = true,
  separator = <NavigateNext fontSize="small" />,
  maxItems = 8,
  enableRTL = false,
  onNavigate
}) => {
  const location = useLocation();
  const { t } = useTranslation();

  // Generate breadcrumbs based on current location
  const breadcrumbs = useMemo(() => 
    generateBreadcrumbs(location.pathname, { showHome, enableRTL, maxItems }), 
    [location.pathname, showHome, enableRTL, maxItems]
  );

  // Handle navigation
  const handleClick = (path: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    onNavigate?.(path);
  };

  if (breadcrumbs.length === 0) return null;

  return (
    <MuiBreadcrumbs
      className={className}
      separator={separator}
      aria-label={BREADCRUMB_ARIA_LABEL}
      sx={{
        padding: `${SPACING.unit}px ${SPACING.unit * 2}px`,
        '& .MuiBreadcrumbs-separator': {
          mx: 1
        }
      }}
    >
      {breadcrumbs.map(({ label, path, isLast, translationKey }, index) => {
        const translatedLabel = translationKey ? t(translationKey, { defaultValue: label }) : label;

        return isLast ? (
          <Typography
            key={path || index}
            color="text.primary"
            aria-current="page"
            sx={{
              fontWeight: 500,
              fontSize: '0.875rem'
            }}
          >
            {translatedLabel}
          </Typography>
        ) : (
          <Link
            key={path || index}
            href={path}
            onClick={handleClick(path)}
            color="text.secondary"
            underline="hover"
            sx={{
              fontSize: '0.875rem',
              '&:hover': {
                color: 'primary.main'
              }
            }}
          >
            {translatedLabel}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
};

export default React.memo(Breadcrumbs);