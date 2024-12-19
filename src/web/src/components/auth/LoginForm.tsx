import React, { useState, useEffect } from 'react';
import { 
  TextField, 
  Card, 
  IconButton, 
  CircularProgress 
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff 
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as yup from 'yup';

// Internal imports
import { useAuth } from '../../hooks/useAuth';
import { LoginCredentials } from '../../types/auth.types';
import Button from '../common/Button';

// Constants
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Validation schema with enhanced security requirements
const validationSchema = yup.object({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required')
    .max(255, 'Email must not exceed 255 characters'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  mfaCode: yup
    .string()
    .when('mfaRequired', {
      is: true,
      then: yup.string().required('MFA code is required').length(6, 'MFA code must be 6 digits'),
      otherwise: yup.string()
    })
});

interface LoginFormProps {
  onSuccess: (user: any) => void;
  onError: (error: Error) => void;
  onMFARequired?: (sessionToken: string) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ 
  onSuccess, 
  onError, 
  onMFARequired 
}) => {
  // State management
  const [showPassword, setShowPassword] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>('');

  // Auth hook
  const { login, state, verifyMfa } = useAuth();

  // Form management with Formik
  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
      mfaCode: '',
      mfaRequired: false
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        // Check for account lockout
        if (lockoutTime && Date.now() < lockoutTime) {
          const remainingTime = Math.ceil((lockoutTime - Date.now()) / 1000 / 60);
          onError(new Error(`Account temporarily locked. Please try again in ${remainingTime} minutes.`));
          return;
        }

        // Prepare credentials with device info
        const credentials: LoginCredentials = {
          email: values.email,
          password: values.password,
          deviceId: await generateDeviceFingerprint(),
          userAgent: navigator.userAgent
        };

        if (mfaRequired && values.mfaCode) {
          // Handle MFA verification
          await verifyMfa(values.mfaCode, {
            method: 'APP',
            deviceTrust: true,
            rememberDevice: true
          });
          setMfaRequired(false);
          onSuccess(state.user);
        } else {
          // Initial login attempt
          const response = await login(credentials);
          
          if (response.requiresMfa) {
            setMfaRequired(true);
            setSessionToken(response.sessionToken);
            onMFARequired?.(response.sessionToken);
          } else {
            onSuccess(response.user);
          }

          // Reset attempt count on successful login
          setAttemptCount(0);
          setLockoutTime(null);
        }
      } catch (error) {
        // Handle failed login attempt
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);

        if (newAttemptCount >= MAX_ATTEMPTS) {
          const lockoutEndTime = Date.now() + LOCKOUT_DURATION;
          setLockoutTime(lockoutEndTime);
          onError(new Error('Too many failed attempts. Account temporarily locked.'));
        } else {
          onError(error as Error);
        }
      }
    }
  });

  // Generate device fingerprint for security
  const generateDeviceFingerprint = async (): Promise<string> => {
    const deviceData = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(deviceData));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  return (
    <Card
      component="form"
      onSubmit={formik.handleSubmit}
      sx={{ p: 3, maxWidth: 400, width: '100%' }}
      role="form"
      aria-label="Login form"
    >
      <TextField
        fullWidth
        id="email"
        name="email"
        label="Email"
        type="email"
        margin="normal"
        value={formik.values.email}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={formik.touched.email && Boolean(formik.errors.email)}
        helperText={formik.touched.email && formik.errors.email}
        disabled={state.loading || Boolean(lockoutTime)}
        inputProps={{
          'aria-label': 'Email address',
          'aria-required': 'true',
          'aria-invalid': formik.touched.email && Boolean(formik.errors.email),
          'aria-describedby': formik.errors.email ? 'email-error' : undefined
        }}
      />

      <TextField
        fullWidth
        id="password"
        name="password"
        label="Password"
        type={showPassword ? 'text' : 'password'}
        margin="normal"
        value={formik.values.password}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={formik.touched.password && Boolean(formik.errors.password)}
        helperText={formik.touched.password && formik.errors.password}
        disabled={state.loading || Boolean(lockoutTime)}
        InputProps={{
          endAdornment: (
            <IconButton
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(!showPassword)}
              edge="end"
              size="large"
            >
              {showPassword ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          )
        }}
        inputProps={{
          'aria-label': 'Password',
          'aria-required': 'true',
          'aria-invalid': formik.touched.password && Boolean(formik.errors.password),
          'aria-describedby': formik.errors.password ? 'password-error' : undefined
        }}
      />

      {mfaRequired && (
        <TextField
          fullWidth
          id="mfaCode"
          name="mfaCode"
          label="MFA Code"
          type="text"
          margin="normal"
          value={formik.values.mfaCode}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.mfaCode && Boolean(formik.errors.mfaCode)}
          helperText={formik.touched.mfaCode && formik.errors.mfaCode}
          disabled={state.loading}
          inputProps={{
            'aria-label': 'MFA verification code',
            'aria-required': 'true',
            'aria-invalid': formik.touched.mfaCode && Boolean(formik.errors.mfaCode),
            'aria-describedby': formik.errors.mfaCode ? 'mfa-error' : undefined,
            maxLength: 6,
            pattern: '[0-9]*'
          }}
        />
      )}

      <Button
        fullWidth
        type="submit"
        variant="contained"
        color="primary"
        size="large"
        loading={state.loading}
        disabled={!formik.isValid || !formik.dirty || Boolean(lockoutTime)}
        sx={{ mt: 3 }}
        aria-label={mfaRequired ? 'Verify MFA code' : 'Sign in'}
      >
        {mfaRequired ? 'Verify MFA Code' : 'Sign In'}
      </Button>

      {/* Accessibility announcement for screen readers */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {state.error && `Error: ${state.error}`}
        {lockoutTime && `Account locked. Please try again later.`}
      </div>
    </Card>
  );
};

export default LoginForm;