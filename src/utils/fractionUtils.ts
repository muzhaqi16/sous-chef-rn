/**
 * Fraction Parsing Utilities
 *
 * Provides utilities for parsing fractional and mixed number user input.
 */

/**
 * Parse a fractional string input to a number.
 *
 * Supports:
 * - Integers: "1", "2", "10"
 * - Decimals: "1.5", "0.25"
 * - Simple fractions: "1/2", "3/4"
 * - Mixed numbers: "1 1/4", "2 1/2"
 *
 * @param input - The string input to parse
 * @returns The parsed number value, or null if parsing fails
 *
 * @example
 * parseFractionalInput("1")     // Returns 1
 * parseFractionalInput("1.5")   // Returns 1.5
 * parseFractionalInput("1/2")   // Returns 0.5
 * parseFractionalInput("1 1/4") // Returns 1.25
 * parseFractionalInput("invalid") // Returns null
 */
export function parseFractionalInput(input: string): number | null {
  try {
    const trimmed = input.trim();

    if (!trimmed) {
      return null;
    }

    // Check if it contains a fraction
    if (trimmed.includes('/')) {
      const parts = trimmed.split(/\s+/);

      if (parts.length === 2) {
        // Mixed number like "1 1/4"
        const whole = parseInt(parts[0]);
        const fractionParts = parts[1].split('/');

        if (fractionParts.length !== 2) {
          return null;
        }

        const num = Number(fractionParts[0]);
        const den = Number(fractionParts[1]);

        if (isNaN(whole) || isNaN(num) || isNaN(den) || den === 0) {
          return null;
        }

        return whole + num / den;
      } else if (parts.length === 1) {
        // Simple fraction like "3/4"
        const fractionParts = trimmed.split('/');

        if (fractionParts.length !== 2) {
          return null;
        }

        const num = Number(fractionParts[0]);
        const den = Number(fractionParts[1]);

        if (isNaN(num) || isNaN(den) || den === 0) {
          return null;
        }

        return num / den;
      } else {
        // Invalid format (more than one space-separated group with fractions)
        return null;
      }
    } else {
      // Regular number (integer or decimal)
      const result = parseFloat(trimmed);
      return isNaN(result) ? null : result;
    }
  } catch {
    return null;
  }
}
