import { differenceInCalendarDays } from 'date-fns';
import type { Translate } from '#/i18n/types';
import { fromDateKey } from '#/utils/dateUtils';

/** Calendar days from today to an `expiresOn` date: 0 is today, negative is past. */
export const daysUntilExpiry = (expiresOn: string, now = new Date()): number =>
  differenceInCalendarDays(fromDateKey(expiresOn), now);

/** The one phrase for each expiry state, shared by every surface that shows it. */
export const expiryLabel = (days: number, t: Translate): string => {
  if (days < 0) return t('labels.expiredDaysAgo', { count: -days });
  if (days === 0) return t('labels.expiresToday');
  if (days === 1) return t('labels.expiresTomorrow');
  return t('labels.expiresInDays', { count: days });
};
