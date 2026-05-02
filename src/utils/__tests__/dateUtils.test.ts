import {
  extractDateString,
  dateStringToISO,
  safeParseDate,
  safeFormatDate,
} from '../dateUtils';

describe('extractDateString', () => {
  it('extracts from ISO string with timezone offset', () => {
    expect(extractDateString('1992-04-18T00:00:00.000+00:00')).toBe(
      '1992-04-18',
    );
  });

  it('extracts from ISO string with Z', () => {
    expect(extractDateString('2024-12-25T10:30:00.000Z')).toBe('2024-12-25');
  });

  it('returns YYYY-MM-DD as-is', () => {
    expect(extractDateString('2024-01-15')).toBe('2024-01-15');
  });

  it('extracts from Date object', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(extractDateString(date)).toBe('2024-01-15');
  });

  it('returns empty string for null', () => {
    expect(extractDateString(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(extractDateString(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(extractDateString('')).toBe('');
  });

  it('handles numeric Unix timestamp in seconds', () => {
    // 1705276800 = 2024-01-15T00:00:00Z
    const result = extractDateString(1705276800);
    expect(result).toBe('2024-01-15');
  });

  it('handles numeric Unix timestamp in milliseconds', () => {
    const result = extractDateString(1705276800000);
    expect(result).toBe('2024-01-15');
  });
});

describe('dateStringToISO', () => {
  it('converts YYYY-MM-DD to ISO string', () => {
    const result = dateStringToISO('2024-01-15');
    expect(result).toBe('2024-01-15T00:00:00.000Z');
  });

  it('returns empty string for empty input', () => {
    expect(dateStringToISO('')).toBe('');
  });

  it('returns input unchanged for invalid format', () => {
    expect(dateStringToISO('not-a-date')).toBe('not-a-date');
  });

  it('returns input unchanged for partial date format', () => {
    expect(dateStringToISO('2024-01')).toBe('2024-01');
  });
});

describe('safeParseDate', () => {
  it('returns null for null', () => {
    expect(safeParseDate(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(safeParseDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(safeParseDate('')).toBeNull();
  });

  it('parses valid ISO string', () => {
    const result = safeParseDate('2024-01-15T00:00:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('passes through valid Date object', () => {
    const date = new Date('2024-01-15');
    expect(safeParseDate(date)).toBe(date);
  });

  it('returns null for invalid Date object', () => {
    expect(safeParseDate(new Date('invalid'))).toBeNull();
  });

  it('handles Unix timestamp in seconds', () => {
    const result = safeParseDate(1705276800);
    expect(result).toBeInstanceOf(Date);
  });

  it('handles Unix timestamp in milliseconds', () => {
    const result = safeParseDate(1705276800000);
    expect(result).toBeInstanceOf(Date);
  });

  it('returns null for invalid string', () => {
    expect(safeParseDate('not-a-date')).toBeNull();
  });
});

describe('safeFormatDate', () => {
  it('formats valid date to ISO string', () => {
    const result = safeFormatDate('2024-01-15T00:00:00.000Z');
    expect(result).toBe('2024-01-15T00:00:00.000Z');
  });

  it('returns default fallback for invalid input', () => {
    expect(safeFormatDate(null)).toBe('Recently');
  });

  it('returns custom fallback for invalid input', () => {
    expect(safeFormatDate(null, 'Unknown')).toBe('Unknown');
  });
});
