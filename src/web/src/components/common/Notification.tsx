import React from 'react';
import { Alert, Snackbar, IconButton } from '@mui/material'; // @mui/material version ^5.0.0
import CloseIcon from '@mui/icons-material/Close'; // @mui/icons-material version ^5.0.0
import { Theme } from '../../styles/theme';
import { styled } from '@mui/material/styles';

/**
 * Props interface for the Notification component
 */
interface NotificationProps {
  /** The notification message to display */
  message: string;
  /** The type/severity of the notification */
  severity: 'success' | 'error' | 'warning' | 'info';
  /** Controls notification visibility state */
  open: boolean;
  /** Handler for closing the notification */
  onClose: () => void;
  /** Duration in milliseconds before auto-hiding */
  autoHideDuration?: number;
}

// Styled Alert component with consistent styling and proper elevation
const StyledAlert = styled(Alert)(({ theme }) => ({
  margin: theme.spacing(1),
  width: '100%',
  maxWidth: '400px',
  boxShadow: theme.shadows[3],
  borderRadius: theme.shape.borderRadius,
  '& .MuiAlert-icon': {
    marginRight: theme.spacing(1),
  },
  '& .MuiAlert-message': {
    padding: theme.spacing(0.5, 0),
    flex: 1,
  },
  '& .MuiAlert-action': {
    padding: theme.spacing(0, 0.5),
    marginRight: -theme.spacing(0.5),
  },
}));

/**
 * A reusable notification component that displays system messages and alerts
 * with accessibility support and consistent styling.
 */
const Notification: React.FC<NotificationProps> = ({
  message,
  severity,
  open,
  onClose,
  autoHideDuration = 6000,
}) => {
  /**
   * Handles the notification close event with clickaway protection
   * @param event - The event triggering the close
   * @param reason - The reason for closing
   */
  const handleClose = (
    event: React.SyntheticEvent | Event,
    reason?: string
  ): void => {
    // Prevent closing on clickaway
    if (reason === 'clickaway') {
      return;
    }

    // Call the provided onClose handler
    onClose();
  };

  // Action button for the Alert component
  const action = (
    <IconButton
      size="small"
      aria-label="close"
      color="inherit"
      onClick={handleClose}
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  );

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      TransitionProps={{
        mountOnEnter: true,
        unmountOnExit: true,
      }}
    >
      <StyledAlert
        severity={severity}
        variant="filled"
        elevation={6}
        onClose={handleClose}
        action={action}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
      >
        {message}
      </StyledAlert>
    </Snackbar>
  );
};

export default Notification;