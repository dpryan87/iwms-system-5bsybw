/**
 * @fileoverview Core date utility module for IWMS application
 * Provides comprehensive date manipulation, formatting, and validation functions
 * with timezone support for lease management and occupancy tracking features.
 * @version 1.0.0
 */

// External imports with versions
import { 
  format, 
  isValid, 
  parseISO, 
  differenceInDays, 
  addDays, 
  isBefore, 
  isAfter 
} from 'date-fns'; // ^2.30.0

import { 
  zonedTimeToUtc, 
  utcToZonedTime 
} from 'date-fns-tz'; // ^2.0.0

/**
 * Memoization decorator for caching function results
 * @param target - Target function
 * @param context - Decorator context
 */
function memoize(target: any, context: DecoratorContext) {
  const cache = new Map();
  
  return function(...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = target.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Formats a date string or Date object into a specified format with timezone support
 * @param date - Date to format
 * @param formatString - Desired output format
 * @param timezone - Optional timezone (e.g., 'America/New_York')
 * @returns Formatted date string
 */
export const formatDate = memoize(function(
  date: Date | string,
  formatString: string,
  timezone?: string
): string {
  try {
    // Parse string dates to Date objects
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      return '';
    }

    // Convert to specified timezone if provided
    const zonedDate = timezone 
      ? utcToZonedTime(dateObj, timezone)
      : dateObj;

    return format(zonedDate, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
});

/**
 * Calculates number of days between current date and target date with timezone consideration
 * @param targetDate - Target date for calculation
 * @param timezone - Optional timezone (e.g., 'America/New_York')
 * @returns Number of days until target date (negative for past dates)
 */
export function calculateDaysUntil(
  targetDate: Date | string,
  timezone?: string
): number {
  try {
    const dateObj = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate;
    
    if (!isValid(dateObj)) {
      throw new Error('Invalid target date');
    }

    const now = new Date();
    
    // Convert both dates to UTC or specified timezone
    const targetUtc = timezone ? zonedTimeToUtc(dateObj, timezone) : dateObj;
    const nowUtc = timezone ? zonedTimeToUtc(now, timezone) : now;

    return differenceInDays(targetUtc, nowUtc);
  } catch (error) {
    console.error('Error calculating days until:', error);
    return 0;
  }
}

/**
 * Validates if a date falls within a specified range with timezone support
 * @param date - Date to check
 * @param startDate - Start of range
 * @param endDate - End of range
 * @param timezone - Optional timezone (e.g., 'America/New_York')
 * @returns True if date is within range, false otherwise
 */
export function isDateInRange(
  date: Date | string,
  startDate: Date | string,
  endDate: Date | string,
  timezone?: string
): boolean {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const startObj = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const endObj = typeof endDate === 'string' ? parseISO(endDate) : endDate;

    if (!isValid(dateObj) || !isValid(startObj) || !isValid(endObj)) {
      return false;
    }

    // Convert all dates to UTC or specified timezone
    const dateUtc = timezone ? zonedTimeToUtc(dateObj, timezone) : dateObj;
    const startUtc = timezone ? zonedTimeToUtc(startObj, timezone) : startObj;
    const endUtc = timezone ? zonedTimeToUtc(endObj, timezone) : endObj;

    return !isBefore(dateUtc, startUtc) && !isAfter(dateUtc, endUtc);
  } catch (error) {
    console.error('Error checking date range:', error);
    return false;
  }
}

/**
 * Converts UTC date to specified timezone with validation
 * @param date - Date to convert
 * @param timezone - Target timezone (e.g., 'America/New_York')
 * @returns Date object in specified timezone
 */
export function convertToLocalTime(
  date: Date | string,
  timezone: string
): Date {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      throw new Error('Invalid date');
    }

    if (!timezone) {
      throw new Error('Timezone is required');
    }

    return utcToZonedTime(dateObj, timezone);
  } catch (error) {
    console.error('Error converting to local time:', error);
    return new Date();
  }
}

/**
 * Generates array of dates between start and end date with timezone support
 * @param startDate - Start of range
 * @param endDate - End of range
 * @param timezone - Optional timezone (e.g., 'America/New_York')
 * @returns Array of dates within the specified range
 */
export const getDateRangeArray = memoize(function(
  startDate: Date | string,
  endDate: Date | string,
  timezone?: string
): Date[] {
  try {
    const startObj = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const endObj = typeof endDate === 'string' ? parseISO(endDate) : endDate;

    if (!isValid(startObj) || !isValid(endObj)) {
      throw new Error('Invalid date range');
    }

    const dates: Date[] = [];
    let currentDate = startObj;

    // Convert dates to UTC or specified timezone
    const endUtc = timezone ? zonedTimeToUtc(endObj, timezone) : endObj;

    while (!isAfter(currentDate, endUtc)) {
      const dateToAdd = timezone 
        ? utcToZonedTime(currentDate, timezone)
        : currentDate;
      dates.push(dateToAdd);
      currentDate = addDays(currentDate, 1);
    }

    return dates;
  } catch (error) {
    console.error('Error generating date range:', error);
    return [];
  }
});