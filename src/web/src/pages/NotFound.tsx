import React, { useCallback, useEffect } from 'react';
import { Box, Typography } from '@mui/material'; // @version ^5.0.0
import { useNavigate } from 'react-router-dom'; // @version ^6.0.0
import { useTranslation } from 'react-i18next'; // @version ^12.0.0

// Internal imports
import MainLayout from '../layouts/MainLayout';
import Button from '../components/common/Button';

/**
 * Enterprise-grade 404 Not Found page component that provides a user-friendly error message,
 * comprehensive error tracking, and accessible navigation options.
 * 
 * @returns {JSX.Element} Rendered NotFound page component
 */
const NotFound: React.FC = () => {
  // Hooks
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Track 404 errors for monitoring
  useEffect(() => {
    // Log 404 error occurrence
    console.error('404 Error:', {
      path: window.location.pathname,
      timestamp: new Date().toISOString(),
      referrer: document.referrer,
      userAgent: navigator.userAgent
    });
  }, []);

  /**
   * Handles navigation back to dashboard with error tracking
   * @param {React.MouseEvent | React.KeyboardEvent} event - Click or keyboard event
   */
  const handleNavigateHome = useCallback((
    event: React.MouseEvent | React.KeyboardEvent
  ) => {
    event.preventDefault();
    
    // Log navigation attempt
    console.info('404 Recovery:', {
      action: 'navigate_home',
      timestamp: new Date().toISOString()
    });

    navigate('/');
  }, [navigate]);

  return (
    <MainLayout 
      title={t('error.notFound.title', 'Page Not Found')}
      showBreadcrumbs={false}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          padding: theme => theme.spacing(3)
        }}
      >
        {/* Error Status */}
        <Typography
          variant="h1"
          component="h1"
          sx={{
            fontSize: {
              xs: '4rem',
              sm: '6rem',
              md: '8rem'
            },
            color: 'primary.main',
            marginBottom: 2,
            fontWeight: 700
          }}
          aria-label={t('error.notFound.status', '404 Error')}
        >
          404
        </Typography>

        {/* Main Error Message */}
        <Typography
          variant="h4"
          component="h2"
          sx={{
            marginBottom: 3,
            color: 'text.primary',
            fontWeight: 500
          }}
          aria-label={t('error.notFound.heading', 'Page Not Found')}
        >
          {t('error.notFound.heading', 'Page Not Found')}
        </Typography>

        {/* Detailed Error Description */}
        <Typography
          variant="body1"
          sx={{
            marginBottom: 4,
            color: 'text.secondary',
            maxWidth: '600px'
          }}
        >
          {t(
            'error.notFound.message',
            'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.'
          )}
        </Typography>

        {/* Navigation Button */}
        <Button
          variant="contained"
          color="primary"
          onClick={handleNavigateHome}
          aria-label={t('error.notFound.action', 'Return to Dashboard')}
          startIcon={<HomeIcon />}
          size="large"
          sx={{ minWidth: 200 }}
        >
          {t('error.notFound.action', 'Return to Dashboard')}
        </Button>

        {/* Additional Help Text */}
        <Typography
          variant="body2"
          sx={{
            marginTop: 4,
            color: 'text.secondary'
          }}
        >
          {t(
            'error.notFound.help',
            'If you believe this is an error, please contact support.'
          )}
        </Typography>
      </Box>
    </MainLayout>
  );
};

export default NotFound;