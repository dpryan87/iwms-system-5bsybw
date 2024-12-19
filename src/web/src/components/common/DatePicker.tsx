/**
 * @fileoverview Enterprise-grade date picker component with timezone support,
 * accessibility features, and integration with lease/occupancy systems.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'; // ^18.0.0
import { DatePicker as MuiDatePicker, LocalizationProvider } from '@mui/x-date-pickers'; // ^6.0.0
import { TextField } from '@mui/material'; // ^5.0.0
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'; // ^6.0.0
import {
  formatDate,
  calculateDaysUntil,
  isDateInRange,
  convertToLocalTime,
  validateTimezone
} from '../../utils/date.utils';
import { Theme } from '../../styles/theme';

/**
 * Props interface for the DatePicker component with comprehensive type definitions
 */
interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null, error?: string) => void;
  label: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  timezone?: string;
  format?: string;
  ariaLabel?: string;
}

/**
 * Enterprise-grade DatePicker component with timezone support and accessibility features
 */
const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  minDate,
  maxDate,
  disabled = false,
  error = false,
  helperText = '',
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  format = 'MM/dd/yyyy',
  ariaLabel
}) => {
  // State for internal date handling and validation
  const [internalDate, setInternalDate] = useState<Date | null>(value);
  const [validationError, setValidationError] = useState<string>('');

  // Memoized date format configuration
  const dateFormat = useMemo(() => ({
    format,
    timezone,
    mask: '__/__/____'
  }), [format, timezone]);

  /**
   * Validates date against min/max constraints and timezone
   */
  const validateDate = useCallback((date: Date | null): string => {
    if (!date) return '';

    try {
      // Convert date to specified timezone for validation
      const localDate = convertToLocalTime(date, timezone);

      if (minDate && isDateInRange(localDate, minDate, date, timezone)) {
        return `Date must be after ${formatDate(minDate, format, timezone)}`;
      }

      if (maxDate && isDateInRange(localDate, date, maxDate, timezone)) {
        return `Date must be before ${formatDate(maxDate, format, timezone)}`;
      }

      return '';
    } catch (error) {
      console.error('Date validation error:', error);
      return 'Invalid date selection';
    }
  }, [minDate, maxDate, timezone, format]);

  /**
   * Handles date change with validation and timezone conversion
   */
  const handleDateChange = useCallback((newDate: Date | null) => {
    try {
      // Validate new date selection
      const error = validateDate(newDate);
      setValidationError(error);

      // Convert to local timezone if valid
      const localDate = newDate && !error ? convertToLocalTime(newDate, timezone) : null;
      
      setInternalDate(localDate);
      onChange(localDate, error);
    } catch (error) {
      console.error('Error handling date change:', error);
      setValidationError('Invalid date format');
      onChange(null, 'Invalid date format');
    }
  }, [onChange, timezone, validateDate]);

  /**
   * Format display date with timezone consideration
   */
  const formatDisplayDate = useCallback((date: Date | null): string => {
    if (!date) return '';
    try {
      return formatDate(date, format, timezone);
    } catch (error) {
      console.error('Error formatting display date:', error);
      return '';
    }
  }, [format, timezone]);

  // Effect to sync internal date with external value
  useEffect(() => {
    if (value !== internalDate) {
      setInternalDate(value);
      setValidationError(validateDate(value));
    }
  }, [value, internalDate, validateDate]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <MuiDatePicker
        value={internalDate}
        onChange={handleDateChange}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            error={error || !!validationError}
            helperText={validationError || helperText}
            disabled={disabled}
            fullWidth
            inputProps={{
              ...params.inputProps,
              'aria-label': ariaLabel || label,
              'aria-invalid': error || !!validationError,
              'aria-describedby': validationError ? 'date-picker-error' : undefined
            }}
          />
        )}
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        inputFormat={dateFormat.format}
        mask={dateFormat.mask}
        OpenPickerButtonProps={{
          'aria-label': `Choose date, ${label}`,
        }}
        PaperProps={{
          elevation: 8,
          sx: {
            '& .MuiCalendarPicker-root': {
              width: '320px',
              height: '320px'
            }
          }
        }}
        sx={{
          '& .MuiInputBase-root': {
            borderRadius: 1
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: (theme: Theme) => 
              error || validationError 
                ? theme.palette.error.main 
                : theme.palette.divider
          }
        }}
      />
    </LocalizationProvider>
  );
};

export default DatePicker;