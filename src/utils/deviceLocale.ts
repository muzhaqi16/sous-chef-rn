/**
 * The DEVICE's locale conventions, routinely different from the interface
 * language. Separators follow the device — `keyboardType` renders the DEVICE
 * locale's keypad — while words follow i18n (`getDateFnsLocale`). Derived from
 * `Intl`, treated as possibly-absent: a build without it must degrade.
 */

/** The two decimal separators any locale the app can plausibly run under uses. */
export type DecimalSeparator = '.' | ',';

/**
 * `.` matches the JS number grammar, so a fallback round-trips through
 * `parseFloat` unchanged, and it is what `en` (the `fallbackLng`) uses anyway.
 */
const FALLBACK_SEPARATOR: DecimalSeparator = '.';

// Resolving a locale walks the platform's locale database and cannot change
// without an app restart, so compute once.
let cachedSeparator: DecimalSeparator | undefined;

/**
 * The separator the device's keypad offers, and so the only one some people can
 * type. Read back from `format` with the digits stripped rather than via
 * `formatToParts`: `format` is the part of `Intl.NumberFormat` Hermes implements
 * most consistently. Falls back to `.`.
 */
export function getDeviceDecimalSeparator(): DecimalSeparator {
  if (cachedSeparator !== undefined) return cachedSeparator;

  let resolved: DecimalSeparator = FALLBACK_SEPARATOR;
  try {
    // 1.1, not 1.5: no locale's rounding can turn it into a separator-less int.
    const formatted = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      useGrouping: false,
    }).format(1.1);
    const separator = formatted.replace(/\d/g, '');
    if (separator === '.' || separator === ',') {
      resolved = separator;
    }
  } catch {
    // Left at the fallback.
  }

  cachedSeparator = resolved;
  return resolved;
}

/** Which part a device's slash date (`05/09/2026`) puts first. */
export type DateOrder = 'monthFirst' | 'dayFirst';

let cachedDateOrder: DateOrder | undefined;

/**
 * The order the device's region writes day and month in, read back from
 * `format`, as {@link getDeviceDecimalSeparator} is, rather than via
 * `formatToParts`. Falls back to month-first, the US order.
 */
export function getDeviceDateOrder(): DateOrder {
  if (cachedDateOrder !== undefined) return cachedDateOrder;

  let resolved: DateOrder = 'monthFirst';
  try {
    // February 3rd: the month prints as 02 and the day as 03 in every locale
    // with Latin digits; any other script leaves the fallback.
    const formatted = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(2001, 1, 3));
    const month = formatted.indexOf('02');
    const day = formatted.indexOf('03');
    if (month >= 0 && day >= 0 && day < month) resolved = 'dayFirst';
  } catch {
    // Left at the fallback.
  }

  cachedDateOrder = resolved;
  return resolved;
}

/** The device's locale (`en-US`), or null when neither source can say. */
export function getDeviceLocale(): string | null {
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language;
    }
    return Intl.DateTimeFormat().resolvedOptions().locale || null;
  } catch {
    return null;
  }
}

/**
 * Test-only: the underlying values cannot change while the app runs, so nothing
 * in the app should call this.
 * @internal Test seam.
 */
export function resetDeviceLocaleCache(): void {
  cachedSeparator = undefined;
  cachedDateOrder = undefined;
}
