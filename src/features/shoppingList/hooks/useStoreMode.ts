import { useState } from 'react';
import { useUser } from '#store/useAppStore';
import { formatCurrency } from '#/utils/formatters/number';
import {
  isAisleHeader,
  type ShoppingListEntry,
  type ShoppingListRowItem,
} from '#features/shoppingList/components/SortableShoppingList/types';
import {
  aisleAfter,
  linesInAisle,
  type AisleTab,
} from '#features/shoppingList/utils/aisles';
import { lineTotal } from '#features/shoppingList/utils/purchasePrice';
import type { ShoppingListItemNode } from './usePaginatedShoppingItems';
import { useShoppingListManagement } from './useShoppingListManagement';
import { useShoppingListTransformMulti } from './useShoppingListTransform';
import { useShoppingListPermissions } from './useShoppingListPermissions';
import { useShoppingListActions } from './useShoppingListActions';
import { useAisleView } from './useAisleView';

/** An aisle, every aisle, or what is already in the cart. */
export type StoreModeTab = AisleTab | 'cart';

/** What the lines left would cost, by typed estimate else recorded prices. */
export interface StoreModeEstimate {
  price: string;
  /** How many of the lines left carry a price. */
  priced: number;
  lines: number;
}

// As the API's suggestedTotal: a line's typed estimate, else its suggestion,
// both in the list's currency; no one total when suggestions disagree on it.
function estimateLeft(
  lines: readonly ShoppingListItemNode[],
  listCurrency: string | null,
): StoreModeEstimate | null {
  let total = 0;
  let priced = 0;
  let currency: { code: string; decimalPlaces: number | null } | null =
    listCurrency ? { code: listCurrency, decimalPlaces: null } : null;
  for (const line of lines) {
    const typed = line.priceEstimate.estimated;
    const suggestion = typed == null ? line.suggestedPrice : null;
    const unitPrice = typed ?? suggestion?.amount;
    if (unitPrice == null) continue;
    if (suggestion) {
      if (currency && currency.code !== suggestion.currency.code) return null;
      currency = suggestion.currency;
    }
    total += lineTotal(unitPrice, line.quantity ?? 0);
    priced += 1;
  }
  if (priced === 0) return null;
  return {
    price: formatCurrency(total, currency?.code, currency?.decimalPlaces),
    priced,
    lines: lines.length,
  };
}

function rowsFor(
  tab: StoreModeTab,
  aisleEntries: ShoppingListEntry[],
  cart: ShoppingListRowItem[],
): ShoppingListEntry[] {
  if (tab === 'cart') return cart;
  if (tab === 'all') return aisleEntries;
  return linesInAisle(aisleEntries, tab);
}

/**
 * Store mode: one list walked aisle by aisle, every line loaded so an aisle
 * cannot miss one on a later page. When the open aisle's last line is ticked,
 * the next aisle on the walk opens.
 */
export function useStoreMode(listId: string) {
  const user = useUser();
  const {
    shoppingList,
    rawUnpurchasedItems,
    rawPurchasedItems,
    loading,
    error,
    totalCountUnpurchased,
    totalCountPurchased,
    loadMorePurchased,
    removeItem,
    toggleItem,
    recordPurchase,
    refetch,
  } = useShoppingListManagement(listId, { loadEveryUnpurchasedPage: true });

  const { unpurchasedItems: lines, purchasedItems: cart } =
    useShoppingListTransformMulti({ rawUnpurchasedItems, rawPurchasedItems });
  const { aisleEntries, routeNote } = useAisleView(
    listId,
    shoppingList?.targetStore?.id ?? null,
    lines,
  );
  const aisles = aisleEntries.filter(isAisleHeader);

  const [tab, setTab] = useState<StoreModeTab>('all');
  const walk = aisles.map(aisle => aisle.department);
  const walkKey = walk.join();
  const [seen, setSeen] = useState({ key: walkKey, walk });
  if (seen.key !== walkKey) {
    setSeen({ key: walkKey, walk });
    if (tab !== 'all' && tab !== 'cart' && !walk.includes(tab)) {
      setTab(aisleAfter(seen.walk, tab, walk));
    }
  }

  const permissions = useShoppingListPermissions(shoppingList, user?.id);
  const { handleTogglePurchase } = useShoppingListActions({
    currentListId: listId,
    unpurchasedItems: rawUnpurchasedItems,
    purchasedItems: rawPurchasedItems,
    toggleItem,
    removeItem,
    refetchItems: refetch,
  });

  return {
    state: {
      listName: shoppingList?.name ?? null,
      storeName: shoppingList?.targetStore?.name ?? null,
      tab,
      rows: rowsFor(tab, aisleEntries, cart),
      aisles,
      lineCount: lines.length,
      cartCount: totalCountPurchased,
      totalCount: totalCountUnpurchased + totalCountPurchased,
      estimate: estimateLeft(
        rawUnpurchasedItems,
        shoppingList?.currency ?? null,
      ),
      routeNote,
      permissions,
      /** Every loaded line, for the sheets the rows open. */
      items: [...rawUnpurchasedItems, ...rawPurchasedItems],
      loading: loading && lines.length === 0,
      error,
    },
    actions: {
      setTab,
      toggleLine: handleTogglePurchase,
      loadMoreCart: loadMorePurchased,
      recordPurchase,
      refetch,
    },
  };
}
