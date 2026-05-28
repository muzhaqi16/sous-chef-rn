import type { ShoppingListRowItem } from '#features/shoppingList/components/SortableShoppingList/types';
import type { ShoppingListItemNode } from './usePaginatedShoppingItems';

const EMPTY_ROW_ITEMS: ShoppingListRowItem[] = [];

/**
 * Per-source transform cache.
 *
 * After the per-row `useFragment` migration the row component computes every
 * piece of display data itself, so this hook no longer produces a transformed
 * shape — it just wraps each node with the primitive metadata the FlashList
 * needs (`id`, `isPurchased`, `sortOrder`) and the masked fragment ref.
 *
 * The WeakMap cache keeps the wrapper array stable as long as the source
 * array is stable, which lets the React Compiler skip re-renders downstream.
 */
const wrapItemsCache = new WeakMap<
  readonly ShoppingListItemNode[],
  { key: string; result: ShoppingListRowItem[] }
>();

function wrapItems(
  items: readonly ShoppingListItemNode[],
  forcePurchasedState: boolean,
): ShoppingListRowItem[] {
  if (items.length === 0) return EMPTY_ROW_ITEMS;
  const key = String(forcePurchasedState);
  const cached = wrapItemsCache.get(items);
  if (cached && cached.key === key) return cached.result;
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
    result.push({
      id: node.id,
      isPurchased: forcePurchasedState,
      sortOrder: node.sortOrder ?? null,
      itemRef: node,
    });
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
