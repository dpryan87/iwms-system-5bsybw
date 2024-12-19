import { describe, it, expect, jest } from '@jest/globals';
import {
  formatDate,
  calculateDaysUntil,
  isDateInRange,
  convertToLocalTime,
  getDateRangeArray
} from '../../src/utils/date.utils';

// Mock timezone data for consistent testing
const TEST_TIMEZONES = {
  UTC: 'UTC',
  NY: 'America/New_York',
  LA: 'America/Los_Angeles',
  TOKYO: 'Asia/Tokyo'
};

describe('Date Utilities', () => {
  beforeEach(() => {
    // Set fixed system time for consistent testing
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('formatDate', () => {
    it('should format dates correctly across supported timezones', () => {
      const testDate = new Date('2024-01-01T15:30:00Z');
      
      expect(formatDate(testDate, 'yyyy-MM-dd HH:mm', TEST_TIMEZONES.UTC))
        .toBe('2024-01-01 15:30');
      
      expect(formatDate(testDate, 'yyyy-MM-dd HH:mm', TEST_TIMEZONES.NY))
        .toBe('2024-01-01 10:30');
      
      expect(formatDate(testDate, 'yyyy-MM-dd HH:mm', TEST_TIMEZONES.TOKYO))
        .toBe('2024-01-02 00:30');
    });

    it('should handle DST transitions without time gaps', () => {
      // Test date during DST transition
      const dstDate = new Date('2024-03-10T06:30:00Z'); // US DST start
      
      expect(formatDate(dstDate, 'yyyy-MM-dd HH:mm', TEST_TIMEZONES.NY))
        .toBe('2024-03-10 02:30');
      
      const postDstDate = new Date('2024-03-10T08:30:00Z');
      expect(formatDate(postDstDate, 'yyyy-MM-dd HH:mm', TEST_TIMEZONES.NY))
        .toBe('2024-03-10 04:30');
    });

    it('should maintain consistent output with memoized formats', () => {
      const testDate = new Date('2024-01-01T12:00:00Z');
      const format = 'yyyy-MM-dd HH:mm';
      
      // First call should cache the result
      const firstResult = formatDate(testDate, format, TEST_TIMEZONES.UTC);
      // Second call should use cached result
      const secondResult = formatDate(testDate, format, TEST_TIMEZONES.UTC);
      
      expect(firstResult).toBe(secondResult);
      expect(firstResult).toBe('2024-01-01 12:00');
    });

    it('should handle invalid inputs gracefully', () => {
      expect(formatDate('invalid-date', 'yyyy-MM-dd')).toBe('');
      expect(formatDate(new Date('invalid'), 'yyyy-MM-dd')).toBe('');
      expect(formatDate(new Date(), 'invalid-format')).toBe('');
    });
  });

  describe('calculateDaysUntil', () => {
    it('should calculate days accurately across timezone boundaries', () => {
      const futureDate = new Date('2024-01-10T00:00:00Z');
      
      expect(calculateDaysUntil(futureDate, TEST_TIMEZONES.UTC)).toBe(9);
      expect(calculateDaysUntil(futureDate, TEST_TIMEZONES.NY)).toBe(9);
      expect(calculateDaysUntil(futureDate, TEST_TIMEZONES.TOKYO)).toBe(9);
    });

    it('should handle DST transitions correctly in calculations', () => {
      const dstDate = new Date('2024-03-10T07:00:00Z'); // During DST transition
      
      expect(calculateDaysUntil(dstDate, TEST_TIMEZONES.NY)).toBe(69);
      expect(calculateDaysUntil(dstDate, TEST_TIMEZONES.UTC)).toBe(69);
    });

    it('should support both Date objects and ISO string inputs', () => {
      const dateStr = '2024-01-10T00:00:00Z';
      const dateObj = new Date(dateStr);
      
      expect(calculateDaysUntil(dateStr)).toBe(9);
      expect(calculateDaysUntil(dateObj)).toBe(9);
    });

    it('should calculate negative days for past dates accurately', () => {
      const pastDate = new Date('2023-12-25T00:00:00Z');
      
      expect(calculateDaysUntil(pastDate)).toBe(-7);
    });
  });

  describe('isDateInRange', () => {
    it('should validate ranges correctly with timezone consideration', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');
      const testDate = new Date('2024-01-15T12:00:00Z');
      
      expect(isDateInRange(testDate, startDate, endDate, TEST_TIMEZONES.UTC)).toBe(true);
      expect(isDateInRange(testDate, startDate, endDate, TEST_TIMEZONES.NY)).toBe(true);
      expect(isDateInRange(testDate, startDate, endDate, TEST_TIMEZONES.TOKYO)).toBe(true);
    });

    it('should handle inclusive/exclusive range boundaries properly', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');
      
      expect(isDateInRange(startDate, startDate, endDate)).toBe(true);
      expect(isDateInRange(endDate, startDate, endDate)).toBe(true);
    });

    it('should handle reversed date ranges', () => {
      const startDate = new Date('2024-01-31T23:59:59Z');
      const endDate = new Date('2024-01-01T00:00:00Z');
      const testDate = new Date('2024-01-15T12:00:00Z');
      
      expect(isDateInRange(testDate, startDate, endDate)).toBe(false);
    });

    it('should maintain accuracy during DST transitions', () => {
      const startDate = new Date('2024-03-09T00:00:00Z');
      const endDate = new Date('2024-03-11T00:00:00Z');
      const dstDate = new Date('2024-03-10T07:00:00Z');
      
      expect(isDateInRange(dstDate, startDate, endDate, TEST_TIMEZONES.NY)).toBe(true);
    });
  });

  describe('convertToLocalTime', () => {
    it('should convert between timezones accurately', () => {
      const utcDate = new Date('2024-01-01T12:00:00Z');
      
      const nyDate = convertToLocalTime(utcDate, TEST_TIMEZONES.NY);
      expect(nyDate.getHours()).toBe(7); // UTC-5
      
      const tokyoDate = convertToLocalTime(utcDate, TEST_TIMEZONES.TOKYO);
      expect(tokyoDate.getHours()).toBe(21); // UTC+9
    });

    it('should handle DST transitions without time gaps', () => {
      const dstDate = new Date('2024-03-10T06:30:00Z');
      const nyDate = convertToLocalTime(dstDate, TEST_TIMEZONES.NY);
      
      expect(nyDate.getHours()).toBe(2);
      expect(nyDate.getMinutes()).toBe(30);
    });

    it('should validate timezone formats strictly', () => {
      const testDate = new Date('2024-01-01T12:00:00Z');
      
      expect(() => convertToLocalTime(testDate, '')).toThrow();
      expect(() => convertToLocalTime(testDate, 'Invalid/Timezone')).toThrow();
    });

    it('should maintain millisecond precision in conversions', () => {
      const testDate = new Date('2024-01-01T12:00:00.123Z');
      const convertedDate = convertToLocalTime(testDate, TEST_TIMEZONES.NY);
      
      expect(convertedDate.getMilliseconds()).toBe(123);
    });
  });

  describe('getDateRangeArray', () => {
    it('should generate correct date arrays efficiently', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-05T00:00:00Z');
      
      const dateRange = getDateRangeArray(startDate, endDate);
      
      expect(dateRange.length).toBe(5);
      expect(dateRange[0].toISOString()).toBe(startDate.toISOString());
      expect(dateRange[4].toISOString()).toBe(endDate.toISOString());
    });

    it('should maintain chronological order with timezone changes', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-03T00:00:00Z');
      
      const dateRange = getDateRangeArray(startDate, endDate, TEST_TIMEZONES.NY);
      
      for (let i = 1; i < dateRange.length; i++) {
        expect(dateRange[i].getTime()).toBeGreaterThan(dateRange[i-1].getTime());
      }
    });

    it('should handle large ranges without performance issues', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-12-31T00:00:00Z');
      
      const dateRange = getDateRangeArray(startDate, endDate);
      
      expect(dateRange.length).toBe(366); // 2024 is a leap year
    });

    it('should utilize memoization for repeated ranges', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-05T00:00:00Z');
      
      const firstCall = getDateRangeArray(startDate, endDate);
      const secondCall = getDateRangeArray(startDate, endDate);
      
      expect(firstCall).toBe(secondCall); // Same reference due to memoization
    });
  });
});