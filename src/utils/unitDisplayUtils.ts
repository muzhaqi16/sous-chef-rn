/**
 * Utility functions for formatting quantities with item-specific unit display names.
 *
 * The API supports item-specific unit display names through the ItemUnit model.
 * For example, "Pineapple" can display as "2 pineapples" instead of generic "2 count".
 *
 * Priority for unit display:
 * 1. ItemUnit.displayNamePlural/displayNameSingular (if set)
 * 2. Unit.symbol (fallback)
 */

/**
 * Item unit with display name fields
 */
export interface ItemUnitDisplay {
  displayNameSingular?: string | null;
  displayNamePlural?: string | null;
  unit?: {
    symbol?: string | null;
    name?: string | null;
  } | null;
}

/**
 * Get the appropriate unit display name based on quantity.
 *
 * @param quantity - The quantity value
 * @param itemUnit - The ItemUnit with display names (optional)
 * @param fallbackSymbol - Fallback unit symbol if no display names available
 * @returns The appropriate display name for the quantity
 *
 * @example
 * // With item-specific display names
 * getUnitDisplayName(1, { displayNameSingular: 'pineapple', displayNamePlural: 'pineapples' })
 * // Returns: 'pineapple'
 *
 * getUnitDisplayName(2, { displayNameSingular: 'pineapple', displayNamePlural: 'pineapples' })
 * // Returns: 'pineapples'
 *
 * // Without display names (fallback to symbol)
 * getUnitDisplayName(2, null, 'count')
 * // Returns: 'count'
 */
export function getUnitDisplayName(
  quantity: number,
  itemUnit?: ItemUnitDisplay | null,
  fallbackSymbol?: string | null,
): string {
  // Use singular form for quantity === 1
  if (quantity === 1) {
    return (
      itemUnit?.displayNameSingular ||
      itemUnit?.unit?.symbol ||
      fallbackSymbol ||
      ''
    );
  }

  // Use plural form for other quantities
  return (
    itemUnit?.displayNamePlural ||
    itemUnit?.unit?.symbol ||
    fallbackSymbol ||
    ''
  );
}

/**
 * Format a quantity with its unit display name.
 *
 * @param quantity - The quantity value
 * @param itemUnit - The ItemUnit with display names (optional)
 * @param fallbackSymbol - Fallback unit symbol if no display names available
 * @returns Formatted string like "2 pineapples" or "500 g"
 *
 * @example
 * formatQuantityWithUnit(2, { displayNameSingular: 'pineapple', displayNamePlural: 'pineapples' })
 * // Returns: '2 pineapples'
 *
 * formatQuantityWithUnit(1, { displayNameSingular: 'egg', displayNamePlural: 'eggs' })
 * // Returns: '1 egg'
 *
 * formatQuantityWithUnit(500, null, 'g')
 * // Returns: '500 g'
 */
export function formatQuantityWithUnit(
  quantity: number,
  itemUnit?: ItemUnitDisplay | null,
  fallbackSymbol?: string | null,
): string {
  const unitName = getUnitDisplayName(quantity, itemUnit, fallbackSymbol);
  if (!unitName) {
    return quantity.toString();
  }
  return `${quantity} ${unitName}`;
}

/**
 * Find the matching ItemUnit for a given unit ID from a list of item units.
 *
 * @param unitId - The unit ID to find
 * @param itemUnits - List of ItemUnits to search
 * @returns The matching ItemUnit or undefined
 */
export function findItemUnitById<
  T extends { unit?: { id?: string | null } | null },
>(unitId: string | null | undefined, itemUnits?: T[] | null): T | undefined {
  if (!unitId || !itemUnits) return undefined;
  return itemUnits.find(iu => iu.unit?.id === unitId);
}

/**
 * Find the matching ItemUnit for a given unit symbol from a list of item units.
 *
 * @param symbol - The unit symbol to find (case-insensitive)
 * @param itemUnits - List of ItemUnits to search
 * @returns The matching ItemUnit or undefined
 */
export function findItemUnitBySymbol<
  T extends { unit?: { symbol?: string | null } | null },
>(symbol: string | null | undefined, itemUnits?: T[] | null): T | undefined {
  if (!symbol || !itemUnits) return undefined;
  const lowerSymbol = symbol.toLowerCase();
  return itemUnits.find(iu => iu.unit?.symbol?.toLowerCase() === lowerSymbol);
}

/**
 * Get the display label for a unit chip in a unit picker.
 * Prefers displayNamePlural for a more descriptive label.
 *
 * @param itemUnit - The ItemUnit to get a label for
 * @returns The label to display in the chip
 *
 * @example
 * getUnitChipLabel({ displayNamePlural: 'pineapples', unit: { symbol: 'count' } })
 * // Returns: 'pineapples'
 *
 * getUnitChipLabel({ unit: { symbol: 'g' } })
 * // Returns: 'g'
 */
export function getUnitChipLabel(itemUnit: ItemUnitDisplay): string {
  return (
    itemUnit.displayNamePlural || itemUnit.unit?.symbol || itemUnit.unit?.name || ''
  );
}
