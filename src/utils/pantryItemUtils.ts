/**
 * Utility functions for pantry item data transformations
 */

interface UnitLike {
  id?: string;
  name?: string;
  symbol?: string;
}

interface PantryItemUnitSource {
  /** User-set package weight unit override (highest priority) */
  packageWeightUnit?: UnitLike | null;
  /** Pantry item's assigned unit (second priority) */
  unit?: UnitLike | null;
  /** Base catalog item data */
  item?: {
    /** Base item's default display unit (fallback only) */
    displayUnit?: UnitLike | null;
  } | null;
}

/**
 * Gets the effective unit for a pantry item with correct priority:
 * 1. packageWeightUnit - User-set package weight unit override
 * 2. unit - Pantry item's assigned unit
 * 3. item.displayUnit - Base catalog item's default unit (fallback)
 *
 * @param source - Object containing packageWeightUnit, unit, and item.displayUnit
 * @returns The effective unit object or undefined
 */
export function getEffectiveUnit(
  source: PantryItemUnitSource | null | undefined,
): UnitLike | undefined {
  if (!source) return undefined;

  return (
    source.packageWeightUnit ??
    source.unit ??
    source.item?.displayUnit ??
    undefined
  );
}

/**
 * Gets the effective unit symbol for a pantry item with correct priority:
 * 1. packageWeightUnit.symbol - User-set package weight unit override
 * 2. unit.symbol - Pantry item's assigned unit
 * 3. item.displayUnit.symbol - Base catalog item's default unit (fallback)
 *
 * @param source - Object containing packageWeightUnit, unit, and item.displayUnit
 * @returns The effective unit symbol or undefined
 */
export function getEffectiveUnitSymbol(
  source: PantryItemUnitSource | null | undefined,
): string | undefined {
  const unit = getEffectiveUnit(source);
  return unit?.symbol;
}
