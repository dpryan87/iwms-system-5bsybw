import React, { useState, useCallback, useEffect } from 'react'; // ^18.0.0
import { 
  TextField, 
  FormControl, 
  FormHelperText, 
  FormLabel,
  CircularProgress 
} from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import * as yup from 'yup'; // ^1.2.0
import Button from './Button';
import { validateEmail, validatePassword, sanitizeInput } from '../../utils/validation.utils';

// Enhanced styled form component with responsive layout and theme integration
const StyledForm = styled('form')(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(3),
  width: '100%',
  maxWidth: '800px',
  margin: '0 auto',
  padding: theme.spacing(2),

  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(2),
    padding: theme.spacing(1),
  },

  '& .MuiFormControl-root': {
    width: '100%',
  },

  '& .form-buttons': {
    display: 'flex',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
    justifyContent: 'flex-end',

    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
      '& > button': {
        width: '100%',
      },
    },
  },

  '& .error-message': {
    color: theme.palette.error.main,
    marginTop: theme.spacing(1),
  },
}));

// Type definitions for form props and fields
interface FormProps {
  fields: FormField[];
  initialValues: Record<string, any>;
  validationSchema: yup.ObjectSchema<any>;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  submitButtonText?: string;
  resetButtonText?: string;
  loading?: boolean;
  disabled?: boolean;
  customValidation?: (field: string, value: any) => Promise<string | null>;
  errorMessages?: Record<string, string>;
  onValidationError?: (errors: Record<string, string>) => void;
}

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'textarea' | 'select';
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  autoComplete?: string;
  validation?: yup.Schema;
  asyncValidation?: boolean;
  debounceMs?: number;
  mask?: string | RegExp;
  transformValue?: (value: any) => any;
}

// Main Form component with comprehensive validation and accessibility
const Form: React.FC<FormProps> = ({
  fields,
  initialValues,
  validationSchema,
  onSubmit,
  submitButtonText = 'Submit',
  resetButtonText = 'Reset',
  loading = false,
  disabled = false,
  customValidation,
  errorMessages = {},
  onValidationError,
}) => {
  // Form state management
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form to initial state
  const handleReset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  // Debounced field validation
  const validateField = useCallback(async (name: string, value: any) => {
    try {
      await validationSchema.validateAt(name, { [name]: value });
      
      // Additional validation for specific field types
      if (fields.find(f => f.name === name)?.type === 'email') {
        if (!validateEmail(value)) {
          throw new Error('Invalid email format');
        }
      }
      if (fields.find(f => f.name === name)?.type === 'password') {
        const { isValid, errors: pwdErrors } = validatePassword(value);
        if (!isValid) {
          throw new Error(pwdErrors[0]);
        }
      }

      // Custom validation if provided
      if (customValidation) {
        const customError = await customValidation(name, value);
        if (customError) {
          throw new Error(customError);
        }
      }

      setErrors(prev => ({ ...prev, [name]: '' }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      setErrors(prev => ({ ...prev, [name]: errorMessage }));
      onValidationError?.({ [name]: errorMessage });
    }
  }, [validationSchema, customValidation, fields, onValidationError]);

  // Handle field change with value transformation and validation
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const field = fields.find(f => f.name === name);
    
    let transformedValue = value;
    if (field?.transformValue) {
      transformedValue = field.transformValue(value);
    }
    
    // Apply input sanitization for text fields
    if (field?.type === 'text') {
      transformedValue = sanitizeInput(transformedValue);
    }

    setValues(prev => ({ ...prev, [name]: transformedValue }));
    
    if (touched[name]) {
      validateField(name, transformedValue);
    }
  }, [fields, touched, validateField]);

  // Handle field blur for validation
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    const { name } = event.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, values[name]);
  }, [values, validateField]);

  // Handle form submission with validation
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const validatedValues = await validationSchema.validate(values, { abortEarly: false });
      await onSubmit(validatedValues);
      handleReset();
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const validationErrors: Record<string, string> = {};
        error.inner.forEach(err => {
          if (err.path) {
            validationErrors[err.path] = err.message;
          }
        });
        setErrors(validationErrors);
        onValidationError?.(validationErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render form fields with accessibility attributes
  const renderField = (field: FormField) => (
    <FormControl
      key={field.name}
      fullWidth
      error={!!errors[field.name]}
      variant="outlined"
      margin="normal"
    >
      <FormLabel htmlFor={field.name} required={field.required}>
        {field.label}
      </FormLabel>
      <TextField
        id={field.name}
        name={field.name}
        type={field.type}
        value={values[field.name] || ''}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={field.placeholder}
        helperText={errors[field.name] || field.helperText}
        autoComplete={field.autoComplete}
        disabled={disabled || loading}
        inputProps={{
          'aria-label': field.label,
          'aria-describedby': `${field.name}-helper-text`,
          'aria-invalid': !!errors[field.name],
        }}
      />
      {errors[field.name] && (
        <FormHelperText id={`${field.name}-helper-text`} error>
          {errors[field.name]}
        </FormHelperText>
      )}
    </FormControl>
  );

  return (
    <StyledForm
      onSubmit={handleSubmit}
      noValidate
      aria-label="Form"
      role="form"
    >
      {fields.map(renderField)}
      
      <div className="form-buttons">
        <Button
          type="button"
          variant="outlined"
          onClick={handleReset}
          disabled={disabled || loading}
          aria-label={resetButtonText}
        >
          {resetButtonText}
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={disabled || loading || isSubmitting}
          loading={loading || isSubmitting}
          aria-label={submitButtonText}
        >
          {submitButtonText}
        </Button>
      </div>

      {Object.keys(errorMessages).length > 0 && (
        <div className="error-message" role="alert" aria-live="polite">
          {Object.values(errorMessages).map((message, index) => (
            <div key={index}>{message}</div>
          ))}
        </div>
      )}
    </StyledForm>
  );
};

export default Form;