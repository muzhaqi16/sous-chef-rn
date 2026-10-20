/**
 * The DEVICE's locale conventions, routinely not the interface language's:
 * separators follow the device keypad, words follow i18n (`getDateFnsLocale`).
 * `Intl` may be absent, and a build without it must degrade.
 */

/** The two decimal separators any locale the app can plausibly run under uses. */
export type DecimalSeparator = '.' | ',';

/** `.` round-trips through `parseFloat`; `en`, the `fallbackLng`, uses it. */
const FALLBACK_SEPARATOR: DecimalSeparator = '.';

// Fixed until an app restart, so computed once.
let cachedSeparator: DecimalSeparator | undefined;

/**
 * The device keypad's separator, the only one some people can type. Read back
 * from `format`, not `formatToParts`: Hermes implements `format` most
 * consistently.
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
 * Test-only: the values cannot change while the app runs.
 * @internal Test seam.
 */
export function resetDeviceLocaleCache(): void {
  cachedSeparator = undefined;
}
