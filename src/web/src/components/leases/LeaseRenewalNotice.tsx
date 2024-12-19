import React, { useState, useCallback, useEffect } from 'react';
import { Card, Button, CircularProgress, Typography, Box } from '@mui/material';
import { format, differenceInDays } from 'date-fns';

// Internal imports
import { ILease } from '../../types/lease.types';
import LeaseService from '../../services/lease.service';
import Notification from '../common/Notification';

/**
 * Props interface for the LeaseRenewalNotice component
 */
interface LeaseRenewalNoticeProps {
  /** Lease data including renewal information */
  lease: ILease;
  /** Callback function when renewal action is taken */
  onRenewalAction: () => Promise<void>;
  /** Controls visibility of the notification */
  showNotification?: boolean;
}

/**
 * A component that displays lease renewal notifications with enhanced accessibility
 * and user interaction features.
 */
const LeaseRenewalNotice: React.FC<LeaseRenewalNoticeProps> = ({
  lease,
  onRenewalAction,
  showNotification = true
}) => {
  // Component state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationOpen, setNotificationOpen] = useState<boolean>(showNotification);

  /**
   * Determines the renewal notification status and urgency
   * @param notificationDate - Date when notification is due
   * @param responseDeadline - Deadline for response
   * @returns Notification details with severity and message
   */
  const getRenewalStatus = useCallback((
    notificationDate: Date,
    responseDeadline: Date
  ) => {
    const daysUntilNotification = differenceInDays(
      new Date(notificationDate),
      new Date()
    );

    // Determine severity based on days remaining
    if (daysUntilNotification <= 30) {
      return {
        severity: 'error' as const,
        message: `Urgent: Lease renewal required by ${format(responseDeadline, 'MMM dd, yyyy')}`,
        icon: '🚨'
      };
    } else if (daysUntilNotification <= 60) {
      return {
        severity: 'warning' as const,
        message: `Action needed: Lease renewal due by ${format(responseDeadline, 'MMM dd, yyyy')}`,
        icon: '⚠️'
      };
    }
    return {
      severity: 'info' as const,
      message: `Upcoming renewal: Due by ${format(responseDeadline, 'MMM dd, yyyy')}`,
      icon: 'ℹ️'
    };
  }, []);

  /**
   * Handles the renewal action with loading state and error handling
   * @param event - Click event object
   */
  const handleRenewalAction = async (
    event: React.MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onRenewalAction();
      setNotificationOpen(false);
      
      // Announce success to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = 'Renewal action completed successfully';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setNotificationOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // Effect to handle notification visibility
  useEffect(() => {
    setNotificationOpen(showNotification);
  }, [showNotification]);

  // Get renewal status details
  const renewalStatus = getRenewalStatus(
    lease.renewal.lastNotificationDate || new Date(),
    lease.renewal.deadlineDate
  );

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          marginBottom: 2,
          padding: 2,
          borderColor: theme => theme.palette[renewalStatus.severity].main
        }}
        role="region"
        aria-label="Lease Renewal Notice"
      >
        <Box display="flex" flexDirection="column" gap={2}>
          <Typography
            variant="h6"
            component="h2"
            color={renewalStatus.severity}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <span aria-hidden="true">{renewalStatus.icon}</span>
            Lease Renewal Notice
          </Typography>

          <Typography variant="body1">
            {renewalStatus.message}
          </Typography>

          {lease.renewal.proposedTerms && (
            <Box sx={{ marginTop: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Proposed Terms:
              </Typography>
              <Typography variant="body2">
                • Duration: {lease.renewal.proposedTerms.duration} months
              </Typography>
              <Typography variant="body2">
                • Monthly Rent: ${lease.renewal.proposedTerms.monthlyRent.toLocaleString()}
              </Typography>
              {lease.renewal.proposedTerms.escalationRate && (
                <Typography variant="body2">
                  • Annual Escalation: {lease.renewal.proposedTerms.escalationRate}%
                </Typography>
              )}
            </Box>
          )}

          <Button
            variant="contained"
            color="primary"
            onClick={handleRenewalAction}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
            aria-busy={loading}
            sx={{ alignSelf: 'flex-start', marginTop: 2 }}
          >
            {loading ? 'Processing...' : 'Review Renewal'}
          </Button>
        </Box>
      </Card>

      {error && (
        <Notification
          message={error}
          severity="error"
          open={notificationOpen}
          onClose={() => setNotificationOpen(false)}
        />
      )}
    </>
  );
};

export default LeaseRenewalNotice;