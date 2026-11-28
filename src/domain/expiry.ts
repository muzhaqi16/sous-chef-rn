import { differenceInCalendarDays } from 'date-fns';
import type { Translate } from '#i18n/types';
import { ExpiryKind } from '#graphql/generated/schemaTypes';
import { fromDateKey } from '#utils/dateUtils';

/**
 * The server's expiring-soon window (`PantryStats.expiringCount`): dated today
 * through this many days on. The badge, the filter and the row all use it, so
 * none of them marks an item another does not count.
 */
export const EXPIRING_SOON_DAYS = 7;

/**
 * Calendar days from `today` to an `expiresOn` date: 0 is today, negative is
 * past. `today` is required: a compiled component that read the clock here
 * would keep the day it first rendered on — render paths pass `useToday()`.
 */
export const daysUntilExpiry = (expiresOn: string, today: string): number =>
  differenceInCalendarDays(fromDateKey(expiresOn), fromDateKey(today));

/**
 * How a date stands today. `check` is a long-life estimate whose date passed:
 * it is never expired, today or soon, as the API's counts never count it.
 */
export type ExpiryState = 'passed' | 'today' | 'soon' | 'later' | 'check';

export interface ExpiryReading {
  /** Calendar days from today: 0 is today, negative is past. */
  days: number;
  state: ExpiryState;
  /** A shelf-life guess, never the label's date. */
  estimate: boolean;
}

/**
 * A date `days` away, read by its kind. No kind (a date older than kinds, or a
 * reminder that names none) reads as stated, as the API counts it.
 */
export const expiryFromDays = (
  days: number,
  kind: ExpiryKind | null | undefined,
): ExpiryReading => {
  const estimate =
    kind === ExpiryKind.PerishableEstimate ||
    kind === ExpiryKind.LongLifeEstimate;
  if (kind === ExpiryKind.LongLifeEstimate) {
    return { days, estimate, state: days < 0 ? 'check' : 'later' };
  }
  const state: ExpiryState =
    days < 0
      ? 'passed'
      : days === 0
      ? 'today'
      : days <= EXPIRING_SOON_DAYS
      ? 'soon'
      : 'later';
  return { days, estimate, state };
};

/** The one reading of a stack's or package's date; null with no date. */
export const readExpiry = (
  expiresOn: string | null | undefined,
  kind: ExpiryKind | null | undefined,
  today: string,
): ExpiryReading | null =>
  expiresOn ? expiryFromDays(daysUntilExpiry(expiresOn, today), kind) : null;

/** What a date raises: danger once passed, a warning today and soon. */
export type ExpiryAlert = 'danger' | 'warning';

export const expiryAlert = (
  reading: ExpiryReading | null,
): ExpiryAlert | null => {
  const state = reading?.state;
  if (state === 'passed') return 'danger';
  return state === 'today' || state === 'soon' ? 'warning' : null;
};

const estimated = (reading: ExpiryReading, text: string, t: Translate) =>
  reading.estimate ? t('labels.expiryEstimate', { text }) : text;

/** The one phrase for a date, an estimate marked as one. */
export const expiryLabel = (reading: ExpiryReading, t: Translate): string => {
  const { days } = reading;
  if (reading.state === 'check') return t('labels.expiryDueCheck');
  const text =
    days < 0
      ? t('labels.expiredDaysAgo', { count: -days })
      : days === 0
      ? t('labels.expiresToday')
      : days === 1
      ? t('labels.expiresTomorrow')
      : t('labels.expiresInDays', { count: days });
  return estimated(reading, text, t);
};

/** When the date falls, for a heading that names the state; an estimate marked. */
export const expiryWhen = (reading: ExpiryReading, t: Translate): string => {
  const { days } = reading;
  const text =
    days < 0
      ? t('labels.daysAgo', { count: -days })
      : days === 0
      ? t('labels.today')
      : days === 1
      ? t('labels.tomorrow')
      : t('labels.durationDays', { count: days });
  return estimated(reading, text, t);
};

/** Earliest date first, an undated one last. */
export const compareExpiry = (
  a: string | null | undefined,
  b: string | null | undefined,
): number => {
  if (a === b || (!a && !b)) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : 1;
};
