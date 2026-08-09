/**
 * Parse a number the user typed, accepting either `.` or `,` as the decimal
 * separator.
 *
 * **Why this exists.** `keyboardType="decimal-pad"` renders the separator key of
 * the *device* locale, so a Spanish or Italian device offers `,`. Every numeric
 * field used to read its value with `parseFloat`, and `parseFloat('4,99')` is
 * `4` — not a rejection the user can see and correct, but a silently wrong
 * number written straight to the server. A price typed as `4,99` saved as `4`.
 *
 * **Why not `Intl` / the app's locale.** The keypad follows the device locale
 * while `i18n.language` follows the app language, and they routinely differ — an
 * English UI on a Spanish phone still gets a comma key. Keying the parse off
 * either one would be wrong for that user. Deciding from the separator's
 * *position* instead is locale-independent and correct in both.
 *
 * **The rules**, in order:
 * - No separator: parsed as-is.
 * - Two different separators: the last one is the decimal, the other is
 *   grouping. `1.234,56` and `1,234.56` both give `1234.56`.
 * - The same separator two or more times, each followed by exactly three
 *   digits: all grouping. `1.234.567` gives `1234567`.
 * - Otherwise the last separator is the decimal.
 *
 * That last rule makes a lone separator a decimal point regardless of which
 * character it is, so `1,234` parses as `1.234` rather than `1234`. That is
 * deliberate: a decimal-pad only ever offers its locale's *decimal* separator,
 * never a grouping one, so a single separator from this keyboard is always a
 * decimal point. It also cannot be worse than the `parseFloat` it replaces,
 * which read the same input as `1`.
 *
 * Returns `NaN` for empty or unparseable input, exactly like `parseFloat`, so
 * existing `|| 1`, `|| undefined` and `Number.isNaN` call sites keep working.
 */
export function parseDecimalInput(value: string | null | undefined): number {
  if (value == null) return NaN;

  // Whitespace is a grouping separator in several locales (and a stray space is
  // easy to paste in), so it never carries meaning here.
  const cleaned = value.trim().replace(/\s/g, '');
  if (!cleaned) return NaN;

  const separators = [...cleaned.matchAll(/[.,]/g)];
  if (separators.length === 0) return parseFloat(cleaned);

  const distinctChars = new Set(separators.map(match => match[0])).size;
  const everyGroupIsThreeDigits = separators.every((match, index) => {
    const start = match.index + 1;
    const end =
      index === separators.length - 1
        ? cleaned.length
        : separators[index + 1].index;
    return end - start === 3;
  });

  const groupingOnly =
    distinctChars === 1 && separators.length >= 2 && everyGroupIsThreeDigits;

  if (groupingOnly) {
    return parseFloat(cleaned.replace(/[.,]/g, ''));
  }

  const decimalIndex = separators[separators.length - 1].index;
  const whole = cleaned.slice(0, decimalIndex).replace(/[.,]/g, '');
  const fraction = cleaned.slice(decimalIndex + 1);
  return parseFloat(`${whole}.${fraction}`);
}
