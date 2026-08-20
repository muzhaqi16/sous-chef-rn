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

/**
 * The fields an item edit can change. A type alias, not an interface extending
 * with extras: it carried a `completed?: boolean` that no caller ever set and
 * `UpdateShoppingListItemInput` has no field for — `updateItem` spreads updates
 * straight into the mutation input, so setting it would have sent an unknown
 * field and had the whole mutation rejected.
 *
 * Purchase state is deliberately absent. It moves through
 * `useToggleShoppingItem` (a checkbox tap, or the long-press amounts sheet),
 * never through a field update — `purchaseTracking.isPurchased` turning on is a
 * PURCHASE server-side, writing a purchase row and moving the item's counters,
 * so it must not be reachable as an incidental part of an edit.
 */
export type ShoppingListItemUpdate = Partial<ShoppingListItemInput>;
