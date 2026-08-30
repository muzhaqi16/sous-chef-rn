import type { ShoppingListRowItem } from '#features/shoppingList/components/SortableShoppingList/types';
import type { ShoppingListItemNode } from './usePaginatedShoppingItems';
import { logger } from '#/utils/environment';

const EMPTY_ROW_ITEMS: ShoppingListRowItem[] = [];

/**
 * Two-level identity cache. FlashList re-renders a cell only when its `item`
 * prop changes identity (`ViewHolder`'s memo compares with `===`), so reusing
 * the row object for an unchanged node makes an append cost only its own cells;
 * Apollo mints a new node on any field change, so an edit still yields a row.
 */
const wrapItemsCache = new WeakMap<
  readonly ShoppingListItemNode[],
  { key: string; result: ShoppingListRowItem[] }
>();
// One cache per tab: the same node carries a different `isPurchased` on each
// while a toggle is in flight.
const rowCacheByTab = {
  unpurchased: new WeakMap<ShoppingListItemNode, ShoppingListRowItem>(),
  purchased: new WeakMap<ShoppingListItemNode, ShoppingListRowItem>(),
};

function wrapItems(
  items: readonly ShoppingListItemNode[],
  forcePurchasedState: boolean,
): ShoppingListRowItem[] {
  if (items.length === 0) return EMPTY_ROW_ITEMS;
  const key = String(forcePurchasedState);
  const cached = wrapItemsCache.get(items);
  if (cached && cached.key === key) return cached.result;
  const rowCache = forcePurchasedState
    ? rowCacheByTab.purchased
    : rowCacheByTab.unpurchased;
  const result: ShoppingListRowItem[] = [];
  for (const node of items) {
    if (!node.id || !node.itemName) {
      if (__DEV__) {
        logger.warn(
          '⚠️ Skipping invalid shopping list item:',
          (node as { id?: string }).id,
        );
      }
      continue;
    }
    let row = rowCache.get(node);
    if (!row) {
      row = {
        id: node.id,
        isPurchased: forcePurchasedState,
        sortOrder: node.sortOrder ?? null,
        itemRef: node,
      };
      rowCache.set(node, row);
    }
    result.push(row);
  }
  wrapItemsCache.set(items, { key, result });
  return result;
}

/** Pre-filtered node arrays from `useShoppingListManagement`, one per tab. */
interface MultiSourceTransformOptions {
  rawUnpurchasedItems: ShoppingListItemNode[];
  rawPurchasedItems: ShoppingListItemNode[];
}

/**
 * Wraps both source arrays into the FlashList row shape. No display data is
 * computed here — the row component reads its fields via `useFragment`.
 */
export function useShoppingListTransformMulti(
  options: MultiSourceTransformOptions,
) {
  const { rawUnpurchasedItems, rawPurchasedItems } = options;

  const unpurchasedItems = wrapItems(rawUnpurchasedItems, false);
  const purchasedItems = wrapItems(rawPurchasedItems, true);

  return { unpurchasedItems, purchasedItems };
}
