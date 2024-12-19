/**
 * @fileoverview Lease management utility functions for IWMS application
 * Provides comprehensive lease calculations, validations, and formatting
 * with support for multi-currency, CPI-based escalations, and financial tracking
 * @version 1.0.0
 */

// External imports with versions
import { format } from 'date-fns'; // ^2.30.0
import { memoize } from 'lodash'; // ^4.17.21

// Internal imports
import { 
  ILease, 
  LeaseStatus, 
  ILeaseTerms, 
  ILeaseFinancials,
  EscalationSchedule
} from '../types/lease.types';
import { 
  formatDate, 
  calculateDaysUntil, 
  isDateInRange, 
  convertToLocalTime 
} from './date.utils';

// Constants
const DEFAULT_PRECISION = 2;
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'] as const;
const CACHE_TTL = 3600000; // 1 hour in milliseconds

// Types
type Currency = typeof SUPPORTED_CURRENCIES[number];

interface IEscalationResult {
  calculatedAmount: number;
  effectiveDate: Date;
  previousAmount: number;
  percentageIncrease: number;
  metadata: {
    calculationType: string;
    baseIndex?: number;
    currentIndex?: number;
    historicalData?: Array<{
      date: Date;
      amount: number;
    }>;
  };
}

interface IFormattedAmount {
  formatted: string;
  raw: number;
  currency: Currency;
  metadata: {
    locale: string;
    exchangeRate?: number;
    conversionDate?: Date;
  };
}

interface ICPIData {
  baseIndex: number;
  currentIndex: number;
  indexDate: Date;
  region: string;
}

interface IFormatOptions {
  locale?: string;
  showSymbol?: boolean;
  symbolPosition?: 'prefix' | 'suffix';
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Calculates lease escalation amount based on specified type and parameters
 * Supports fixed, percentage, and CPI-based calculations with historical tracking
 * 
 * @param currentAmount - Current lease amount
 * @param escalationType - Type of escalation (FIXED, PERCENTAGE, CPI)
 * @param escalationRate - Rate of escalation
 * @param cpiData - CPI data for CPI-based calculations
 * @param precision - Decimal precision for calculations
 * @returns Calculated escalation result with metadata
 */
export const calculateLeaseEscalation = memoize((
  currentAmount: number,
  escalationType: EscalationSchedule['type'],
  escalationRate: number,
  cpiData?: ICPIData,
  precision: number = DEFAULT_PRECISION
): IEscalationResult => {
  // Input validation
  if (currentAmount < 0 || escalationRate < 0) {
    throw new Error('Amount and escalation rate must be non-negative');
  }

  let calculatedAmount: number;
  const previousAmount = currentAmount;
  const effectiveDate = new Date();
  
  // Perform calculation based on escalation type
  switch (escalationType) {
    case 'FIXED':
      calculatedAmount = currentAmount + escalationRate;
      break;
      
    case 'PERCENTAGE':
      calculatedAmount = currentAmount * (1 + escalationRate / 100);
      break;
      
    case 'CPI':
      if (!cpiData) {
        throw new Error('CPI data required for CPI-based escalation');
      }
      const cpiRatio = cpiData.currentIndex / cpiData.baseIndex;
      calculatedAmount = currentAmount * cpiRatio;
      break;
      
    default:
      throw new Error('Invalid escalation type');
  }

  // Apply precision and rounding
  calculatedAmount = Number(calculatedAmount.toFixed(precision));
  
  // Calculate percentage increase
  const percentageIncrease = ((calculatedAmount - previousAmount) / previousAmount) * 100;

  return {
    calculatedAmount,
    effectiveDate,
    previousAmount,
    percentageIncrease,
    metadata: {
      calculationType: escalationType,
      baseIndex: cpiData?.baseIndex,
      currentIndex: cpiData?.currentIndex,
      historicalData: [{
        date: effectiveDate,
        amount: calculatedAmount
      }]
    }
  };
}, {
  maxAge: CACHE_TTL,
  primitive: true
});

/**
 * Formats lease amount with multi-currency support and localization
 * 
 * @param amount - Amount to format
 * @param currencyCode - ISO currency code
 * @param options - Formatting options
 * @returns Formatted amount with metadata
 */
export const formatLeaseAmount = memoize((
  amount: number,
  currencyCode: Currency,
  options: IFormatOptions = {}
): IFormattedAmount => {
  // Input validation
  if (amount < 0) {
    throw new Error('Amount must be non-negative');
  }
  
  if (!SUPPORTED_CURRENCIES.includes(currencyCode)) {
    throw new Error(`Unsupported currency: ${currencyCode}`);
  }

  const {
    locale = 'en-US',
    showSymbol = true,
    symbolPosition = 'prefix',
    minimumFractionDigits = DEFAULT_PRECISION,
    maximumFractionDigits = DEFAULT_PRECISION
  } = options;

  // Format using Intl.NumberFormat
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: showSymbol ? 'symbol' : 'code',
    minimumFractionDigits,
    maximumFractionDigits
  });

  let formatted = formatter.format(amount);

  // Handle symbol position if needed
  if (symbolPosition === 'suffix' && showSymbol) {
    const symbol = formatted.match(/[^\d.,\s]/)?.[0] || '';
    formatted = formatted.replace(symbol, '').trim() + ' ' + symbol;
  }

  return {
    formatted,
    raw: amount,
    currency: currencyCode,
    metadata: {
      locale,
      exchangeRate: 1, // Default exchange rate
      conversionDate: new Date()
    }
  };
}, {
  maxAge: CACHE_TTL,
  primitive: true
});

/**
 * Validates lease financial terms and calculates key metrics
 * 
 * @param lease - Lease object to validate
 * @returns Validation result with calculated metrics
 */
export const validateLeaseFinancials = (lease: ILease): boolean => {
  try {
    const { financials, terms, startDate, endDate } = lease;
    
    // Validate required financial fields
    if (!financials?.baseRent || !terms?.securityDeposit) {
      return false;
    }

    // Validate payment schedule
    const hasValidPayments = financials.paymentSchedule.every(payment => 
      payment.amount > 0 && 
      isDateInRange(payment.dueDate, startDate, endDate)
    );

    // Validate escalation schedule
    const hasValidEscalations = financials.escalationSchedule.every(escalation =>
      escalation.percentage >= 0 &&
      isDateInRange(escalation.effectiveDate, startDate, endDate)
    );

    return hasValidPayments && hasValidEscalations;
  } catch (error) {
    console.error('Error validating lease financials:', error);
    return false;
  }
};

/**
 * Calculates total lease cost including all fees and escalations
 * 
 * @param lease - Lease object
 * @returns Total cost calculation
 */
export const calculateTotalLeaseCost = memoize((lease: ILease): number => {
  try {
    const { financials } = lease;
    
    // Sum base rent for entire term
    const totalBaseRent = financials.baseRent * 
      calculateDaysUntil(lease.endDate, lease.startDate) / 30;

    // Add operating costs
    const totalOperatingCosts = financials.operatingCosts || 0;
    
    // Add utilities
    const totalUtilities = financials.utilities || 0;
    
    // Add insurance and taxes
    const totalInsurance = financials.insurance || 0;
    const totalTax = financials.propertyTax || 0;

    return Number((
      totalBaseRent + 
      totalOperatingCosts + 
      totalUtilities + 
      totalInsurance + 
      totalTax
    ).toFixed(DEFAULT_PRECISION));
  } catch (error) {
    console.error('Error calculating total lease cost:', error);
    return 0;
  }
}, {
  maxAge: CACHE_TTL,
  primitive: true
});