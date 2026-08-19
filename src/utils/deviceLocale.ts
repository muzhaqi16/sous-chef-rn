/**
 * The *device's* locale conventions, as distinct from the app's interface
 * language.
 *
 * These are two independently settable things and they routinely disagree: an
 * English UI on a Spanish phone is an ordinary configuration. Which one is
 * correct depends entirely on the question being asked:
 *
 * - **Which separator can this person type?** The device. `keyboardType`
 *   renders the *device* locale's keypad, so a Spanish phone offers `,`
 *   whatever `i18n.language` says. See `parseDecimalInput`.
 * - **Which separator should a number be displayed with?** The device, so that
 *   what is shown matches what the keypad will accept when the value is edited.
 * - **Which language should words be in?** The interface language. See
 *   `getDateFnsLocale`, which is keyed off i18n on purpose.
 *
 * Everything here is derived from `Intl`, which Hermes backs with the platform's
 * own locale data (ICU on Android, Foundation on iOS). `Intl` is treated as
 * possibly-absent throughout — a build without it must degrade, not crash.
 */

/** The two decimal separators any locale the app can plausibly run under uses. */
export type DecimalSeparator = '.' | ',';

/**
 * Used when the platform gives us nothing to go on. `.` matches the JavaScript
 * number grammar, so a fallback value round-trips through `parseFloat` and
 * `Number()` unchanged, and it is the separator `en` — the app's `fallbackLng` —
 * uses anyway.
 */
const FALLBACK_SEPARATOR: DecimalSeparator = '.';
const FALLBACK_LOCALE = 'en-US';

// Resolving a locale walks the platform's locale database, which is not free and
// cannot change without an app restart on either platform. Compute once.
let cachedSeparator: DecimalSeparator | undefined;
let cachedLocale: string | undefined;

/**
 * The BCP 47 tag of the device's locale (`'es-ES'`, `'en-US'`, …).
 *
 * This is what `Intl` constructors already select when passed `undefined`, so
 * pass `undefined` rather than this value when all you need is the default —
 * this exists for the cases that need to name the locale, or log it.
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
 * The decimal separator the device's keypad offers, and therefore the only
 * separator some people can type at all.
 *
 * Derived by formatting a fractional number and reading back whatever is left
 * once the digits are removed, rather than via `formatToParts` — `format` is the
 * part of `Intl.NumberFormat` Hermes implements most consistently across
 * platforms, and this needs one character, not a parts breakdown.
 *
 * Falls back to `.` when `Intl` is unavailable or returns something that is
 * neither `.` nor `,`.
 */
export function getDeviceDecimalSeparator(): DecimalSeparator {
  if (cachedSeparator !== undefined) return cachedSeparator;

  let resolved: DecimalSeparator = FALLBACK_SEPARATOR;
  try {
    // 1.1 rather than 1.5 so no locale's rounding rules can turn this into an
    // integer with no separator at all.
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
 * Discards the memoized locale data. Exists for tests that need to observe more
 * than one device locale in a single process; nothing in the app should call it,
 * because the underlying values cannot change while the app is running.
 */
export function resetDeviceLocaleCache(): void {
  cachedSeparator = undefined;
  cachedLocale = undefined;
}
