import { isExists, isWithinInterval, subDays } from 'date-fns';
import { fromDateKey, toDateKey } from '#/utils/dateUtils';
import type { DateOrder } from '#/utils/deviceLocale';

// US receipts print the month first, `09/30/26 14:22` or `9/30/2026`; most
// others the day first, `30/09/2026`; a few print ISO.
const SLASH_DATE = /(?<!\d)(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})(?!\d)/g;
const ISO_DATE = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;

const fullYear = (year: string) =>
  year.length === 2 ? 2000 + Number(year) : Number(year);

/** Older than this is a misread, not the day of the shop. */
const OLDEST_DAYS = 366;

const keyOf = (year: number, month: number, day: number): string | null =>
  isExists(year, month - 1, day)
    ? toDateKey(new Date(year, month - 1, day))
    : null;

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

// A date only one order reads as a real day is read that way in any region
// (`30/09/26`); one both orders read is read in the device's.
const slashKey = (
  [first = '', second = '', year = '']: readonly string[],
  order: DateOrder,
) => {
  const monthFirst = keyOf(fullYear(year), Number(first), Number(second));
  const dayFirst = keyOf(fullYear(year), Number(second), Number(first));
  return order === 'monthFirst'
    ? monthFirst ?? dayFirst
    : dayFirst ?? monthFirst;
};

const isoKey = ([year = '', month = '', day = '']: readonly string[]) =>
  keyOf(Number(year), Number(month), Number(day));

/**
 * The day a receipt was printed, as YYYY-MM-DD: the first date in reading
 * order that falls in the past year, a slash date read in the device region's
 * `order`. A later one (a "return by" date) and an implausibly old one are
 * skipped; none found is null.
 */
export function readReceiptDate(
  pages: readonly string[],
  today: string,
  order: DateOrder,
): string | null {
  for (const page of pages) {
    const found = [
      ...[...page.matchAll(SLASH_DATE)].map(match => ({
        at: match.index,
        key: slashKey(match.slice(1), order),
      })),
      ...[...page.matchAll(ISO_DATE)].map(match => ({
        at: match.index,
        key: isoKey(match.slice(1)),
      })),
    ].sort((a, b) => a.at - b.at);

    for (const { key } of found) {
      if (key && isPlausibleReceiptDay(key, today)) return key;
    }
  }
  return null;
}
