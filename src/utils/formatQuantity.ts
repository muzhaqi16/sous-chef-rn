import Fraction from 'fraction.js';

/** At most 2 decimals, trailing zeros stripped: 3 → "3", 0.333 → "0.33". */
export function formatQuantity(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * The canonical millilitre symbol is `mL`, and older rows spell it `ml`. The
 * comparison is case-insensitive because every casing of those two letters
 * means the same unit; `g` stays exact, since a capital `G` does not.
 */
const isMillilitre = (symbol: string): boolean => symbol.toLowerCase() === 'ml';

/** Primary display, with g→kg / mL→L upscaling: 1500g → "1.5kg". */
export function formatQuantityDisplay(quantity: number, unit?: string): string {
  const unitStr = unit || '';
  if (quantity >= 1000 && (unitStr === 'g' || isMillilitre(unitStr))) {
    return `${(quantity / 1000).toFixed(1)}${unitStr === 'g' ? 'kg' : 'L'}`;
  }
  if (Number.isInteger(quantity)) {
    return `${quantity} ${unitStr}`.trim();
  }
  return `${quantity.toFixed(quantity < 10 ? 2 : 1)} ${unitStr}`.trim();
}

/** Prefers the unit's symbol over its name. */
export function getUnitDisplayText(
  unit?: { symbol?: string; name?: string } | null,
): string {
  return unit?.symbol || unit?.name || '';
}

// Cooking-friendly denominators; anything else falls back to a decimal, so no
// recipe reads "7/10 cup".
const COOKING_DENOMINATORS = new Set([2, 3, 4, 8]);
const TOLERANCE = 0.02;

/**
 * A fraction or mixed number when the value maps to a cooking-friendly
 * denominator, otherwise 2 decimals: 0.5 → "1/2", 1.25 → "1 1/4", 2.7 → "2.7".
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
