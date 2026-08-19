/**
 * Presenting numbers with the same conventions the app accepts on input.
 *
 * The counterpart to `parseDecimalInput`. That module reads `4,99` as `4.99` on
 * a comma-decimal device; without this one the app would then display the value
 * back as `4.99` and prefill the edit field with `4.99` — a string whose `.`
 * that person's keypad does not offer, leaving them unable to retype their own
 * price. Input and output have to agree, and both follow the *device*, because
 * the keypad does. See `deviceLocale` for why that is the device and not
 * `i18n.language`.
 *
 * `Intl` is treated as possibly-absent, as everywhere else: each function
 * degrades to a plain rendering rather than throwing.
 */
import { getDeviceDecimalSeparator } from '../deviceLocale';

/**
 * Render a number for a text field the person will edit and the app will read
 * back with `parseDecimalInput`.
 *
 * Deliberately *not* `Intl`:
 * - **No grouping separators.** `1.234,56` in an input is noise to type around,
 *   and half-typed grouped values re-parse badly.
 * - **No rounding.** `Intl` would need a fraction-digit count, and any choice
 *   silently truncates a value the person did not ask to change. Swapping the
 *   separator on `String(value)` preserves the digits exactly, so opening an
 *   edit sheet and saving it unchanged cannot alter the stored number.
 *
 * Empty string for nullish and non-finite input, so `?? ''` call sites and
 * controlled `<TextInput value>` props keep working.
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

// Building an Intl formatter parses locale data and constructs lookup tables, so
// instances are cached by their options rather than rebuilt per render. A `null`
// entry records an option set Intl rejected, so the fallback path is not retried
// through a throw on every call.
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
 * Render a number for display, in the device's conventions.
 *
 * `maximumFractionDigits` defaults to 2 — enough for the money and quantity
 * values this app shows — and `minimumFractionDigits` to 0, so a whole number
 * reads as `3` rather than `3.00`. Pass both as 2 for money.
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

  // No Intl. Round to the same precision by hand and swap the separator, so the
  // degraded output still matches what the input side accepts.
  const fixed = value.toFixed(resolved.maximumFractionDigits ?? 2);
  const trimmed =
    (resolved.minimumFractionDigits ?? 0) > 0
      ? fixed
      : fixed.replace(/\.?0+$/, '');
  const separator = getDeviceDecimalSeparator();
  return separator === '.' ? trimmed : trimmed.replace('.', separator);
}

/**
 * The currency to assume where no code is available.
 *
 * Most money in the app — batch costs, meal-plan budgets, estimated ingredient
 * prices — carries no currency of its own; only a shopping list has a `currency`
 * field. Those amounts were previously rendered by prefixing a literal `$`, in
 * app code and inside the translated strings themselves, so US dollars is
 * already what they mean. Naming it here makes that assumption visible and
 * gives it one place to change when the API exposes a per-user currency.
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
 * Render a money amount with its ISO currency code.
 *
 * Symbol placement is the locale's, not a hard-coded prefix: `1.234,56 €` in
 * Spanish and `€1,234.56` in English are both correct, and prefixing `$` to
 * every amount was wrong in both.
 *
 * Degrades to `CODE 1234.56` when Intl does not recognise the code, and to a
 * plain formatted number when no code is given at all.
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  const amount = value ?? 0;
  const money = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

  if (!currency) return formatDecimal(amount, money);

  const formatter = getCurrencyFormatter(currency);
  if (!formatter) return `${currency} ${formatDecimal(amount, money)}`;
  return formatter.format(amount);
}

/**
 * Rewrite the decimal separator in the example numbers inside a hint or
 * placeholder — `e.g., 4.99` becomes `e.g., 4,99` on a comma-decimal device.
 *
 * This cannot live in the translation files, which is the whole reason it
 * exists. A locale file is keyed by *interface language*, and the separator a
 * person can type comes from the *device*: an English UI on a Spanish phone
 * needs `e.g., 4,99` in English. There is no `en.json` entry that is right for
 * both, so the example is adjusted where the device is known instead.
 *
 * Only digit-flanked periods are touched, so sentence punctuation and the `1/4`
 * in a fractions hint pass through untouched.
 */
export function localizeNumericHint(text: string): string {
  const separator = getDeviceDecimalSeparator();
  if (separator === '.') return text;
  return text.replace(/(\d)\.(\d)/g, `$1${separator}$2`);
}

/**
 * Discards the memoized formatters. For tests that need to observe more than one
 * device locale in a process; the app has no reason to call it.
 */
export function resetNumberFormatterCache(): void {
  decimalFormatters.clear();
  currencyFormatters.clear();
}
