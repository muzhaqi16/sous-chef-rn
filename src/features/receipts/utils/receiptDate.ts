import { isValid } from 'date-fns';
import { fromDateKey, toDateKey } from '#/utils/dateUtils';

// US receipts print the month first, `09/30/26 14:22` or `9/30/2026`; a few
// print ISO. Either way the parts are read as year, month and day.
const DATE_FORMS: readonly [RegExp, (parts: string[]) => number[]][] = [
  [
    /(?<!\d)(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})(?!\d)/g,
    ([month = '', day = '', year = '']) => [
      year.length === 2 ? 2000 + Number(year) : Number(year),
      Number(month),
      Number(day),
    ],
  ],
  [
    /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g,
    ([year = '', month = '', day = '']) => [
      Number(year),
      Number(month),
      Number(day),
    ],
  ],
];

/** Older than this is a misread, not the day of the shop. */
const OLDEST_DAYS = 366;

const keyOf = (year = 0, month = 0, day = 0): string | null => {
  const date = new Date(year, month - 1, day);
  // `new Date` rolls 02/30 over into March; a real day maps back to itself.
  const real =
    isValid(date) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  return real ? toDateKey(date) : null;
};

/**
 * The day a receipt was printed, as YYYY-MM-DD: the first date in reading
 * order that falls in the past year. A later one (a "return by" date) and an
 * implausibly old one are skipped; none found is null.
 */
export function readReceiptDate(
  pages: readonly string[],
  today: string,
): string | null {
  const latest = fromDateKey(today);
  const earliest = new Date(latest);
  earliest.setDate(earliest.getDate() - OLDEST_DAYS);

  for (const page of pages) {
    const found = DATE_FORMS.flatMap(([pattern, toParts]) =>
      [...page.matchAll(pattern)].map(match => ({
        at: match.index,
        key: keyOf(...toParts(match.slice(1))),
      })),
    ).sort((a, b) => a.at - b.at);

    for (const { key } of found) {
      if (!key) continue;
      const day = fromDateKey(key);
      if (day <= latest && day >= earliest) return key;
    }
  }
  return null;
}
