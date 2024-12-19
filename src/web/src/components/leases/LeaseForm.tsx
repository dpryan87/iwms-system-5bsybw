import React, { useState, useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { 
  Grid, 
  Typography, 
  Alert, 
  CircularProgress, 
  Snackbar,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  InputAdornment,
  Divider,
  Paper
} from '@mui/material'; // ^5.0.0
import { format, isValid, isFuture } from 'date-fns'; // ^2.30.0
import * as yup from 'yup'; // ^1.2.0

// Internal imports
import { Form } from '../common/Form';
import { 
  ILease, 
  LeaseStatus, 
  EscalationType, 
  ILeaseTerms,
  IFinancialTerms 
} from '../../types/lease.types';
import LeaseService from '../../services/lease.service';

// Validation schema for lease form
const leaseValidationSchema = yup.object().shape({
  propertyId: yup.string().required('Property is required').uuid('Invalid property ID'),
  tenantId: yup.string().required('Tenant is required').uuid('Invalid tenant ID'),
  startDate: yup.date()
    .required('Start date is required')
    .min(new Date(), 'Start date must be in the future'),
  endDate: yup.date()
    .required('End date is required')
    .min(yup.ref('startDate'), 'End date must be after start date'),
  monthlyRent: yup.number()
    .required('Monthly rent is required')
    .positive('Monthly rent must be positive')
    .max(1000000, 'Monthly rent cannot exceed 1,000,000'),
  terms: yup.object().shape({
    securityDeposit: yup.number()
      .required('Security deposit is required')
      .positive('Security deposit must be positive')
      .max(yup.ref('monthlyRent').multiply(3), 'Security deposit cannot exceed 3 months rent'),
    escalationType: yup.string()
      .oneOf(Object.values(EscalationType), 'Invalid escalation type')
      .required('Escalation type is required'),
    escalationRate: yup.number()
      .when('escalationType', {
        is: (type: string) => type !== EscalationType.NONE,
        then: yup.number()
          .required('Escalation rate is required')
          .min(0, 'Escalation rate must be positive')
          .max(100, 'Escalation rate cannot exceed 100%')
      }),
    includesUtilities: yup.boolean(),
    utilityDetails: yup.object().when('includesUtilities', {
      is: true,
      then: yup.object().shape({
        includedUtilities: yup.array().of(yup.string()).min(1, 'At least one utility must be selected'),
        estimatedMonthlyCost: yup.number().positive('Estimated cost must be positive')
      })
    })
  })
});

interface LeaseFormProps {
  initialData?: Partial<ILease>;
  onSubmit: (lease: ILease) => Promise<void>;
  onCancel: () => void;
  propertyOptions: Array<{ id: string; name: string }>;
  tenantOptions: Array<{ id: string; name: string }>;
}

const LeaseForm: React.FC<LeaseFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  propertyOptions,
  tenantOptions
}) => {
  // Form state management
  const [formData, setFormData] = useState<Partial<ILease>>(initialData || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form with default values
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        status: initialData.status || LeaseStatus.DRAFT,
        startDate: initialData.startDate || new Date(),
        documents: initialData.documents || []
      });
    }
  }, [initialData]);

  // Handle financial validation
  const validateFinancials = useCallback(async (financialTerms: IFinancialTerms) => {
    try {
      const isValid = await LeaseService.validateFinancials(financialTerms);
      if (!isValid) {
        throw new Error('Invalid financial terms');
      }
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Financial validation failed');
      return false;
    }
  }, []);

  // Handle document upload
  const handleDocumentUpload = useCallback(async (files: FileList) => {
    try {
      setLoading(true);
      const uploadPromises = Array.from(files).map(file => 
        LeaseService.uploadDocument(formData.id!, file)
      );
      const uploadedDocs = await Promise.all(uploadPromises);
      
      setFormData(prev => ({
        ...prev,
        documents: [...(prev.documents || []), ...uploadedDocs]
      }));
      
      setSuccessMessage('Documents uploaded successfully');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Document upload failed');
    } finally {
      setLoading(false);
    }
  }, [formData.id]);

  // Handle form submission
  const handleSubmit = async (values: Partial<ILease>) => {
    try {
      setLoading(true);
      setError(null);

      // Validate financials
      const financialsValid = await validateFinancials(values.financials!);
      if (!financialsValid) {
        return;
      }

      // Create or update lease
      const leaseData = values.id
        ? await LeaseService.updateExistingLease(values.id, values)
        : await LeaseService.createNewLease(values as Omit<ILease, 'id'>);

      setSuccessMessage('Lease saved successfully');
      await onSubmit(leaseData);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save lease');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Form
        fields={[
          {
            name: 'propertyId',
            label: 'Property',
            type: 'select',
            required: true,
            options: propertyOptions.map(p => ({ value: p.id, label: p.name }))
          },
          {
            name: 'tenantId',
            label: 'Tenant',
            type: 'select',
            required: true,
            options: tenantOptions.map(t => ({ value: t.id, label: t.name }))
          },
          {
            name: 'startDate',
            label: 'Start Date',
            type: 'date',
            required: true
          },
          {
            name: 'endDate',
            label: 'End Date',
            type: 'date',
            required: true
          },
          {
            name: 'monthlyRent',
            label: 'Monthly Rent',
            type: 'number',
            required: true,
            inputProps: {
              min: 0,
              step: 0.01
            }
          },
          {
            name: 'terms.securityDeposit',
            label: 'Security Deposit',
            type: 'number',
            required: true
          },
          {
            name: 'terms.escalationType',
            label: 'Escalation Type',
            type: 'select',
            required: true,
            options: Object.values(EscalationType).map(type => ({
              value: type,
              label: type.replace(/_/g, ' ')
            }))
          }
        ]}
        initialValues={formData}
        validationSchema={leaseValidationSchema}
        onSubmit={handleSubmit}
        submitButtonText={formData.id ? 'Update Lease' : 'Create Lease'}
        loading={loading}
        customValidation={validateFinancials}
      />

      {/* Document Upload Section */}
      <Divider sx={{ my: 3 }} />
      <Typography variant="h6" gutterBottom>
        Lease Documents
      </Typography>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        multiple
        accept=".pdf,.doc,.docx"
        onChange={(e) => e.target.files && handleDocumentUpload(e.target.files)}
      />

      {/* Error and Success Messages */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
      >
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default LeaseForm;