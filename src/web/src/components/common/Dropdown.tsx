import React from 'react'; // @version ^18.0.0
import { 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  SelectProps,
  FormHelperText
} from '@mui/material'; // @version ^5.0.0
import { styled } from '@mui/material/styles'; // @version ^5.0.0
import { Theme } from '../../styles/theme';

// Interface for dropdown options with accessibility properties
interface DropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  ariaLabel?: string;
}

// Props interface extending Material-UI SelectProps with custom properties
interface DropdownProps extends Omit<SelectProps, 'onChange'> {
  options: DropdownOption[];
  label: string;
  value: string | string[] | number | number[];
  onChange: (value: string | string[] | number | number[]) => void;
  multiple?: boolean;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

// Styled Select component with theme integration and accessibility enhancements
const StyledSelect = styled(Select)<SelectProps>(({ theme, error, size }) => ({
  '& .MuiSelect-select': {
    padding: size === 'small' 
      ? theme.spacing(1, 1.5) 
      : theme.spacing(1.5, 2),
    minHeight: 'auto',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: error 
      ? theme.palette.error.main 
      : theme.palette.divider,
    borderRadius: theme.spacing(1),
    transition: theme.transitions.create(['border-color', 'box-shadow']),
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: error 
      ? theme.palette.error.main 
      : theme.palette.primary.main,
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: error 
      ? theme.palette.error.main 
      : theme.palette.primary.main,
    borderWidth: 2,
    boxShadow: `0 0 0 2px ${
      error 
        ? theme.palette.error.main + '1A'
        : theme.palette.primary.main + '1A'
    }`,
  },
  '&.Mui-disabled': {
    backgroundColor: theme.palette.action.disabledBackground,
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.action.disabled,
    },
  },
  '@media (max-width: 600px)': {
    '& .MuiSelect-select': {
      padding: size === 'small' 
        ? theme.spacing(0.75, 1.25) 
        : theme.spacing(1.25, 1.75),
    },
  },
}));

// Main Dropdown component with forwarded ref
const Dropdown = React.forwardRef<HTMLDivElement, DropdownProps>((
  {
    options,
    label,
    value,
    onChange,
    multiple = false,
    error = false,
    helperText,
    required = false,
    disabled = false,
    fullWidth = true,
    size = 'medium',
    ariaLabel,
    ariaDescribedBy,
    ...rest
  },
  ref
) => {
  // Generate unique IDs for accessibility
  const labelId = React.useId();
  const helperId = React.useId();

  // Handle change events with type safety
  const handleChange = (event: any) => {
    const newValue = event.target.value;
    onChange(newValue);
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (event.target as HTMLElement).click();
    }
  };

  return (
    <FormControl
      ref={ref}
      error={error}
      required={required}
      disabled={disabled}
      fullWidth={fullWidth}
      size={size}
    >
      <InputLabel
        id={labelId}
        error={error}
        required={required}
      >
        {label}
      </InputLabel>
      
      <StyledSelect
        labelId={labelId}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        multiple={multiple}
        error={error}
        label={label}
        size={size}
        aria-label={ariaLabel || label}
        aria-describedby={ariaDescribedBy || (helperText ? helperId : undefined)}
        {...rest}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            aria-label={option.ariaLabel || option.label}
          >
            {option.label}
          </MenuItem>
        ))}
      </StyledSelect>

      {helperText && (
        <FormHelperText
          id={helperId}
          error={error}
        >
          {helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
});

// Display name for debugging
Dropdown.displayName = 'Dropdown';

export default Dropdown;