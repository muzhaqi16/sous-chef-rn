import type { ShoppingListRowItem } from '#features/shoppingList/components/SortableShoppingList/types';
import type { ShoppingListItemNode } from './usePaginatedShoppingItems';

const EMPTY_ROW_ITEMS: ShoppingListRowItem[] = [];

/**
 * Two-level transform cache.
 *
 * After the per-row `useFragment` migration the row component computes every
 * piece of display data itself, so this hook no longer produces a transformed
 * shape — it just wraps each node with the primitive metadata the FlashList
 * needs (`id`, `isPurchased`, `sortOrder`) and the masked fragment ref.
 *
 * Array level: the wrapper array is reused while the source array is stable,
 * so downstream memoization holds across unrelated re-renders.
 *
 * Row level: each row object is cached against its node. A page append hands
 * us a NEW nodes array, but Apollo's structural sharing keeps every unchanged
 * node identical — and FlashList re-renders a cell only when its `item` prop
 * changes identity (`ViewHolder`'s memo compares `item` with `===`).
 * Rebuilding every row on append therefore re-rendered every mounted cell to
 * show a handful of new ones; reusing rows for unchanged nodes makes an append
 * cost only the cells it adds. Apollo produces a new node object whenever any
 * of its fields change, so a `sortOrder` edit still yields a fresh row. One
 * row cache per tab, because the same node is wrapped with a different
 * `isPurchased` on each tab while a toggle is in flight.
 */
const wrapItemsCache = new WeakMap<
  readonly ShoppingListItemNode[],
  { key: string; result: ShoppingListRowItem[] }
>();
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
        console.warn(
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

/**
 * Options for consolidated multi-source wrap.
 * Pass the pre-filtered (unpurchased / purchased) raw node arrays from
 * `useShoppingListManagement` and get the matching FlashList row arrays
 * back, with `isPurchased` pinned to each tab.
 */
interface MultiSourceTransformOptions {
  rawUnpurchasedItems: ShoppingListItemNode[];
  rawPurchasedItems: ShoppingListItemNode[];
}

/**
 * useShoppingListTransformMulti
 *
 * Wraps the two paginated source arrays into the lightweight FlashList row
 * shape. No display data is computed here — that lives on the row component
 * via `useFragment`.
 */
export function useShoppingListTransformMulti(
  options: MultiSourceTransformOptions,
) {
  const { rawUnpurchasedItems, rawPurchasedItems } = options;

  const unpurchasedItems = wrapItems(rawUnpurchasedItems, false);
  const purchasedItems = wrapItems(rawPurchasedItems, true);

  return { unpurchasedItems, purchasedItems };
}
