import Fraction from 'fraction.js';
import { formatNumberForInput } from '#/utils/formatters/number';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import type { PluralForms } from '#/graphql/generated/schemaTypes';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { getResolvedLanguage } from '#/i18n';

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
 * `mixed` is the cooking form ("1 1/4"), `fraction` the improper one ("5/4"),
 * `decimal` the 3-place number. Both fraction forms fall back to a decimal where
 * no cooking fraction fits, so nothing reads "7/10 cup".
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

/**
 * A unit as a document selects it to be shown: its forms, singular and plural
 * (`localizedSymbolForms`, `localizedNameForms`); a reading's or an item
 * suggestion's own `localizedSymbol`. A unit known only as text is
 * `{ symbol: text }`.
 */
export interface UnitLabelSource {
  symbol?: string | null;
  name?: string | null;
  localizedSymbol?: string | null;
  localizedSymbolForms?: LabelForms | null;
  localizedNameForms?: LabelForms | null;
}

type LabelForms = Partial<Pick<PluralForms, 'one' | 'other'>>;

export interface UnitLabelOptions {
  /** `name` shows the unit's name in place of its short form. */
  form?: 'symbol' | 'name';
  /** The quantity the label follows, which picks its plural. */
  quantity?: number | null;
}

// One per language: building a PluralRules parses locale data. `null` records
// an engine without `Intl.PluralRules`, which some Hermes builds are.
const pluralRulesByLanguage = new Map<string, Intl.PluralRules | null>();

// The API's own pick (PluralForms): one where the language reads the number as
// one, and for any part of one ("1/2 cup").
function readsAsOne(quantity: number | null | undefined): boolean {
  if (quantity == null || (quantity > 0 && quantity < 1)) return true;
  const language = getResolvedLanguage();
  let rules = pluralRulesByLanguage.get(language);
  if (rules === undefined) {
    try {
      rules = new Intl.PluralRules(language);
    } catch {
      rules = null;
    }
    pluralRulesByLanguage.set(language, rules);
  }
  return rules ? rules.select(quantity) === 'one' : quantity === 1;
}

/** Whether a unit holds the forms its label is picked from. */
export const carriesLabelForms = (unit: UnitLabelSource): boolean =>
  unit.localizedSymbolForms != null;

/**
 * How a unit reads on screen, in the app's language. A blank localized field
 * (an optimistic unit filled with the SDL neutral) falls back to the canonical
 * one. Display only: a comparison reads `symbol`, `name` or the id.
 */
export function unitLabel(
  unit: UnitLabelSource | null | undefined,
  { form = 'symbol', quantity }: UnitLabelOptions = {},
): string {
  if (!unit) return '';
  // A blank plural reads as the localized singular before the canonical one.
  const plural = !readsAsOne(quantity);
  const label =
    form === 'name'
      ? firstNonBlank(
          plural ? unit.localizedNameForms?.other : null,
          unit.localizedNameForms?.one,
          unit.name,
          unit.symbol,
        )
      : firstNonBlank(
          plural ? unit.localizedSymbolForms?.other : null,
          unit.localizedSymbolForms?.one,
          unit.localizedSymbol,
          unit.symbol,
          unit.name,
        );
  return label ?? '';
}

/** A quantity and its unit as one phrase, as a row's quantity chip shows them: "2 pc". */
export function formatQuantityWithUnit(
  quantity: number | null | undefined,
  unit: UnitLabelSource | null | undefined,
  options: QuantityDisplayOptions = {},
): string {
  const label = unitLabel(unit, { quantity });
  return `${formatQuantityForDisplay(quantity, options)} ${label}`.trim();
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

/**
 * Primary display, with g→kg / mL→L upscaling: 1500 g → "1.5 kg". Upscales by
 * the canonical symbol; kg and L read the same in every language.
 */
export function formatQuantityDisplay(
  quantity: number,
  unit?: UnitLabelSource | null,
): string {
  return displayPhrase(quantity, unit?.symbol, unitLabel(unit, { quantity }));
}

/**
 * A held amount, as `formatQuantityDisplay` shows it, in the short form the
 * server agreed with its quantity: "3 lattine". A blank one (an optimistic
 * amount) reads its unit.
 */
export function formatAmountDisplay(amount: HeldAmount): string {
  return displayPhrase(
    amount.quantity,
    amount.unit?.symbol,
    amountLabel(amount),
  );
}

interface HeldAmount {
  quantity: number;
  localizedSymbol?: string | null;
  unit?: UnitLabelSource | null;
}

/**
 * A held amount as `formatQuantityWithUnit` writes a quantity, in the short
 * form the server agreed with it: "3 lattine".
 */
export function formatAmountWithUnit(
  amount: HeldAmount,
  options: QuantityDisplayOptions = {},
): string {
  const figure = formatQuantityForDisplay(amount.quantity, options);
  return `${figure} ${amountLabel(amount)}`.trim();
}

/** The short form a held amount shows: the server's, else its unit's. */
function amountLabel(amount: HeldAmount): string {
  const { quantity, unit } = amount;
  return firstNonBlank(amount.localizedSymbol) ?? unitLabel(unit, { quantity });
}

function displayPhrase(
  quantity: number,
  symbol: string | null | undefined,
  label: string,
): string {
  if (quantity >= 1000 && symbol && (symbol === 'g' || isMillilitre(symbol))) {
    return `${formatQuantity(quantity / 1000)} ${symbol === 'g' ? 'kg' : 'L'}`;
  }
  return `${formatQuantityForDisplay(quantity)} ${label}`.trim();
}

/** A package size, as `formatQuantityDisplay` shows it; null when none is stated. */
export function formatNetWeightDisplay(
  netWeight?: number | null,
  netWeightUnit?: UnitLabelSource | null,
): string | null {
  if (!netWeight) return null;
  return formatQuantityDisplay(netWeight, netWeightUnit);
}
