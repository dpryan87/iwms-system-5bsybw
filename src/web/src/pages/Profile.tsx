import React, { useState, useCallback, useEffect } from 'react';
import {
  Grid,
  Typography,
  Avatar,
  CircularProgress,
  Alert,
  Box,
  Divider,
  useTheme
} from '@mui/material'; // @version ^5.0.0
import * as yup from 'yup'; // @version ^1.2.0

// Internal imports
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/common/Card';
import Form from '../../components/common/Form';
import { validateEmail, sanitizeInput } from '../../utils/validation.utils';

// Profile validation schema with comprehensive rules
const profileValidationSchema = yup.object().shape({
  firstName: yup
    .string()
    .required('First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name cannot exceed 50 characters')
    .trim(),
  lastName: yup
    .string()
    .required('Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name cannot exceed 50 characters')
    .trim(),
  email: yup
    .string()
    .email('Invalid email format')
    .required('Email is required')
    .test('email-validation', 'Invalid email format', validateEmail),
  phone: yup
    .string()
    .matches(
      /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
      'Invalid phone number format'
    )
    .nullable(),
  preferredLanguage: yup
    .string()
    .oneOf(['en', 'es', 'fr'], 'Invalid language selection'),
  role: yup
    .string()
    .oneOf(['SYSTEM_ADMIN', 'FACILITY_MANAGER', 'SPACE_PLANNER', 'BU_ADMIN', 'TENANT_USER', 'READONLY_USER'])
    .required('Role is required')
});

/**
 * Profile page component with comprehensive user management features
 * Implements role-based access control and form validation
 */
const Profile: React.FC = () => {
  const theme = useTheme();
  const { state, refreshToken, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize form fields based on user data
  const formFields = [
    {
      name: 'firstName',
      label: 'First Name',
      type: 'text',
      required: true,
      autoComplete: 'given-name',
    },
    {
      name: 'lastName',
      label: 'Last Name',
      type: 'text',
      required: true,
      autoComplete: 'family-name',
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      autoComplete: 'email',
    },
    {
      name: 'phone',
      label: 'Phone Number',
      type: 'text',
      autoComplete: 'tel',
    },
    {
      name: 'preferredLanguage',
      label: 'Preferred Language',
      type: 'select',
      options: [
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Spanish' },
        { value: 'fr', label: 'French' },
      ],
    }
  ];

  // Handle profile update with optimistic updates and error recovery
  const handleProfileUpdate = useCallback(async (values: Record<string, any>) => {
    setLoading(true);
    setError(null);
    
    try {
      // Sanitize input values
      const sanitizedValues = {
        ...values,
        firstName: sanitizeInput(values.firstName),
        lastName: sanitizeInput(values.lastName),
      };

      // Validate user permissions
      if (!state.user?.permissions.includes('profile:update')) {
        throw new Error('Insufficient permissions to update profile');
      }

      // Perform optimistic update
      const previousData = { ...state.user };
      
      await updateProfile(sanitizedValues);
      await refreshToken(); // Refresh token to update user data

      setSuccessMessage('Profile updated successfully');
      setIsEditing(false);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update profile');
      console.error('Profile update failed:', error);
    } finally {
      setLoading(false);
    }
  }, [state.user, updateProfile, refreshToken]);

  // Reset messages when editing state changes
  useEffect(() => {
    setError(null);
    setSuccessMessage(null);
  }, [isEditing]);

  if (!state.user) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Grid container spacing={3} sx={{ p: theme.spacing(3) }}>
      {/* Profile Header */}
      <Grid item xs={12}>
        <Card elevated>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar
              src={state.user.avatar}
              alt={`${state.user.firstName} ${state.user.lastName}`}
              sx={{ width: 80, height: 80 }}
            />
            <Box>
              <Typography variant="h4" gutterBottom>
                {state.user.firstName} {state.user.lastName}
              </Typography>
              <Typography variant="body1" color="textSecondary">
                {state.user.role}
              </Typography>
            </Box>
          </Box>
        </Card>
      </Grid>

      {/* Profile Information */}
      <Grid item xs={12} md={8}>
        <Card>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5">Profile Information</Typography>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                aria-label="Edit profile"
                disabled={loading || !state.user?.permissions.includes('profile:update')}
              >
                Edit Profile
              </button>
            )}
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {successMessage}
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />

          {isEditing ? (
            <Form
              fields={formFields}
              initialValues={{
                firstName: state.user.firstName,
                lastName: state.user.lastName,
                email: state.user.email,
                phone: state.user.phone || '',
                preferredLanguage: state.user.preferredLanguage,
              }}
              validationSchema={profileValidationSchema}
              onSubmit={handleProfileUpdate}
              loading={loading}
              submitButtonText="Save Changes"
              resetButtonText="Cancel"
              onValidationError={(errors) => setError(Object.values(errors)[0])}
            />
          ) : (
            <Grid container spacing={2}>
              {formFields.map((field) => (
                <Grid item xs={12} sm={6} key={field.name}>
                  <Typography variant="subtitle2" color="textSecondary">
                    {field.label}
                  </Typography>
                  <Typography variant="body1">
                    {state.user[field.name as keyof typeof state.user] || '-'}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          )}
        </Card>
      </Grid>

      {/* Additional Information */}
      <Grid item xs={12} md={4}>
        <Card>
          <Typography variant="h6" gutterBottom>
            Account Information
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Box display="flex" flexDirection="column" gap={2}>
            <Box>
              <Typography variant="subtitle2" color="textSecondary">
                Last Login
              </Typography>
              <Typography variant="body1">
                {state.user.lastLogin?.toLocaleString() || '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="textSecondary">
                Account Status
              </Typography>
              <Typography variant="body1">
                {state.user.isActive ? 'Active' : 'Inactive'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="textSecondary">
                MFA Status
              </Typography>
              <Typography variant="body1">
                {state.user.isMfaEnabled ? 'Enabled' : 'Disabled'}
              </Typography>
            </Box>
          </Box>
        </Card>
      </Grid>
    </Grid>
  );
};

export default Profile;