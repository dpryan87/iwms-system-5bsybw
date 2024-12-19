import React, { useCallback, useEffect, useRef, memo } from 'react';
import { Modal as MuiModal, Backdrop, Fade } from '@mui/material'; // @mui/material version ^5.0.0
import { styled } from '@mui/material/styles'; // @mui/material version ^5.0.0
import type { ModalProps as MuiModalProps } from '@mui/material';
import type { CustomTheme } from '../../styles/theme';

// Enhanced props interface extending Material-UI's Modal props
interface ModalProps extends Omit<MuiModalProps, 'children'> {
  open: boolean;
  onClose: (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => void;
  children: React.ReactNode;
  keepMounted?: boolean;
  disableBackdropClick?: boolean;
  disableEscapeKeyDown?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaDescribedby?: string;
  initialFocusRef?: React.RefObject<HTMLElement>;
}

// Styled Modal component with theme integration
const StyledModal = styled(MuiModal)<{ theme: CustomTheme }>(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(2),

  // High contrast mode support
  '@media (prefers-contrast: more)': {
    '& .MuiPaper-root': {
      border: `2px solid ${theme.palette.text.primary}`,
      outline: 'none',
    },
  },

  // Focus visible styles
  '& :focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

// Enhanced backdrop with theme integration
const StyledBackdrop = styled(Backdrop)<{ theme: CustomTheme }>(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'high-contrast'
    ? 'rgba(0, 0, 0, 0.9)'
    : 'rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(4px)',
  transition: theme.transitions.create('opacity', {
    duration: theme.transitions.duration.standard,
  }),
}));

// Custom hook for managing modal focus
const useModalFocus = (
  isOpen: boolean,
  initialFocusRef?: React.RefObject<HTMLElement>
) => {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Store current active element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Set initial focus
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      }

      return () => {
        // Restore focus on unmount
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen, initialFocusRef]);
};

// Main Modal component
const Modal = memo(({
  open,
  onClose,
  children,
  keepMounted = false,
  disableBackdropClick = false,
  disableEscapeKeyDown = false,
  className,
  ariaLabel,
  ariaDescribedby,
  initialFocusRef,
  ...props
}: ModalProps) => {
  // Initialize focus management
  useModalFocus(open, initialFocusRef);

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: {}) => {
    if (!disableBackdropClick) {
      onClose(event, 'backdropClick');
    }
  }, [disableBackdropClick, onClose]);

  // Handle escape key
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!disableEscapeKeyDown && event.key === 'Escape') {
      onClose(event, 'escapeKeyDown');
    }
  }, [disableEscapeKeyDown, onClose]);

  return (
    <StyledModal
      open={open}
      onClose={onClose}
      keepMounted={keepMounted}
      closeAfterTransition
      disableAutoFocus={!!initialFocusRef}
      disableEnforceFocus={false}
      disableRestoreFocus={false}
      aria-labelledby={ariaLabel}
      aria-describedby={ariaDescribedby}
      className={className}
      onKeyDown={handleKeyDown}
      BackdropComponent={StyledBackdrop}
      BackdropProps={{
        onClick: handleBackdropClick,
        timeout: 500,
      }}
      {...props}
    >
      <Fade in={open} timeout={300}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabel}
          aria-describedby={ariaDescribedby}
          style={{
            outline: 'none',
            position: 'relative',
          }}
        >
          {children}
        </div>
      </Fade>
    </StyledModal>
  );
});

Modal.displayName = 'Modal';

export type { ModalProps };
export default Modal;