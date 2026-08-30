import Fraction from 'fraction.js';
import { normalizeNumericTextForApi } from '#/utils/parseDecimalInput';

/**
 * Parses "3", "1.5", "1,5", "3/4" and "1 1/4"; null on invalid input. Behind
 * every quantity field, so BOTH decimal separators must work — `fraction.js`
 * accepts only `.` and throws on `4,99`, and a comma-decimal keypad offers no
 * `.` at all. `normalizeNumericTextForApi` converts before parsing.
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
