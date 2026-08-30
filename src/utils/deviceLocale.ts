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
const FALLBACK_LOCALE = 'en-US';

// Resolving a locale walks the platform's locale database and cannot change
// without an app restart, so compute once.
let cachedSeparator: DecimalSeparator | undefined;
let cachedLocale: string | undefined;

/**
 * The device's BCP 47 tag. `Intl` constructors already select it for
 * `undefined`, so pass that instead unless the tag itself is needed.
 */
export function getDeviceLocale(): string {
  if (cachedLocale !== undefined) return cachedLocale;

  let resolved = FALLBACK_LOCALE;
  try {
    resolved = new Intl.NumberFormat().resolvedOptions().locale || resolved;
  } catch {
    // Left at the fallback.
  }

  cachedLocale = resolved;
  return resolved;
}

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

/**
 * Test-only: the underlying values cannot change while the app runs, so nothing
 * in the app should call this.
 */
export function resetDeviceLocaleCache(): void {
  cachedSeparator = undefined;
  cachedLocale = undefined;
}
