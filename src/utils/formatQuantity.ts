import Fraction from 'fraction.js';
import { formatNumberForInput } from '#/utils/formatters/number';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import { firstNonBlank } from '#/utils/firstNonBlank';

/** Every quantity the app renders or seeds is at most this precise: 1/8 is 0.125. */
const MAX_DECIMALS = 3;

// Cooking-friendly denominators; anything else falls back to a decimal, so no
// list reads "7/10 cup".
const COOKING_DENOMINATORS = new Set([2, 3, 4, 6, 8]);

// Wide enough to catch a float32 round trip: the API stores 1/3 and echoes back
// 0.33333334, which is 3e-9 off the nearest third.
const TOLERANCE = 0.02;

// Seeds the fraction as an integer PAIR: fraction.js's float constructor
// searches for an exact rational, and that search costs 273 ms for 0.33333334
// on device. Six digits is three orders past what this file displays.
const SCALE = 1e6;

/** At most 3 decimals, trailing zeros stripped: 3 → "3", 0.3333 → "0.333". */
export function formatQuantity(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(MAX_DECIMALS).replace(/\.?0+$/, '') || '0';
}

/**
 * How a fractional value is written. `mixed` is the cooking form ("1 1/4"),
 * `fraction` the improper one ("5/4"), `decimal` the 3-place number. The two
 * fraction notations still fall back to a decimal for a value no cooking
 * fraction fits, so nothing ever reads "7/10 cup".
 */
export type QuantityNotation = 'mixed' | 'fraction' | 'decimal';

/**
 * The item's `displayFormat` wins, then the unit's `displayAsFraction`; absent
 * both, a cooking fraction wins over a decimal.
 */
export function resolveQuantityNotation(
  displayFormat: DisplayFormat | null | undefined,
  displayAsFraction: boolean | null | undefined,
): QuantityNotation {
  switch (displayFormat) {
    case DisplayFormat.Fraction:
      return 'fraction';
    case DisplayFormat.Mixed:
      return 'mixed';
    case DisplayFormat.Decimal:
      return 'decimal';
    case DisplayFormat.Auto:
    case null:
    case undefined:
    default:
      // Only an explicit `false` — a unit nobody halves — opts out of fractions.
      return displayAsFraction === false ? 'decimal' : 'mixed';
  }
}

/**
 * A cooking fraction when the value maps to one, else 3 decimals: 0.5 → "1/2",
 * 1.25 → "1 1/4", 2.7 → "2.7".
 */
export function formatQuantityAsFraction(
  qty: number,
  notation: QuantityNotation = 'mixed',
): string {
  if (qty === 0) return '0';
  if (Number.isInteger(qty)) return qty.toString();
  if (notation === 'decimal') return formatQuantity(qty);

  const fraction = cookingFraction(qty);
  return fraction
    ? fraction.toFraction(notation === 'mixed')
    : formatQuantity(qty);
}

/** The nearest cooking fraction within `TOLERANCE`, or null when none fits. */
function cookingFraction(qty: number): Fraction | null {
  const scaled = Math.round(qty * SCALE);
  // A quantity this large has no cooking fraction to find anyway.
  if (!Number.isSafeInteger(scaled)) return null;
  const simplified = new Fraction(scaled, SCALE).simplify(TOLERANCE);
  return COOKING_DENOMINATORS.has(Number(simplified.d)) ? simplified : null;
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
 * Reads text the API was sent or returned (`1.250`, `1 1/4`). Its separator is
 * a period whatever the device uses, so it never goes through the device-aware
 * parser, which reads `1.250` as a thousand on a comma device. Null if unreadable.
 */
export function parseStoredQuantityText(text: string): number | null {
  const trimmed = text.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (!trimmed) return null;
  try {
    return new Fraction(trimmed).valueOf();
  } catch {
    return null;
  }
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
  const value = typed ? parseStoredQuantityText(typed) : quantity;

  if (value == null) return typed ?? '';
  if (!Number.isFinite(value)) return '';

  return formatQuantityAsFraction(value, notation);
}

// Two quantities equal to `MAX_DECIMALS` places are the same quantity.
const INPUT_ROUND_TRIP_TOLERANCE = 0.5 * 10 ** -MAX_DECIMALS;

/** Whether an edited quantity is the one that seeded it, as far as the field can show. */
export function isUnchangedQuantity(edited: number, stored: number): boolean {
  return Math.abs(edited - stored) <= INPUT_ROUND_TRIP_TOLERANCE;
}

/**
 * Seeds a text field the user edits: a cooking fraction only where it equals the
 * value to `MAX_DECIMALS` places, else the number rounded there, written with
 * the device's decimal separator.
 */
export function formatQuantityForInput(
  quantity: number | null | undefined,
  { notation = 'mixed' }: Pick<QuantityDisplayOptions, 'notation'> = {},
): string {
  if (quantity == null || !Number.isFinite(quantity)) return '';
  if (notation !== 'decimal' && !Number.isInteger(quantity)) {
    const fraction = cookingFraction(quantity);
    if (
      fraction &&
      Math.abs(fraction.valueOf() - quantity) <= INPUT_ROUND_TRIP_TOLERANCE
    ) {
      return fraction.toFraction(notation === 'mixed');
    }
  }
  return formatNumberForInput(Number(quantity.toFixed(MAX_DECIMALS)));
}

/**
 * The canonical millilitre symbol is `mL`, and older rows spell it `ml`. The
 * comparison is case-insensitive because every casing of those two letters
 * means the same unit; `g` stays exact, since a capital `G` does not.
 */
const isMillilitre = (symbol: string): boolean => symbol.toLowerCase() === 'ml';

/** Primary display, with g→kg / mL→L upscaling: 1500g → "1.5kg". */
export function formatQuantityDisplay(quantity: number, unit?: string): string {
  const unitStr = unit ?? '';
  if (quantity >= 1000 && (unitStr === 'g' || isMillilitre(unitStr))) {
    return `${formatQuantity(quantity / 1000)}${unitStr === 'g' ? 'kg' : 'L'}`;
  }
  return `${formatQuantityForDisplay(quantity)} ${unitStr}`.trim();
}

/** Prefers the unit's symbol over its name. */
export function getUnitDisplayText(
  unit?: { symbol?: string; name?: string } | null,
): string {
  return firstNonBlank(unit?.symbol, unit?.name) ?? '';
}
