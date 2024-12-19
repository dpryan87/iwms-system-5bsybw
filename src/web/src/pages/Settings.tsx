import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid,
  Typography,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Skeleton,
  Box
} from '@mui/material';
import * as yup from 'yup';

// Internal imports
import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/common/Card';
import Form from '../components/common/Form';
import { useAuth } from '../hooks/useAuth';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Settings tab configuration with validation schemas
const SETTINGS_TABS = [
  {
    id: 'userManagement',
    label: 'User Management',
    value: 0,
    schema: yup.object().shape({
      defaultRole: yup.string().required('Default role is required'),
      passwordPolicy: yup.object().shape({
        minLength: yup.number().min(8).required(),
        requireSpecialChar: yup.boolean(),
        requireNumbers: yup.boolean(),
        expiryDays: yup.number().min(0)
      }),
      mfaEnabled: yup.boolean()
    })
  },
  {
    id: 'notifications',
    label: 'Notifications',
    value: 1,
    schema: yup.object().shape({
      emailNotifications: yup.boolean(),
      pushNotifications: yup.boolean(),
      notificationTypes: yup.array().of(yup.string())
    })
  },
  {
    id: 'integrations',
    label: 'Integrations',
    value: 2,
    schema: yup.object().shape({
      bmsEndpoint: yup.string().url('Must be a valid URL'),
      hrSystem: yup.object().shape({
        enabled: yup.boolean(),
        syncInterval: yup.number().min(5)
      }),
      financialSystem: yup.object().shape({
        enabled: yup.boolean(),
        apiKey: yup.string().when('enabled', {
          is: true,
          then: yup.string().required('API Key required when enabled')
        })
      })
    })
  },
  {
    id: 'dataManagement',
    label: 'Data Management',
    value: 3,
    schema: yup.object().shape({
      retentionPeriod: yup.number().min(1).required(),
      backupEnabled: yup.boolean(),
      backupSchedule: yup.string().when('backupEnabled', {
        is: true,
        then: yup.string().required('Backup schedule required when enabled')
      })
    })
  }
];

// Interface for tab panel props
interface SettingsTabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
  loading?: boolean;
  error?: string | null;
}

// Tab panel component with loading and error states
const SettingsTabPanel: React.FC<SettingsTabPanelProps> = ({
  children,
  value,
  index,
  loading = false,
  error = null
}) => {
  const isVisible = value === index;

  if (!isVisible) return null;

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={200} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box
      role="tabpanel"
      hidden={!isVisible}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      sx={{ p: 3 }}
    >
      {children}
    </Box>
  );
};

// Main Settings component
const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  
  const { user, isAdmin } = useAuth();

  // Fetch initial settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        // API call would go here
        const mockSettings = {
          userManagement: {
            defaultRole: 'USER',
            passwordPolicy: {
              minLength: 8,
              requireSpecialChar: true,
              requireNumbers: true,
              expiryDays: 90
            },
            mfaEnabled: true
          },
          notifications: {
            emailNotifications: true,
            pushNotifications: false,
            notificationTypes: ['SYSTEM', 'SECURITY']
          },
          integrations: {
            bmsEndpoint: 'https://bms.example.com',
            hrSystem: {
              enabled: true,
              syncInterval: 15
            },
            financialSystem: {
              enabled: false,
              apiKey: ''
            }
          },
          dataManagement: {
            retentionPeriod: 365,
            backupEnabled: true,
            backupSchedule: 'DAILY'
          }
        };
        setSettings(mockSettings);
      } catch (err) {
        setError('Failed to load settings');
        console.error('Settings fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle settings submission
  const handleSettingsSubmit = async (values: Record<string, any>) => {
    try {
      setLoading(true);
      // API call would go here
      console.log('Updating settings:', values);
      setSettings(prevSettings => ({
        ...prevSettings,
        [SETTINGS_TABS[activeTab].id]: values
      }));
    } catch (err) {
      setError('Failed to update settings');
      console.error('Settings update error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Enforce admin access
  if (!isAdmin) {
    return (
      <DashboardLayout title="Settings">
        <Alert severity="error">
          You do not have permission to access system settings.
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <ErrorBoundary>
      <DashboardLayout 
        title="System Settings" 
        subtitle="Configure system-wide settings and preferences"
      >
        <Card elevated>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                aria-label="Settings tabs"
                variant="scrollable"
                scrollButtons="auto"
              >
                {SETTINGS_TABS.map(tab => (
                  <Tab
                    key={tab.id}
                    label={tab.label}
                    id={`settings-tab-${tab.value}`}
                    aria-controls={`settings-tabpanel-${tab.value}`}
                  />
                ))}
              </Tabs>
            </Grid>

            {SETTINGS_TABS.map((tab, index) => (
              <Grid item xs={12} key={tab.id}>
                <SettingsTabPanel
                  value={activeTab}
                  index={index}
                  loading={loading}
                  error={error}
                >
                  <Form
                    fields={[
                      // Fields would be dynamically generated based on tab
                      { name: 'example', label: 'Example Field', type: 'text' }
                    ]}
                    initialValues={settings[tab.id] || {}}
                    validationSchema={tab.schema}
                    onSubmit={handleSettingsSubmit}
                    submitButtonText="Save Changes"
                    loading={loading}
                  />
                </SettingsTabPanel>
              </Grid>
            ))}
          </Grid>
        </Card>
      </DashboardLayout>
    </ErrorBoundary>
  );
};

export default Settings;