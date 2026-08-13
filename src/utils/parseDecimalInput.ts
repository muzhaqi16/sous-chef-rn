import { getDeviceDecimalSeparator } from './deviceLocale';

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
 * **Why not the app's interface language.** `i18n.language` is a setting of its
 * own, changeable at any time and frequently unrelated to the phone underneath —
 * an English UI on a Spanish phone still gets a comma key. Parsing against the
 * interface language would misread that person's input, so it is never consulted
 * here.
 *
 * **The device locale is a different matter**, and this does use it: the keypad
 * is rendered from it, so it is the authority on what can be typed. Most inputs
 * do not need it, because the separator's *position* already settles them
 * without reference to any locale. One case is genuinely undecidable from the
 * text alone, and that one asks the device — see below.
 *
 * **The rules**, in order:
 * - No separator: parsed as-is.
 * - Two different separators: the last one is the decimal, the other is
 *   grouping. `1.234,56` and `1,234.56` both give `1234.56`.
 * - The same separator two or more times, each followed by exactly three
 *   digits: all grouping. `1.234.567` gives `1234567`.
 * - A lone separator that could be either — one to three digits before it and
 *   exactly three after, with no leading zero, as in `1,234` — is resolved
 *   against the device's own decimal separator. On a `.`-decimal device `1,234`
 *   is 1234; on a `,`-decimal device it is 1.234. When the platform exposes no
 *   locale data at all, `getDeviceDecimalSeparator` reports `.`, under which the
 *   `.` reading of `1.234` is a decimal and the `,` reading of `1,234` is
 *   grouping — deterministic in both directions rather than a failure.
 * - Otherwise the last separator is the decimal.
 *
 * No rule here can be worse than the `parseFloat` it replaces, which read every
 * one of these as the digits before the first separator: `1` for `1,234`, `1`
 * for `1.234,56`, `4` for `4,99`.
 *
 * Returns `NaN` for empty or unparseable input, exactly like `parseFloat`, so
 * existing `|| 1`, `|| undefined` and `Number.isNaN` call sites keep working.
 * Fractions are `NaN` too — see below.
 */
export function parseDecimalInput(value: string | null | undefined): number {
  if (value == null) return NaN;

  // Whitespace is a grouping separator in several locales (and a stray space is
  // easy to paste in), so it never carries meaning here.
  const cleaned = value.trim().replace(/\s/g, '');
  if (!cleaned) return NaN;

  // A fraction is not this function's to read, and guessing at one is worse
  // than declining: stripping the space out of `1 1/2` leaves `11/2`, which
  // `parseFloat` reads as **11**. Fraction-capable fields — every quantity
  // field, whose own placeholder offers `1 1/4` as an example — must use
  // `parseFractionalInput`, which handles both notations. `NaN` sends the
  // existing `|| 1` and `Number.isNaN` call sites down their invalid-input
  // path instead of accepting a number nobody typed.
  if (cleaned.includes('/')) return NaN;

  return parseFloat(interpretNumericRun(cleaned));
}

/**
 * Rewrite the separators in a numeric string to the machine convention — `.` for
 * the decimal, nothing for grouping — leaving everything else untouched.
 *
 * For values that travel to the API *as text*. Several mutations take
 * `quantity: String!` because the server accepts fractions there (`1 1/2`), and
 * it stores that string as the display form. Sending the raw keystrokes means a
 * comma-decimal device sends `4,99`, which the server rejects outright —
 * `ValidationError: Invalid fraction format: 4,99` — so the change is lost after
 * the local cache has already shown it as applied. Sending the *parsed* number
 * instead would fix that and throw away the fraction the person typed, turning
 * their `1 1/2` into `1.5` on screen.
 *
 * Rewriting only the separators keeps both: `4,99` becomes `4.99`, and `1 1/2`
 * is passed through exactly as typed.
 *
 * Each run of digits and separators is interpreted on its own, so the spaces and
 * slashes of a mixed number survive. The one input this reads differently from
 * `parseDecimalInput` is a space used as a grouping separator (`1 234,56`),
 * which stays two runs here rather than becoming one number — in a field that
 * also accepts `1 1/2`, a space cannot mean both things.
 */
export function normalizeNumericTextForApi(value: string): string {
  return value.replace(/[\d.,]+/g, interpretNumericRun);
}

/**
 * The separator rules, applied to one run of digits and separators, producing a
 * plain `.`-decimal string. Shared so the value sent to the API and the value
 * read into the cache can never disagree about what was typed.
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

  // The one case the text cannot settle on its own. `1,234` is a decimal to
  // someone whose keypad types `,` and a grouped thousand to someone whose
  // keypad types `.`; both are typing the number they meant.
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
 * Whether a lone separator could plausibly be read either way.
 *
 * Grouping is only a candidate when the digits either side match how grouping is
 * actually written: one to three digits ahead of the separator and exactly three
 * behind it. `1,2345` has four trailing digits and `1234,567` has four leading
 * ones — no locale groups like that, so both are decimals whatever the device
 * says. A leading zero (`0,123`) rules grouping out for the same reason.
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
