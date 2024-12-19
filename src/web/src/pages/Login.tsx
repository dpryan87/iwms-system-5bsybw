import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import { useSnackbar } from 'notistack'; // ^3.0.0
import { Box, Typography } from '@mui/material'; // ^5.0.0

// Internal imports
import LoginForm from '../components/auth/LoginForm';
import AuthLayout from '../layouts/AuthLayout';
import { useAuth } from '../hooks/useAuth';
import { AuthErrorType, AuthenticationError } from '../types/auth.types';
import { ERROR_MESSAGES } from '../constants/error.constants';

/**
 * Login Page Component
 * Implements secure authentication with SSO integration, MFA support,
 * and comprehensive security features while maintaining WCAG 2.1 Level AA compliance.
 */
const Login: React.FC = () => {
  // Hooks
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { login, state, verifyMfa } = useAuth();
  
  // Local state
  const [isMfaRequired, setIsMfaRequired] = useState<boolean>(false);
  const [sessionToken, setSessionToken] = useState<string>('');

  // Security monitoring
  useEffect(() => {
    // Redirect if already authenticated
    if (state.isAuthenticated) {
      navigate('/dashboard');
    }

    // Clear any sensitive data on unmount
    return () => {
      setSessionToken('');
    };
  }, [state.isAuthenticated, navigate]);

  /**
   * Handles successful login with enhanced security checks
   * @param user - Authenticated user data
   * @param authResponse - Authentication response data
   */
  const handleLoginSuccess = useCallback(async (user: any, authResponse: any) => {
    try {
      // Log successful authentication for security monitoring
      console.info('[Security] Successful authentication:', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        deviceInfo: navigator.userAgent
      });

      // Show success notification
      enqueueSnackbar('Successfully logged in', { 
        variant: 'success',
        autoHideDuration: 3000
      });

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('[Security] Post-login error:', error);
      handleLoginError(new AuthenticationError(
        AuthErrorType.INTERNAL_ERROR,
        ERROR_MESSAGES.INTERNAL_ERROR
      ));
    }
  }, [navigate, enqueueSnackbar]);

  /**
   * Handles login errors with enhanced security logging
   * @param error - Authentication error
   */
  const handleLoginError = useCallback((error: AuthenticationError) => {
    // Log security event
    console.error('[Security] Authentication failed:', {
      timestamp: new Date().toISOString(),
      errorType: error.type,
      message: error.message,
      deviceInfo: navigator.userAgent
    });

    // Show appropriate error message
    enqueueSnackbar(error.message, {
      variant: 'error',
      autoHideDuration: 5000
    });
  }, [enqueueSnackbar]);

  /**
   * Handles MFA verification process
   * @param challenge - MFA challenge data
   */
  const handleMFAChallenge = useCallback(async (challenge: any) => {
    try {
      setIsMfaRequired(true);
      setSessionToken(challenge.sessionToken);

      // Log MFA initiation for security monitoring
      console.info('[Security] MFA verification initiated:', {
        timestamp: new Date().toISOString(),
        deviceInfo: navigator.userAgent
      });
    } catch (error) {
      handleLoginError(new AuthenticationError(
        AuthErrorType.MFA_REQUIRED,
        ERROR_MESSAGES.AUTH_ERROR
      ));
    }
  }, []);

  return (
    <AuthLayout>
      <Box
        component="main"
        role="main"
        aria-label="Login page"
        sx={{
          width: '100%',
          maxWidth: 400,
          mx: 'auto',
          p: 3
        }}
      >
        <Typography
          component="h1"
          variant="h4"
          align="center"
          gutterBottom
          sx={{ mb: 4 }}
        >
          Sign In
        </Typography>

        <LoginForm
          onSuccess={handleLoginSuccess}
          onError={handleLoginError}
          onMFARequired={handleMFAChallenge}
        />

        {/* Accessibility announcement for screen readers */}
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {state.error && `Error: ${state.error}`}
          {isMfaRequired && 'Multi-factor authentication is required'}
        </div>
      </Box>
    </AuthLayout>
  );
};

export default Login;