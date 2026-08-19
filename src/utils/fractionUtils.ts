import Fraction from 'fraction.js';
import { normalizeNumericTextForApi } from '#/utils/parseDecimalInput';

/**
 * Parse fractional/decimal/mixed-number string input to a number.
 *
 * Supports integers ("3"), decimals ("1.5" and "1,5"), simple fractions ("3/4"),
 * and mixed numbers ("1 1/4"). Returns null on invalid input.
 *
 * This is the parser behind every quantity field in the app, which is why it has
 * to accept both decimal separators. `fraction.js` accepts only `.`, and throws
 * `Invalid argument` on `4,99` — so on a comma-decimal device, where the keypad
 * offers no `.` at all, this returned `null` for any fractional quantity and the
 * person simply could not enter one. The input is normalized to the machine
 * convention first, using the same separator rules as `parseDecimalInput`, so
 * `4,99` and `4.99` both arrive as `4.99` while `1 1/4` passes through as typed.
 */
export function parseFractionalInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return new Fraction(normalizeNumericTextForApi(trimmed)).valueOf();
  } catch {
    return null;
  }
}
