import React from 'react'; // ^18.0.0
import { Button as MuiButton } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import CircularProgress from '@mui/material/CircularProgress'; // ^5.0.0
import { Theme, ButtonVariants } from '../../styles/theme';

// Extended props interface for the Button component
interface ButtonProps extends React.ComponentPropsWithRef<typeof MuiButton> {
  variant?: 'contained' | 'outlined' | 'text' | 'gradient';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'neutral';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  loadingPosition?: 'start' | 'end' | 'center';
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children?: React.ReactNode;
  ariaLabel?: string;
  tooltipText?: string;
  dataTestId?: string;
}

// Styled component extending MUI Button with comprehensive theme integration
const StyledButton = styled(MuiButton)<ButtonProps>(({ theme, variant, size, color, loading }) => ({
  // Base styles
  position: 'relative',
  fontFamily: theme.typography.fontFamily,
  fontWeight: 500,
  borderRadius: theme.spacing(1),
  transition: theme.transitions.create(
    ['background-color', 'box-shadow', 'border-color', 'color'],
    { duration: theme.transitions.duration.short }
  ),

  // Size-specific padding
  ...(size === 'small' && {
    padding: `${theme.spacing(0.75)} ${theme.spacing(2)}`,
    fontSize: theme.typography.body2.fontSize,
  }),
  ...(size === 'medium' && {
    padding: `${theme.spacing(1)} ${theme.spacing(2.5)}`,
    fontSize: theme.typography.body1.fontSize,
  }),
  ...(size === 'large' && {
    padding: `${theme.spacing(1.25)} ${theme.spacing(3)}`,
    fontSize: theme.typography.h6.fontSize,
  }),

  // Variant-specific styles
  ...(variant === 'gradient' && {
    background: `linear-gradient(45deg, ${theme.palette[color || 'primary'].main} 30%, ${theme.palette[color || 'primary'].light} 90%)`,
    color: theme.palette[color || 'primary'].contrastText,
    border: 'none',
    boxShadow: theme.shadows[2],
    '&:hover': {
      boxShadow: theme.shadows[4],
    },
  }),

  // Loading state styles
  ...(loading && {
    pointerEvents: 'none',
    opacity: 0.7,
  }),

  // High contrast mode adjustments
  ...(theme.custom?.mode === 'high-contrast' && {
    border: '2px solid currentColor',
    '&:focus': {
      outline: `3px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
  }),

  // Focus visible styles for keyboard navigation
  '&.Mui-focusVisible': {
    outline: `3px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },

  // Touch device optimizations
  '@media (hover: none)': {
    '&:hover': {
      backgroundColor: 'transparent',
    },
  },

  // RTL support
  '& .MuiButton-startIcon': {
    marginRight: theme.direction === 'rtl' ? 0 : theme.spacing(1),
    marginLeft: theme.direction === 'rtl' ? theme.spacing(1) : 0,
  },
  '& .MuiButton-endIcon': {
    marginLeft: theme.direction === 'rtl' ? 0 : theme.spacing(1),
    marginRight: theme.direction === 'rtl' ? theme.spacing(1) : 0,
  },
}));

// Main button component with comprehensive accessibility
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const {
    children,
    loading = false,
    loadingPosition = 'center',
    disabled = false,
    startIcon,
    endIcon,
    ariaLabel,
    tooltipText,
    dataTestId,
    onClick,
    ...rest
  } = props;

  // Loading indicator component
  const LoadingIndicator = () => (
    <CircularProgress
      size={20}
      color="inherit"
      sx={{
        position: 'absolute',
        ...(loadingPosition === 'start' && { left: '10%' }),
        ...(loadingPosition === 'end' && { right: '10%' }),
        ...(loadingPosition === 'center' && {
          left: '50%',
          transform: 'translateX(-50%)',
        }),
      }}
    />
  );

  return (
    <StyledButton
      ref={ref}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-busy={loading}
      aria-disabled={disabled}
      title={tooltipText}
      data-testid={dataTestId}
      startIcon={!loading && loadingPosition !== 'start' ? startIcon : null}
      endIcon={!loading && loadingPosition !== 'end' ? endIcon : null}
      {...rest}
    >
      {loading && <LoadingIndicator />}
      <span
        style={{
          visibility: loading ? 'hidden' : 'visible',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        {children}
      </span>
    </StyledButton>
  );
});

// Display name for dev tools
Button.displayName = 'Button';

// Memoize the component for performance
export default React.memo(Button);