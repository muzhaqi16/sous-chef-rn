import { parseISO, isValid, format } from 'date-fns';

const MAX_REASONABLE_TIMESTAMP_MS = 4102444800000; // year 2100

/**
 * Safely parse any date-like input (Date, ISO string, or Unix timestamp).
 * Returns null when the value can't be parsed.
 */
export const safeParseDate = (value: unknown): Date | null => {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  if (typeof value === 'number') {
    if (value <= 0 || value >= MAX_REASONABLE_TIMESTAMP_MS) return null;
    const ms = value < 1e10 ? value * 1000 : value;
    const date = new Date(ms);
    return isValid(date) ? date : null;
  }

  if (typeof value === 'string') {
    const date = parseISO(value);
    return isValid(date) ? date : null;
  }

  return null;
};

/**
 * Extract YYYY-MM-DD from any date-like value.
 * ISO strings have their date prefix sliced verbatim (timezone-safe).
 */
export const extractDateString = (value: unknown): string => {
  if (value == null || value === '') return '';

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const date = safeParseDate(value);
  if (!date) return '';

  // Date instances format in local time; numeric timestamps stay UTC to
  // match the original behavior (callers don't expect their seconds-since-epoch
  // values to shift by a day depending on device timezone).
  return value instanceof Date
    ? format(date, 'yyyy-MM-dd')
    : date.toISOString().slice(0, 10);
};

/** Convert YYYY-MM-DD to a UTC midnight ISO string. Pass-through for malformed input. */
export const dateStringToISO = (dateStr: string): string => {
  if (!dateStr) return dateStr;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return `${dateStr}T00:00:00.000Z`;
};

/** Format a date-like value to an ISO string, with fallback. */
export const safeFormatDate = (
  value: unknown,
  fallback = 'Recently',
): string => {
  const date = safeParseDate(value);
  return date ? date.toISOString() : fallback;
};
