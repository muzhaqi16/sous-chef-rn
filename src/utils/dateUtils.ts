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
    if (match?.[1]) return match[1];
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

/**
 * A calendar day as the MACHINE key `2026-09-03` — a map key, a query variable,
 * an id. Deliberately not localized: it is compared and stored, never read, so
 * the locale-aware formatters must stay away from it. Local time, so the key
 * matches the day the user is looking at.
 */
export const toDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

/**
 * A picked calendar day as the instant a meal or plan boundary is sent at:
 * local noon, whose UTC day is the local day from UTC-11 to UTC+12. The API
 * compares meals to their plan by UTC day.
 */
export const toMealDateTime = (day: Date): string =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).toISOString();

/** A plan's stored boundary instants, as ISO strings. */
export interface PlanBounds {
  startDate: string;
  endDate: string;
}

/**
 * A meal instant pulled inside its plan's stored instants, as long as it stays
 * on the same local day. A plan stored before boundaries were sent at noon can
 * put its first or last local day on another UTC day than a noon meal.
 */
export const keepMealInsidePlan = (
  mealDate: string,
  bounds: PlanBounds | undefined,
): string => {
  const meal = new Date(mealDate);
  const start = bounds ? new Date(bounds.startDate).getTime() : NaN;
  const end = bounds ? new Date(bounds.endDate).getTime() : NaN;
  if ([meal.getTime(), start, end].some(Number.isNaN)) return mealDate;

  const clamped = new Date(Math.min(Math.max(meal.getTime(), start), end));
  return toDateKey(clamped) === toDateKey(meal)
    ? clamped.toISOString()
    : mealDate;
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
