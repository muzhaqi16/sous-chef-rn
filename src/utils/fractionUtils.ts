import Fraction from 'fraction.js';

/**
 * Parse fractional/decimal/mixed-number string input to a number.
 *
 * Supports integers ("3"), decimals ("1.5"), simple fractions ("3/4"),
 * and mixed numbers ("1 1/4"). Returns null on invalid input.
 */
export function parseFractionalInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return new Fraction(trimmed).valueOf();
  } catch {
    return null;
  }
}
