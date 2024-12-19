import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Grid, MenuItem, CircularProgress, Alert } from '@mui/material';
import * as yup from 'yup';
import Form from '../common/Form';
import { useWebSocket, WebSocketConnectionState } from '../../hooks/useWebSocket';
import { SpaceType, SpaceResource } from '../../types/floor-plan.types';

// Resource form validation schema
const resourceValidationSchema = yup.object().shape({
  name: yup.string()
    .required('Resource name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters'),
  type: yup.string()
    .required('Resource type is required')
    .oneOf(Object.values(SpaceType), 'Invalid resource type'),
  status: yup.string()
    .required('Status is required')
    .oneOf(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RESERVED'], 'Invalid status'),
  capacity: yup.number()
    .required('Capacity is required')
    .min(1, 'Capacity must be at least 1')
    .max(1000, 'Capacity cannot exceed 1000'),
  position: yup.object().shape({
    x: yup.number().required('X coordinate is required'),
    y: yup.number().required('Y coordinate is required'),
    z: yup.number().nullable()
  }),
  assignedBusinessUnit: yup.string().nullable(),
  metadata: yup.object().default({})
});

// Resource form props interface
interface ResourceFormProps {
  initialValues?: Partial<SpaceResource>;
  onSubmit: (resource: SpaceResource) => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  mode: 'create' | 'edit';
  customFields?: Array<{
    name: string;
    label: string;
    type: string;
    required?: boolean;
  }>;
  onStatusChange?: (status: string) => void;
  rbacRules?: {
    canEdit: boolean;
    canDelete: boolean;
    canChangeStatus: boolean;
  };
  wsEndpoint?: string;
}

// Default form values
const defaultValues: Partial<SpaceResource> = {
  name: '',
  type: SpaceType.OTHER,
  status: 'AVAILABLE',
  capacity: 1,
  position: { x: 0, y: 0, z: null },
  assignedBusinessUnit: null,
  metadata: {}
};

/**
 * Enhanced resource management form component with real-time updates
 * and role-based access control
 */
const ResourceForm: React.FC<ResourceFormProps> = ({
  initialValues = defaultValues,
  onSubmit,
  loading = false,
  disabled = false,
  mode = 'create',
  customFields = [],
  onStatusChange,
  rbacRules = { canEdit: true, canDelete: true, canChangeStatus: true },
  wsEndpoint
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Initialize WebSocket connection for real-time updates
  const { state: wsState, metrics } = useWebSocket(wsEndpoint || '', {
    autoConnect: !!wsEndpoint,
    reconnectAttempts: 5,
    heartbeatInterval: 30000
  });

  // Generate form fields based on schema and custom fields
  const formFields = [
    {
      name: 'name',
      label: 'Resource Name',
      type: 'text',
      required: true,
      disabled: disabled || !rbacRules.canEdit
    },
    {
      name: 'type',
      label: 'Resource Type',
      type: 'select',
      required: true,
      disabled: disabled || !rbacRules.canEdit,
      options: Object.values(SpaceType).map(type => ({
        value: type,
        label: type.replace(/_/g, ' ')
      }))
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      disabled: disabled || !rbacRules.canChangeStatus,
      options: [
        { value: 'AVAILABLE', label: 'Available' },
        { value: 'IN_USE', label: 'In Use' },
        { value: 'MAINTENANCE', label: 'Maintenance' },
        { value: 'RESERVED', label: 'Reserved' }
      ]
    },
    {
      name: 'capacity',
      label: 'Capacity',
      type: 'number',
      required: true,
      disabled: disabled || !rbacRules.canEdit
    },
    {
      name: 'position.x',
      label: 'X Coordinate',
      type: 'number',
      required: true,
      disabled: disabled || !rbacRules.canEdit
    },
    {
      name: 'position.y',
      label: 'Y Coordinate',
      type: 'number',
      required: true,
      disabled: disabled || !rbacRules.canEdit
    },
    {
      name: 'position.z',
      label: 'Z Coordinate',
      type: 'number',
      required: false,
      disabled: disabled || !rbacRules.canEdit
    },
    {
      name: 'assignedBusinessUnit',
      label: 'Business Unit',
      type: 'text',
      required: false,
      disabled: disabled || !rbacRules.canEdit
    },
    ...customFields
  ];

  // Handle real-time updates
  useEffect(() => {
    if (wsState.connectionState === WebSocketConnectionState.CONNECTED) {
      setLastUpdate(new Date());
    }
  }, [wsState.connectionState]);

  // Handle form submission with validation
  const handleSubmit = useCallback(async (values: Partial<SpaceResource>) => {
    try {
      setFormError(null);
      const validatedValues = await resourceValidationSchema.validate(values, { abortEarly: false });
      await onSubmit(validatedValues as SpaceResource);
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        setFormError(error.errors[0]);
      } else {
        setFormError('An unexpected error occurred');
        console.error('Form submission error:', error);
      }
    }
  }, [onSubmit]);

  // Handle status changes with notifications
  const handleStatusChange = useCallback((value: string) => {
    if (onStatusChange && rbacRules.canChangeStatus) {
      onStatusChange(value);
    }
  }, [onStatusChange, rbacRules.canChangeStatus]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        {formError && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            onClose={() => setFormError(null)}
          >
            {formError}
          </Alert>
        )}

        {wsState.connectionState === WebSocketConnectionState.CONNECTED && (
          <Alert 
            severity="info" 
            sx={{ mb: 2 }}
          >
            Real-time updates active
            {lastUpdate && ` (Last update: ${lastUpdate.toLocaleTimeString()})`}
          </Alert>
        )}

        <Form
          ref={formRef}
          fields={formFields}
          initialValues={initialValues}
          validationSchema={resourceValidationSchema}
          onSubmit={handleSubmit}
          loading={loading}
          disabled={disabled}
          submitButtonText={mode === 'create' ? 'Create Resource' : 'Update Resource'}
          resetButtonText="Reset Form"
          customValidation={async (field, value) => {
            if (field === 'status') {
              handleStatusChange(value as string);
            }
            return null;
          }}
        />
      </Grid>

      {metrics && (
        <Grid item xs={12}>
          <Alert severity="info" sx={{ mt: 2 }}>
            Connection metrics: 
            Latency: {metrics.latency}ms | 
            Messages: {metrics.messageCount} | 
            Uptime: {Math.round(metrics.uptime / 1000)}s
          </Alert>
        </Grid>
      )}
    </Grid>
  );
};

export default ResourceForm;