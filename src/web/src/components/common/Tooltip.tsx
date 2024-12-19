import React, { useCallback, useState, useRef } from 'react';
import { Tooltip, useMediaQuery } from '@mui/material';
import { styled } from '@mui/material/styles';
import createAppTheme, { CustomTheme } from '../../styles/theme';

// Interface for tooltip props with comprehensive options
interface TooltipProps {
  children: React.ReactNode;
  title: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  arrow?: boolean;
  className?: string;
  onOpen?: (event: React.MouseEvent | React.FocusEvent) => void;
  onClose?: (event: React.MouseEvent | React.FocusEvent) => void;
  highContrast?: boolean;
  enterDelay?: number;
  leaveDelay?: number;
  disabled?: boolean;
  id?: string;
}

// Styled tooltip component with theme integration
const StyledTooltip = styled(Tooltip, {
  shouldForwardProp: (prop) => 
    !['highContrast', 'reducedMotion'].includes(prop as string)
})<{ 
  theme: CustomTheme; 
  highContrast?: boolean; 
  reducedMotion?: boolean; 
}>(({ theme, highContrast, reducedMotion }) => ({
  '& .MuiTooltip-tooltip': {
    backgroundColor: highContrast 
      ? theme.palette.common.black 
      : theme.palette.mode === 'dark'
        ? theme.palette.grey[900]
        : theme.palette.grey[700],
    color: highContrast 
      ? theme.palette.common.white 
      : theme.palette.common.white,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    maxWidth: 300,
    wordWrap: 'break-word',
    boxShadow: theme.shadows[2],
    transition: reducedMotion 
      ? 'none' 
      : `opacity ${theme.transitions.duration.shorter}ms ${theme.transitions.easing.easeInOut}`,
    
    // High contrast mode specific styles
    ...(highContrast && {
      border: `2px solid ${theme.palette.common.white}`,
      fontWeight: theme.typography.fontWeightMedium,
    }),
  },

  // Arrow styles
  '& .MuiTooltip-arrow': {
    color: highContrast 
      ? theme.palette.common.black 
      : theme.palette.mode === 'dark'
        ? theme.palette.grey[900]
        : theme.palette.grey[700],
    
    ...(highContrast && {
      '&::before': {
        border: `2px solid ${theme.palette.common.white}`,
      },
    }),
  },
}));

export const CustomTooltip: React.FC<TooltipProps> = ({
  children,
  title,
  placement = 'top',
  arrow = true,
  className,
  onOpen,
  onClose,
  highContrast = false,
  enterDelay = 200,
  leaveDelay = 0,
  disabled = false,
  id,
  ...props
}) => {
  const [open, setOpen] = useState(false);
  const touchInteraction = useRef(false);
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Handle tooltip open with accessibility considerations
  const handleTooltipOpen = useCallback((event: React.MouseEvent | React.FocusEvent) => {
    // Prevent opening on touch devices to avoid double-tap issues
    if (touchInteraction.current) {
      touchInteraction.current = false;
      return;
    }

    setOpen(true);
    onOpen?.(event);

    // Ensure proper focus management for keyboard navigation
    if (event.type === 'focus') {
      const target = event.target as HTMLElement;
      target.setAttribute('aria-describedby', id || '');
    }
  }, [onOpen, id]);

  // Handle tooltip close with cleanup
  const handleTooltipClose = useCallback((event: React.MouseEvent | React.FocusEvent) => {
    setOpen(false);
    onClose?.(event);

    // Clean up ARIA attributes
    if (event.type === 'blur') {
      const target = event.target as HTMLElement;
      target.removeAttribute('aria-describedby');
    }
  }, [onClose]);

  // Handle touch interactions
  const handleTouchStart = useCallback(() => {
    touchInteraction.current = true;
  }, []);

  if (!title || disabled) {
    return <>{children}</>;
  }

  return (
    <StyledTooltip
      open={open}
      onOpen={handleTooltipOpen}
      onClose={handleTooltipClose}
      title={title}
      placement={placement}
      arrow={arrow}
      className={className}
      enterDelay={enterDelay}
      leaveDelay={leaveDelay}
      highContrast={highContrast}
      reducedMotion={prefersReducedMotion}
      {...props}
      PopperProps={{
        ...props.PopperProps,
        sx: {
          zIndex: theme => theme.zIndex.tooltip,
        },
      }}
      componentsProps={{
        tooltip: {
          'aria-live': 'polite',
          role: 'tooltip',
          id: id,
        },
        popper: {
          'data-testid': 'custom-tooltip-popper',
        },
      }}
      onTouchStart={handleTouchStart}
      enterTouchDelay={700} // Longer delay for touch devices
      leaveTouchDelay={1500}
    >
      {React.cloneElement(children as React.ReactElement, {
        'aria-describedby': open ? id : undefined,
        onFocus: handleTooltipOpen,
        onBlur: handleTooltipClose,
        onMouseEnter: handleTooltipOpen,
        onMouseLeave: handleTooltipClose,
      })}
    </StyledTooltip>
  );
};

export default CustomTooltip;