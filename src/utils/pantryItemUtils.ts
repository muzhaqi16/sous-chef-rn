/**
 * Utility functions for pantry item data transformations
 */

interface UnitLike {
  id?: string;
  name?: string;
  symbol?: string;
}

interface PantryItemUnitSource {
  /** Pantry item's assigned unit (primary) */
  unit?: UnitLike | null;
  /** Base catalog item data */
  item?: {
    /** Base item's default display unit (fallback only) */
    displayUnit?: UnitLike | null;
  } | null;
}

/**
 * Gets the effective unit for a pantry item with correct priority:
 * 1. unit - Pantry item's assigned unit
 * 2. item.displayUnit - Base catalog item's default unit (fallback)
 *
 * @param source - Object containing unit and item.displayUnit
 * @returns The effective unit object or undefined
 */
export function getEffectiveUnit(
  source: PantryItemUnitSource | null | undefined,
): UnitLike | undefined {
  if (!source) return undefined;

  return (
    source.unit ??
    source.item?.displayUnit ??
    undefined
  );
}

/**
 * Gets the effective unit symbol for a pantry item with correct priority:
 * 1. unit.symbol - Pantry item's assigned unit
 * 2. item.displayUnit.symbol - Base catalog item's default unit (fallback)
 *
 * @param source - Object containing unit and item.displayUnit
 * @returns The effective unit symbol or undefined
 */
export function getEffectiveUnitSymbol(
  source: PantryItemUnitSource | null | undefined,
): string | undefined {
  const unit = getEffectiveUnit(source);
  return unit?.symbol;
}
