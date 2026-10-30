import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { toastService } from '#/services/toastService';
import { useUser } from '#store/useAppStore';
import {
  isAisleHeader,
  type ShoppingListEntry,
  type ShoppingListRowItem,
} from '#features/shoppingList/components/SortableShoppingList/types';
import { aisleAfter, type AisleTab } from '#features/shoppingList/utils/aisles';
import { linesInAisle } from '#features/shoppingList/components/SortableShoppingList/aisleRows';
import {
  formatCostToGo,
  useListCostToGo,
  type ListCostToGo,
} from '../hooks/useListCostToGo';
import { useShoppingListManagement } from '../hooks/useShoppingListManagement';
import { useShoppingListTransformMulti } from './useShoppingListTransform';
import { useShoppingListPermissions } from '../hooks/useShoppingListPermissions';
import { useShoppingListActions } from '../hooks/useShoppingListActions';
import { useUpdateShoppingList } from '../hooks/mutations/useUpdateShoppingList';
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

/** Store mode's line of what is left to buy, from the list's cost to go. */
function estimateOf(cost: ListCostToGo | null): StoreModeEstimate | null {
  const price = cost && formatCostToGo(cost);
  return cost && price
    ? { price, priced: cost.pricedLines, lines: cost.lines }
    : null;
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

  const costToGo = useListCostToGo(listId);
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

  const { t } = useTranslation();
  const { updateShoppingList } = useUpdateShoppingList(
    t('errors.saveSettingsFailed'),
  );
  const chooseStore = async (store: { id: string; name: string }) => {
    try {
      await updateShoppingList(listId, { targetStore: store });
    } catch {
      toastService.error(t('errors.saveSettingsFailed'));
    }
  };

  return {
    state: {
      listName: shoppingList?.name ?? null,
      storeName: shoppingList?.targetStore?.name ?? null,
      canChooseStore: permissions.canEditList,
      tab,
      rows: rowsFor(tab, aisleEntries, cart),
      aisles,
      lineCount: lines.length,
      cartCount: totalCountPurchased,
      totalCount: totalCountUnpurchased + totalCountPurchased,
      estimate: estimateOf(costToGo),
      routeNote,
      permissions,
      /** Every loaded line, for the sheets the rows open. */
      items: [...rawUnpurchasedItems, ...rawPurchasedItems],
      loading: loading && lines.length === 0,
      error,
    },
    actions: {
      setTab,
      chooseStore,
      toggleLine: handleTogglePurchase,
      loadMoreCart: loadMorePurchased,
      recordPurchase,
      refetch,
    },
  };
}
