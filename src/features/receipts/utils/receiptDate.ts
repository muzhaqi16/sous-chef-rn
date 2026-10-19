import { isWithinInterval, subDays } from 'date-fns';
import { dayAsInstant, fromDateKey } from '#/utils/dateUtils';

// US receipts print the month first, `09/30/26 14:22` or `9/30/2026`; most
// others the day first, `30/09/2026`; a few print ISO.
const SLASH_DATE = /(?<!\d)(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})(?!\d)/;
const ISO_DATE = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/;

/** Whether a line prints a date in either form the day is read from. */
export const holdsDate = (line: string): boolean =>
  SLASH_DATE.test(line) || ISO_DATE.test(line);

/** The earliest shop day the API takes; an earlier one is a ValidationError. */
export const EARLIEST_RECEIPT_DAY = '2000-01-01';

/** Older than this is a misread, not the day of the shop. */
const OLDEST_DAYS = 366;

/**
 * Whether `key` (YYYY-MM-DD) can be the day of a shop scanned on `today`: in
 * the past year. A later day (a "return by" date) and an older one are misreads.
 */
export function isPlausibleReceiptDay(key: string, today: string): boolean {
  const latest = fromDateKey(today);
  return isWithinInterval(fromDateKey(key), {
    start: subDays(latest, OLDEST_DAYS),
    end: latest,
  });
}

const PRINTED_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A read time of the sale (HH:MM, 24-hour), or nothing for a misread. */
export const printedTimeOf = (
  value: string | null | undefined,
): string | undefined =>
  value && PRINTED_TIME.test(value) ? value : undefined;

/**
 * The moment of a shop, as a check-in sends it: the receipt's printed time on
 * its day in the phone's own zone, noon when none was read. The API dates every
 * line by it and refuses one that falls on the day in no time zone.
 */
export function purchaseMomentOf(
  dayKey: string,
  time: string | undefined,
): string {
  const day = fromDateKey(dayKey);
  const [, hours, minutes] = PRINTED_TIME.exec(time ?? '') ?? [];
  if (!hours || !minutes) return dayAsInstant(day);
  day.setHours(Number(hours), Number(minutes));
  return day.toISOString();
}
