import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parse,
  parseISO,
} from 'date-fns';

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

/** Today's key when called: for a write or a replay. Rendering reads `useToday`. */
export const todayKey = (): string => toDateKey(new Date());

/**
 * A `LocalDate` key back to that day's local midnight. `new Date('2026-09-21')`
 * reads the key as UTC midnight, which is the previous day west of UTC.
 */
export const fromDateKey = (key: string): Date =>
  parse(key, 'yyyy-MM-dd', new Date());

/** Whether a value from untyped data (a push payload) is a `LocalDate` key. */
export const isDateKey = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value);

/** A plan's first and last day, as `LocalDate` keys; both are days of the plan. */
export interface PlanBounds {
  startDate: string;
  endDate: string;
}

/**
 * A meal's day brought inside its plan: the API refuses a meal outside the
 * plan's days. Keys of one format order as their days do, so no `Date` is
 * built — one would read the key as UTC midnight.
 */
export const keepDayInsidePlan = (
  dayKey: string,
  bounds: PlanBounds | undefined,
): string => {
  if (!bounds) return dayKey;
  if (![dayKey, bounds.startDate, bounds.endDate].every(isDateKey)) {
    return dayKey;
  }
  if (dayKey < bounds.startDate) return bounds.startDate;
  return dayKey > bounds.endDate ? bounds.endDate : dayKey;
};

/** Whole days from one `LocalDate` key to another; negative when `to` is earlier. */
export const daysBetweenKeys = (from: string, to: string): number =>
  differenceInCalendarDays(fromDateKey(to), fromDateKey(from));

/** The `LocalDate` key `days` after `key`. */
export const addDaysToKey = (key: string, days: number): string =>
  toDateKey(addDays(fromDateKey(key), days));
