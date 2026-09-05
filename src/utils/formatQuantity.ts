import Fraction from 'fraction.js';
import { parseFractionalInput } from '#/utils/fractionUtils';

/** Every quantity the app renders is at most this precise. */
const MAX_DECIMALS = 2;

// Cooking-friendly denominators; anything else falls back to a decimal, so no
// list reads "7/10 cup".
const COOKING_DENOMINATORS = new Set([2, 3, 4, 6, 8]);

// Wide enough to catch a float32 round trip: the API stores 1/3 and echoes back
// 0.33333334, which is 3e-9 off the nearest third.
const TOLERANCE = 0.02;

/** At most 2 decimals, trailing zeros stripped: 3 → "3", 0.333 → "0.33". */
export function formatQuantity(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(MAX_DECIMALS).replace(/\.?0+$/, '') || '0';
}

/**
 * How a fractional value is written. `mixed` is the cooking form ("1 1/4"),
 * `fraction` the improper one ("5/4"), `decimal` the 2-place number. The two
 * fraction notations still fall back to a decimal for a value no cooking
 * fraction fits, so nothing ever reads "7/10 cup".
 */
export type QuantityNotation = 'mixed' | 'fraction' | 'decimal';

/**
 * A cooking fraction when the value maps to one, else 2 decimals: 0.5 → "1/2",
 * 1.25 → "1 1/4", 2.7 → "2.7".
 */
export function formatQuantityAsFraction(
  qty: number,
  notation: QuantityNotation = 'mixed',
): string {
  if (qty == null || qty === 0) return '0';
  if (Number.isInteger(qty)) return qty.toString();
  if (notation === 'decimal') return formatQuantity(qty);

  const simplified = new Fraction(qty).simplify(TOLERANCE);
  if (COOKING_DENOMINATORS.has(Number(simplified.d))) {
    return simplified.toFraction(notation === 'mixed');
  }

  return formatQuantity(qty);
}

export interface QuantityDisplayOptions {
  /**
   * The user's own text, e.g. "1 1/4". Re-formatted rather than trusted: the
   * API echoes this field back as a stringified float, so an item added from a
   * recipe comes back carrying "0.33333334".
   */
  quantityInput?: string | null;
  notation?: QuantityNotation;
}

/**
 * The one way a stored quantity reaches the screen. Text no parser can read is
 * the user's own note ("a pinch") and is kept as written; '' when there is
 * nothing to show, so a caller can pick its own placeholder.
 */
export function formatQuantityForDisplay(
  quantity: number | null | undefined,
  { quantityInput, notation = 'mixed' }: QuantityDisplayOptions = {},
): string {
  const typed = quantityInput?.trim();
  const value = typed ? parseFractionalInput(typed) : quantity;

  if (value == null) return typed || '';
  if (!Number.isFinite(value)) return '';

  return formatQuantityAsFraction(value, notation);
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
  return `${formatQuantityForDisplay(quantity)} ${unitStr}`.trim();
}

/** Prefers the unit's symbol over its name. */
export function getUnitDisplayText(
  unit?: { symbol?: string; name?: string } | null,
): string {
  return unit?.symbol || unit?.name || '';
}
