/**
 * The counterpart to `parseDecimalInput`: output must use the same conventions
 * input accepts, or a comma-decimal device prefills an edit field with a `.`
 * its keypad does not offer. Both follow the DEVICE, because the keypad does
 * (see `deviceLocale`). `Intl` is treated as possibly-absent throughout.
 */
import { getDeviceDecimalSeparator } from '../deviceLocale';

/**
 * For a text field `parseDecimalInput` will read back. Deliberately NOT `Intl`:
 * no grouping (half-typed grouped values re-parse badly) and no rounding, since
 * any fraction-digit choice truncates a value nobody asked to change — so saving
 * an unchanged edit sheet cannot alter the number. '' for nullish/non-finite.
 */
export function formatNumberForInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  const separator = getDeviceDecimalSeparator();
  return separator === '.'
    ? String(value)
    : String(value).replace('.', separator);
}

interface DecimalOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
}

// Building an Intl formatter parses locale data, so instances are cached by
// their options. A `null` entry records an option set Intl rejected, so the
// fallback is not reached through a throw on every call.
const decimalFormatters = new Map<string, Intl.NumberFormat | null>();

function getDecimalFormatter(
  options: DecimalOptions,
): Intl.NumberFormat | null {
  const key = JSON.stringify(options);
  const cached = decimalFormatters.get(key);
  if (cached !== undefined) return cached;

  let formatter: Intl.NumberFormat | null = null;
  try {
    formatter = new Intl.NumberFormat(undefined, options);
  } catch {
    formatter = null;
  }
  decimalFormatters.set(key, formatter);
  return formatter;
}

/**
 * Display formatting in the device's conventions. `minimumFractionDigits`
 * defaults to 0 so a whole number reads `3`, not `3.00`; pass both as 2 for money.
 */
export function formatDecimal(
  value: number | null | undefined,
  options: DecimalOptions = {},
): string {
  if (value == null || !Number.isFinite(value)) return '';

  const resolved: DecimalOptions = {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    ...(options.useGrouping === undefined
      ? {}
      : { useGrouping: options.useGrouping }),
  };

  const formatter = getDecimalFormatter(resolved);
  if (formatter) return formatter.format(value);

  // No Intl: round by hand and swap the separator, so the degraded output still
  // matches what the input side accepts.
  const fixed = value.toFixed(resolved.maximumFractionDigits ?? 2);
  const trimmed =
    (resolved.minimumFractionDigits ?? 0) > 0
      ? fixed
      : fixed.replace(/\.?0+$/, '');
  const separator = getDeviceDecimalSeparator();
  return separator === '.' ? trimmed : trimmed.replace('.', separator);
}

/**
 * Most money in the app carries no currency of its own — only a shopping list
 * has a `currency` field — and those amounts mean US dollars. One place to
 * change when the API exposes a per-user currency.
 */
export const DEFAULT_CURRENCY = 'USD';

const currencyFormatters = new Map<string, Intl.NumberFormat | null>();

function getCurrencyFormatter(currency: string): Intl.NumberFormat | null {
  const cached = currencyFormatters.get(currency);
  if (cached !== undefined) return cached;

  let formatter: Intl.NumberFormat | null = null;
  try {
    formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    });
  } catch {
    formatter = null;
  }
  currencyFormatters.set(currency, formatter);
  return formatter;
}

/**
 * What an amount nobody recorded reads as. The API withholds a money figure it
 * cannot state — no cost, or costs in two currencies — and a withheld figure is
 * not an amount of zero.
 */
export const UNKNOWN_AMOUNT = '—';

/**
 * Symbol PLACEMENT is the locale's and FRACTION DIGITS the currency's, so a
 * zero-decimal currency is never forced to two places. Degrades to
 * `CODE 1234.56`, then to a plain number. Absent is `UNKNOWN_AMOUNT`, never a
 * formatted zero — to omit the row instead, see `formatCostOrNull`.
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string | null | undefined,
  decimalPlaces?: number | null,
): string {
  if (value == null || !Number.isFinite(value)) return UNKNOWN_AMOUNT;

  // Only the no-Intl paths need this: with a currency Intl knows, Intl supplies
  // the minor unit itself. Two places is the fallback for a currency we were
  // told nothing about.
  const digits = decimalPlaces ?? 2;
  const money = {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  };

  if (!currency) return formatDecimal(value, money);

  const formatter = getCurrencyFormatter(currency);
  if (!formatter) return `${currency} ${formatDecimal(value, money)}`;
  return formatter.format(value);
}

/**
 * Rewrites example numbers in a hint: `e.g., 4.99` → `e.g., 4,99`. This CANNOT
 * live in the locale files — they are keyed by interface language while the
 * separator comes from the DEVICE, so no `en.json` entry suits an English UI on
 * a Spanish phone. Only digit-flanked periods are touched.
 */
export function localizeNumericHint(text: string): string {
  const separator = getDeviceDecimalSeparator();
  if (separator === '.') return text;
  return text.replace(/(\d)\.(\d)/g, `$1${separator}$2`);
}

/** Test-only: the app has no reason to discard the memoized formatters. */
export function resetNumberFormatterCache(): void {
  decimalFormatters.clear();
  currencyFormatters.clear();
}
