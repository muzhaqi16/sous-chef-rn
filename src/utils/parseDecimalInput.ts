import { getDeviceDecimalSeparator } from './deviceLocale';

/**
 * Parse a user-typed number, accepting `.` or `,` as the decimal separator:
 * `decimal-pad` renders the DEVICE locale's key, so a Spanish phone offers `,`
 * and `parseFloat('4,99')` silently writes 4. Never `i18n.language` — an English
 * UI on a Spanish phone still gets a comma key. `NaN` like `parseFloat`.
 */
export function parseDecimalInput(value: string | null | undefined): number {
  if (value == null) return NaN;

  // Whitespace groups in several locales and is easy to paste in, so it never
  // carries meaning here.
  const cleaned = value.trim().replace(/\s/g, '');
  if (!cleaned) return NaN;

  // Guessing at a fraction is worse than declining: `1 1/2` minus its space is
  // `11/2`, which `parseFloat` reads as 11. Fraction-capable fields must use
  // `parseFractionalInput`; `NaN` sends callers down their invalid-input path.
  if (cleaned.includes('/')) return NaN;

  return parseFloat(interpretNumericRun(cleaned));
}

/**
 * Separators only, for values travelling to the API AS TEXT (`quantity: String!`
 * stores the display form, fractions included). Raw keystrokes send `4,99`,
 * which the server rejects after the cache showed it applied; the parsed number
 * would turn `1 1/2` into `1.5`. Each run is read alone, so a space never groups.
 */
export function normalizeNumericTextForApi(value: string): string {
  return value.replace(/[\d.,]+/g, interpretNumericRun);
}

/**
 * One run of digits and separators → a plain `.`-decimal string. Two DIFFERENT
 * separators: the last is the decimal. One repeated with exactly three digits
 * after each: all grouping. A lone ambiguous one is settled by the device's
 * separator. Shared, so API text and parsed number can never disagree.
 */
function interpretNumericRun(run: string): string {
  const separators = [...run.matchAll(/[.,]/g)];
  if (separators.length === 0) return run;

  const distinctChars = new Set(separators.map(match => match[0])).size;
  const everyGroupIsThreeDigits = separators.every((match, index) => {
    const start = match.index + 1;
    const end =
      index === separators.length - 1
        ? run.length
        : separators[index + 1].index;
    return end - start === 3;
  });

  const groupingOnly =
    distinctChars === 1 && separators.length >= 2 && everyGroupIsThreeDigits;

  if (groupingOnly) return run.replace(/[.,]/g, '');

  const lastSeparator = separators[separators.length - 1];
  const decimalIndex = lastSeparator.index;
  const whole = run.slice(0, decimalIndex).replace(/[.,]/g, '');
  const fraction = run.slice(decimalIndex + 1);

  // The one case the text cannot settle: `1,234` is a decimal on a `,` keypad
  // and a grouped thousand on a `.` one, and both typed what they meant.
  if (
    separators.length === 1 &&
    isAmbiguousGrouping(whole, fraction) &&
    lastSeparator[0] !== getDeviceDecimalSeparator()
  ) {
    return `${whole}${fraction}`;
  }

  return `${whole}.${fraction}`;
}

/**
 * Grouping is a candidate only where the digits match how grouping is written:
 * one to three ahead, exactly three behind, no leading zero. `1,2345` and
 * `1234,567` are decimals whatever the device says.
 */
function isAmbiguousGrouping(whole: string, fraction: string): boolean {
  return (
    fraction.length === 3 &&
    whole.length >= 1 &&
    whole.length <= 3 &&
    whole[0] !== '0' &&
    /^\d+$/.test(whole) &&
    /^\d+$/.test(fraction)
  );
}
