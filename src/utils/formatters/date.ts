import { format } from 'date-fns';
import { getDateFnsLocale } from '#/utils/dateLocale';

/**
 * Display dates in the INTERFACE language. `format(date, 'MMM d')` with no
 * `locale` renders English whatever the app is set to — permanently, not as a
 * fallback. MACHINE keys (`'yyyy-MM-dd'`) belong nowhere near here.
 */
const display = (date: Date, pattern: string): string =>
  format(date, pattern, { locale: getDateFnsLocale() });

export const formatMonthDay = (date: Date): string => display(date, 'MMM d');

export const formatMonthDayYear = (date: Date): string =>
  display(date, 'MMM d, yyyy');

export const formatWeekdayMonthDay = (date: Date): string =>
  display(date, 'EEE, MMM d');

export const formatFullWeekdayMonthDay = (date: Date): string =>
  display(date, 'EEEE, MMMM d');

export const formatMonthYear = (date: Date): string =>
  display(date, 'MMMM yyyy');

export const formatWeekdayShort = (date: Date): string => display(date, 'EEE');

export const formatDayOfMonth = (date: Date): string => display(date, 'd');

export const formatDateTime = (date: Date): string =>
  display(date, 'MMM d, yyyy, h:mm a');

/** The locale's own short date: `11/4/2026` in en, `04/11/2026` in es. */
export const formatShortDate = (date: Date): string => display(date, 'P');

export const formatDateRange = (start: Date, end: Date): string =>
  `${formatMonthDay(start)} – ${formatMonthDay(end)}`;
