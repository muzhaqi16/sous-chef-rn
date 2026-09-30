import { differenceInCalendarDays } from 'date-fns';
import type { Translate } from '#/i18n/types';
import { fromDateKey } from '#/utils/dateUtils';

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

/** The one phrase for each expiry state, shared by every surface that shows it. */
export const expiryLabel = (days: number, t: Translate): string => {
  if (days < 0) return t('labels.expiredDaysAgo', { count: -days });
  if (days === 0) return t('labels.expiresToday');
  if (days === 1) return t('labels.expiresTomorrow');
  return t('labels.expiresInDays', { count: days });
};
