import Fraction from 'fraction.js';

/**
 * Format a numeric quantity to at most 2 decimal places, stripping trailing zeros.
 *
 * Examples: 3 → "3", 1.50 → "1.5", 0.333 → "0.33"
 */
export function formatQuantity(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Format quantity for primary display with optional g→kg / ml→L upscaling.
 *
 * Examples: 1500g → "1.5kg", 3 pc → "3 pc"
 */
export function formatQuantityDisplay(quantity: number, unit?: string): string {
  const unitStr = unit || '';
  if (quantity >= 1000 && (unitStr === 'g' || unitStr === 'ml')) {
    return `${(quantity / 1000).toFixed(1)}${unitStr === 'g' ? 'kg' : 'L'}`;
  }
  if (Number.isInteger(quantity)) {
    return `${quantity} ${unitStr}`.trim();
  }
  return `${quantity.toFixed(quantity < 10 ? 2 : 1)} ${unitStr}`.trim();
}

/**
 * Get display text for a unit, preferring symbol over name.
 */
export function getUnitDisplayText(
  unit?: { symbol?: string; name?: string } | null,
): string {
  return unit?.symbol || unit?.name || '';
}

// Denominators we consider "cooking-friendly". Anything else falls back to
// a decimal representation (we don't want "7/10 cup" — show "0.7" instead).
const COOKING_DENOMINATORS = new Set([2, 3, 4, 8]);
const TOLERANCE = 0.02;

/**
 * Format a quantity as a fraction or mixed number when it cleanly maps to a
 * cooking-friendly denominator (halves/thirds/quarters/eighths). Otherwise
 * falls back to a 2-decimal representation.
 *
 * Examples: 0.5 → "1/2", 1.25 → "1 1/4", 2.7 → "2.7"
 */
export function formatQuantityAsFraction(qty: number): string {
  if (qty == null || qty === 0) return '0';
  if (Number.isInteger(qty)) return qty.toString();

  const simplified = new Fraction(qty).simplify(TOLERANCE);
  if (COOKING_DENOMINATORS.has(Number(simplified.d))) {
    return simplified.toFraction(true);
  }

  return qty.toFixed(2).replace(/\.?0+$/, '') || '0';
}
