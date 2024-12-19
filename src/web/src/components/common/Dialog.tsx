import React, { useCallback, useEffect, useRef } from 'react';
import { Dialog as MuiDialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { FocusTrap } from '@mui/base'; // ^5.0.0
import Button, { ButtonProps } from './Button';

// Enhanced props interface extending Material-UI DialogProps
interface DialogProps {
  open: boolean;
  onClose: (event: {}, reason: 'backdropClick' | 'escapeKeyDown' | 'closeButtonClick') => void;
  title: string | React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode[];
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  disableBackdropClick?: boolean;
  disableEscapeKeyDown?: boolean;
  highContrast?: boolean;
}

// Styled components with theme integration
const StyledDialog = styled(MuiDialog, {
  shouldForwardProp: (prop) => prop !== 'highContrast',
})<{ highContrast?: boolean }>(({ theme, highContrast }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.spacing(2),
    boxShadow: theme.shadows[highContrast ? 4 : 2],
    padding: theme.spacing(2),
    ...(highContrast && {
      border: `2px solid ${theme.palette.primary.main}`,
      outline: 'none',
    }),
  },
  '& .MuiBackdrop-root': {
    backgroundColor: highContrast 
      ? 'rgba(0, 0, 0, 0.9)'
      : 'rgba(0, 0, 0, 0.5)',
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  marginBottom: theme.spacing(2),
  fontSize: theme.typography.h6.fontSize,
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.palette.text.primary,
  '& .MuiTypography-root': {
    marginBottom: 0,
  },
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(2),
  overflowY: 'auto',
  '&:first-of-type': {
    paddingTop: theme.spacing(2),
  },
}));

const StyledDialogActions = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  marginTop: theme.spacing(2),
  gap: theme.spacing(1),
  '& .MuiButton-root': {
    minWidth: 100,
  },
}));

// Custom hook for dialog event handling
const useDialogHandlers = (props: DialogProps) => {
  const { onClose, disableBackdropClick, disableEscapeKeyDown } = props;
  
  const handleClose = useCallback((event: {}, reason: 'backdropClick' | 'escapeKeyDown' | 'closeButtonClick') => {
    if (reason === 'backdropClick' && disableBackdropClick) {
      return;
    }
    if (reason === 'escapeKeyDown' && disableEscapeKeyDown) {
      return;
    }
    onClose(event, reason);
  }, [onClose, disableBackdropClick, disableEscapeKeyDown]);

  return { handleClose };
};

// Main Dialog component
const Dialog: React.FC<DialogProps> = React.memo((props) => {
  const {
    open,
    title,
    children,
    actions,
    maxWidth = 'sm',
    fullWidth = true,
    highContrast = false,
    ...rest
  } = props;

  const { handleClose } = useDialogHandlers(props);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus management
  useEffect(() => {
    if (open && dialogRef.current) {
      const focusableElements = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }
    }
  }, [open]);

  return (
    <FocusTrap open={open}>
      <StyledDialog
        ref={dialogRef}
        open={open}
        maxWidth={maxWidth}
        fullWidth={fullWidth}
        onClose={handleClose}
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        highContrast={highContrast}
        {...rest}
      >
        {title && (
          <StyledDialogTitle id="dialog-title">
            {title}
          </StyledDialogTitle>
        )}
        
        <StyledDialogContent id="dialog-description">
          {children}
        </StyledDialogContent>

        {actions && actions.length > 0 && (
          <StyledDialogActions>
            {actions.map((action, index) => (
              <React.Fragment key={index}>
                {action}
              </React.Fragment>
            ))}
          </StyledDialogActions>
        )}
      </StyledDialog>
    </FocusTrap>
  );
});

Dialog.displayName = 'Dialog';

export default Dialog;