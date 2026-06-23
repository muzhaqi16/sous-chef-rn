/**
 * Shared types for shopping list item mutations
 */

export interface ShoppingListItemInput {
  itemName: string;
  quantity?: number;
  /**
   * Raw quantity string for the manual-add form (FlexibleQuantity — e.g.
   * "1/3", "1 1/4"). When set it takes precedence over `quantity`; the server
   * parses it. Omitted by quick-add, which sends a numeric `quantity`.
   */
  quantityInput?: string;
  unitName?: string;
  unitId?: string;
  notes?: string;
  category?: string;
  /** Estimated price string from the manual-add form (parsed to a number). */
  estimatedPrice?: string;
  /** Manual-add form extras (all optional; omitted by quick-add). */
  brandName?: string;
  brandId?: string;
  /** Net weight is all-or-nothing — both value and unit, or neither. */
  netWeight?: number;
  netWeightUnitId?: string;
  /** Priority as an Int (0 low, 1 medium, 2 high); see shoppingList/utils/priority. */
  priority?: number;
  /** Preferred store id (StorePreferencesInput.preferredStoreId). */
  preferredStoreId?: string;
}

export interface ShoppingListItemUpdate extends Partial<ShoppingListItemInput> {
  completed?: boolean;
}
