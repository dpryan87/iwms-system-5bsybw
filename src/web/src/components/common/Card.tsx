import React from 'react'; // @version ^18.0.0
import { Card as MuiCard, CardProps as MuiCardProps } from '@mui/material'; // @version ^5.0.0
import { styled } from '@mui/material/styles'; // @version ^5.0.0
import { Theme } from '../../styles/theme';

// Props interface extending Material-UI CardProps with additional features
export interface CardProps extends MuiCardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  interactive?: boolean;
  variant?: 'default' | 'outlined' | 'elevated';
  role?: string;
  'aria-label'?: string;
}

// Helper function to determine elevation shadow based on props and theme
const getElevation = (elevated: boolean | undefined, variant: string | undefined, theme: Theme) => {
  if (variant === 'outlined') return 'none';
  if (elevated) return theme.shadows[2];
  return theme.shadows[1];
};

// Styled wrapper for Material-UI Card with enhanced visual and interactive features
const StyledCard = styled(MuiCard, {
  shouldForwardProp: (prop) => !['elevated', 'interactive'].includes(prop as string),
})<CardProps>(({ theme, elevated, interactive, variant }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius * 2,
  backgroundColor: theme.palette.background.paper,
  border: variant === 'outlined' ? `1px solid ${theme.palette.divider}` : 'none',
  boxShadow: getElevation(elevated, variant, theme),
  transition: theme.transitions.create(
    ['box-shadow', 'transform'],
    {
      duration: theme.transitions.duration.shorter,
      easing: theme.transitions.easing.easeInOut,
    }
  ),
  willChange: 'transform, box-shadow',
  position: 'relative',

  // Interactive states for elevated and interactive cards
  ...(interactive && {
    cursor: 'pointer',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: elevated ? theme.shadows[3] : theme.shadows[2],
    },
    '&:active': {
      transform: 'translateY(0)',
      boxShadow: elevated ? theme.shadows[2] : theme.shadows[1],
    },
    '&:focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
    },
  }),

  // High contrast mode adjustments
  ...(theme.palette.mode === 'high-contrast' && {
    border: `2px solid ${theme.palette.text.primary}`,
    boxShadow: 'none',
  }),

  // Ensure proper color contrast for content
  color: theme.palette.text.primary,

  // Responsive adjustments
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

/**
 * A reusable card component that provides a consistent container for content
 * with elevation, padding, and theming support.
 *
 * @component
 * @example
 * ```tsx
 * <Card elevated interactive aria-label="Interactive card">
 *   <Typography>Card content</Typography>
 * </Card>
 * ```
 */
const Card: React.FC<CardProps> = ({
  children,
  className,
  elevated = false,
  interactive = false,
  variant = 'default',
  role,
  'aria-label': ariaLabel,
  ...props
}) => {
  // Determine appropriate ARIA role based on interactivity
  const defaultRole = interactive ? 'button' : 'article';
  const computedRole = role || defaultRole;

  return (
    <StyledCard
      className={className}
      elevated={elevated}
      interactive={interactive}
      variant={variant}
      role={computedRole}
      aria-label={ariaLabel}
      tabIndex={interactive ? 0 : undefined}
      {...props}
    >
      {children}
    </StyledCard>
  );
};

export default Card;