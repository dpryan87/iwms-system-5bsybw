/**
 * @fileoverview Advanced utility functions for formatting data with internationalization support
 * @version 1.0.0
 * @license MIT
 */

import { memoize } from 'lodash';
import numeral from 'numeral'; // v2.0.6
import { DATE_TIME_FORMATS } from '../constants/app.constants';

/**
 * Options for currency formatting
 */
interface CurrencyFormatOptions {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  isRTL?: boolean;
}

/**
 * Options for percentage formatting
 */
interface PercentageFormatOptions {
  locale?: string;
  allowDecimal?: boolean;
  isRTL?: boolean;
}

/**
 * Options for file size formatting
 */
interface FileSizeFormatOptions {
  locale?: string;
  precision?: number;
  useIEC?: boolean; // Use binary (IEC) or decimal (SI) units
}

/**
 * Options for phone number formatting
 */
interface PhoneNumberFormatOptions {
  formatExtension?: boolean;
  includeCountryCode?: boolean;
}

/**
 * Options for text truncation
 */
interface TruncateOptions {
  suffix?: string;
  preserveWords?: boolean;
  isRTL?: boolean;
}

/**
 * Formats a number as currency with internationalization support
 * @param amount - The amount to format
 * @param currencyCode - ISO 4217 currency code
 * @param options - Formatting options
 * @returns Formatted currency string with proper symbol placement and ARIA attributes
 */
export const formatCurrency = memoize((
  amount: number,
  currencyCode: string,
  options: CurrencyFormatOptions = {}
): string => {
  if (!amount && amount !== 0) {
    return '';
  }

  const {
    locale = 'en-US',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    isRTL = false
  } = options;

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits,
      maximumFractionDigits
    });

    const formattedAmount = formatter.format(amount);
    const ariaLabel = `${amount} ${currencyCode}`;

    return `<span aria-label="${ariaLabel}" dir="${isRTL ? 'rtl' : 'ltr'}">${formattedAmount}</span>`;
  } catch (error) {
    console.error('Currency formatting error:', error);
    return `${amount} ${currencyCode}`;
  }
}, (amount, currencyCode, options) => 
  `${amount}-${currencyCode}-${JSON.stringify(options)}`);

/**
 * Formats a decimal number as a percentage
 * @param value - Number to format (0-1 or 0-100)
 * @param decimalPlaces - Number of decimal places
 * @param options - Formatting options
 * @returns Formatted percentage string with proper localization
 */
export const formatPercentage = memoize((
  value: number,
  decimalPlaces: number = 0,
  options: PercentageFormatOptions = {}
): string => {
  if (value === null || value === undefined) {
    return '';
  }

  const { locale = 'en-US', allowDecimal = true, isRTL = false } = options;

  // Normalize value to 0-1 range
  const normalizedValue = value > 1 ? value / 100 : value;

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: allowDecimal ? decimalPlaces : 0,
      maximumFractionDigits: allowDecimal ? decimalPlaces : 0
    });

    const formattedValue = formatter.format(normalizedValue);
    return `<span dir="${isRTL ? 'rtl' : 'ltr'}">${formattedValue}</span>`;
  } catch (error) {
    console.error('Percentage formatting error:', error);
    return `${(normalizedValue * 100).toFixed(decimalPlaces)}%`;
  }
}, (value, decimalPlaces, options) => 
  `${value}-${decimalPlaces}-${JSON.stringify(options)}`);

/**
 * Formats file size with intelligent unit selection
 * @param bytes - Size in bytes
 * @param options - Formatting options
 * @returns Human-readable file size with proper units
 */
export const formatFileSize = memoize((
  bytes: number,
  options: FileSizeFormatOptions = {}
): string => {
  if (!bytes && bytes !== 0) {
    return '';
  }

  const {
    locale = 'en-US',
    precision = 2,
    useIEC = true
  } = options;

  const base = useIEC ? 1024 : 1000;
  const units = useIEC 
    ? ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    : ['B', 'KB', 'MB', 'GB', 'TB'];

  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(base)),
    units.length - 1
  );

  const value = bytes / Math.pow(base, exponent);
  const unit = units[exponent];

  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0
  });

  const formattedValue = formatter.format(value);
  const ariaLabel = `${formattedValue} ${unit}`;

  return `<span aria-label="${ariaLabel}">${formattedValue} ${unit}</span>`;
}, (bytes, options) => 
  `${bytes}-${JSON.stringify(options)}`);

/**
 * Formats phone numbers with international support
 * @param phoneNumber - Raw phone number string
 * @param countryCode - ISO country code
 * @param options - Formatting options
 * @returns Formatted phone number with proper regional format
 */
export const formatPhoneNumber = memoize((
  phoneNumber: string,
  countryCode: string,
  options: PhoneNumberFormatOptions = {}
): string => {
  if (!phoneNumber) {
    return '';
  }

  const {
    formatExtension = true,
    includeCountryCode = true
  } = options;

  // Strip non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Split number and extension
  const [number, extension] = cleaned.split('x');

  try {
    // Format the main number
    const formatter = new Intl.NumberFormat(countryCode, {
      style: 'decimal'
    });

    let formatted = formatter.format(Number(number));

    // Add country code if requested
    if (includeCountryCode) {
      formatted = `+${countryCode} ${formatted}`;
    }

    // Add extension if present and requested
    if (extension && formatExtension) {
      formatted += ` ext. ${extension}`;
    }

    return `<span aria-label="phone number">${formatted}</span>`;
  } catch (error) {
    console.error('Phone number formatting error:', error);
    return phoneNumber;
  }
}, (phoneNumber, countryCode, options) => 
  `${phoneNumber}-${countryCode}-${JSON.stringify(options)}`);

/**
 * Truncates text with HTML entity preservation
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @param options - Truncation options
 * @returns Truncated text with preserved formatting
 */
export const truncateText = memoize((
  text: string,
  maxLength: number,
  options: TruncateOptions = {}
): string => {
  if (!text || maxLength <= 0) {
    return '';
  }

  const {
    suffix = '...',
    preserveWords = true,
    isRTL = false
  } = options;

  if (text.length <= maxLength) {
    return text;
  }

  let truncated = text.slice(0, maxLength - suffix.length);

  if (preserveWords) {
    // Find the last complete word
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncated = truncated.slice(0, lastSpace);
    }
  }

  // Preserve HTML entities
  truncated = truncated.replace(/&[^;]+;/g, (entity) => {
    return entity.match(/;$/) ? entity : entity + ';';
  });

  const result = `${truncated}${suffix}`;
  return `<span dir="${isRTL ? 'rtl' : 'ltr'}" title="${text}">${result}</span>`;
}, (text, maxLength, options) => 
  `${text}-${maxLength}-${JSON.stringify(options)}`);

// Export all formatting functions
export default {
  formatCurrency,
  formatPercentage,
  formatFileSize,
  formatPhoneNumber,
  truncateText
};