import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  UseShoppingListActions_ItemFragmentDoc,
  type UseShoppingListActions_ItemFragment,
} from './useShoppingListActions.generated';
import { UpdateShoppingListItemQuantityDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { toastService } from '#/services/toastService';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { setCachedFields } from '#/apollo/utils/cacheUpdaters';
import { HapticService } from '#services/haptic/HapticService';
import { Telemetry } from '#/services/telemetry';
import { logger } from '#/utils/environment';
import { useClearShoppingListItems } from './mutations/useClearShoppingListItems';
import type { ShoppingListItemNode } from './usePaginatedShoppingItems';
import { t } from '#/i18n';

interface UseShoppingListActionsOptions {
  currentListId: string | undefined;
  unpurchasedItems: ShoppingListItemNode[];
  purchasedItems: ShoppingListItemNode[];
  addItem: (input: { itemName: string; quantity?: number }) => Promise<unknown>;
  toggleItem: (itemId: string) => Promise<unknown>;
  removeItem: (itemId: string) => Promise<unknown>;
  refetchItems: () => Promise<unknown>;
  setSearchQuery: (query: string) => void;
}

// Module-level: their try bodies would otherwise bail the hook out of the
// React Compiler.
async function executeQuantityUpdate(
  updateFn: () => Promise<{ error?: unknown } | undefined>,
  revertCache: () => void,
  clearPersistence: () => void,
  refetchItems: () => Promise<unknown>,
): Promise<void> {
  const fail = (error: unknown) => {
    revertCache();
    clearPersistence();

    handleMutationError(error, {
      operation: 'Update Quantity',
      checks: [versionConflictCheck({ onRefresh: () => refetchItems() })],
    });
  };

  let result;
  try {
    result = await updateFn();
  } catch (error) {
    fail(error);
    return;
  }

  // `errorPolicy: 'all'` RESOLVES a failed mutation with `error` set, so the
  // catch above sees only a link-level throw. Both outcomes must revert the
  // optimistic quantity and run the version-conflict check.
  if (result?.error) fail(result.error);
}

async function executeTogglePurchase(
  toggleItem: (itemId: string) => Promise<unknown>,
  itemId: string,
): Promise<void> {
  try {
    HapticService.selection();
    await toggleItem(itemId);
    Telemetry.trackEvent('toggle_item_purchase_success');
  } catch (error) {
    Telemetry.trackError(
      error instanceof Error ? error : 'Failed to toggle item purchase',
      { component: 'ShoppingListMain', operation: 'togglePurchase' },
    );
    toastService.error(t('toasts.itemToggleFailed'));
  }
}

async function executeDeleteItem(
  removeItem: (itemId: string) => Promise<unknown>,
  itemId: string,
): Promise<void> {
  try {
    HapticService.warning();
    await removeItem(itemId);
    Telemetry.trackEvent('delete_item_success');
  } catch (error) {
    Telemetry.trackError(
      error instanceof Error ? error : 'Failed to delete item',
      { component: 'ShoppingListMain', operation: 'deleteItem' },
    );
    toastService.error(t('errors.deleteItemFailed'));
  }
}

async function executeClearItems(
  clearItems: (purchased: boolean) => Promise<void>,
  purchased: boolean,
): Promise<void> {
  try {
    HapticService.warning();
    await clearItems(purchased);
  } catch {
    toastService.error(t('shoppingListScreens.failedToClear'));
  }
}

async function executeAddItemFromSearch(
  addItem: (input: { itemName: string; quantity?: number }) => Promise<unknown>,
  itemName: string,
  setSearchQuery: (query: string) => void,
): Promise<void> {
  const trimmed = itemName.trim();
  try {
    const addResult = await addItem({
      itemName: trimmed,
      quantity: 1,
    });

    if (addResult) {
      Telemetry.trackEvent('add_item_success', { source: 'search' });
      HapticService.success();
    } else {
      Telemetry.trackEvent('add_item_failed', { source: 'search' });
      toastService.error(t('errors.addItemFailed'));
      setSearchQuery(trimmed);
    }
  } catch (error) {
    Telemetry.trackError(
      error instanceof Error ? error : 'Failed to add item from search',
      { component: 'ShoppingListMain', operation: 'addItemFromSearch' },
    );
    toastService.error(t('errors.addItemFailed'));
    setSearchQuery(trimmed);
  }
}

/** Sort-order updates are NOT here — `useItemReordering` is the one handler. */
export function useShoppingListActions({
  currentListId,
  unpurchasedItems,
  purchasedItems,
  addItem,
  toggleItem,
  removeItem,
  refetchItems,
  setSearchQuery,
}: UseShoppingListActionsOptions) {
  const client = useApolloClient();

  const [updateQuantity] = useMutation(
    UpdateShoppingListItemQuantityDocument,
    {},
  );

  /**
   * Move an item's quantity by a delta, optimistically. An absent quantity reads
   * as 0 to match what the row shows (`SortableItem` renders `quantity ?? 0`);
   * reading it as 1 would make "+" jump from the 0 on screen straight to 2.
   */
  const adjustQuantity = async (itemId: string, delta: number) => {
    const cacheId = client.cache.identify({
      __typename: 'ShoppingListItem',
      id: itemId,
    });
    if (!cacheId) {
      logger.warn('Item not in cache, cannot adjust quantity:', itemId);
      return;
    }

    const cachedItem = client.readFragment<UseShoppingListActions_ItemFragment>(
      {
        id: cacheId,
        fragment: UseShoppingListActions_ItemFragmentDoc,
        fragmentName: 'useShoppingListActions_item',
      },
    );
    if (!cachedItem) {
      logger.warn('Item not in cache, cannot adjust quantity:', itemId);
      return;
    }

    // A row on a shopping list is never worth less than one of the thing, so
    // the floor is 1 in both directions rather than only on the way down.
    const newQuantity = Math.max(1, (cachedItem.quantity ?? 0) + delta);

    setCachedFields(client.cache, 'ShoppingListItem', itemId, {
      quantity: newQuantity,
    });

    optimisticDataPersistence.save(
      'ShoppingListItem',
      itemId,
      'quantity',
      newQuantity,
    );

    await executeQuantityUpdate(
      async () => {
        return await updateQuantity({
          variables: {
            input: {
              itemId,
              quantity: newQuantity.toString(),
              version: cachedItem.version,
            },
          },
          // Local-first: queue on an API-down-while-online failure (absolute
          // quantity → idempotent on replay via SyncShoppingListItem).
          context: { localFirst: true },
          onCompleted: data => {
            const payload = data?.updateShoppingListItemQuantity;
            if (
              payload?.__typename === 'UpdateShoppingListItemQuantityPayload'
            ) {
              optimisticDataPersistence.clear(
                'ShoppingListItem',
                payload.shoppingListItem.id,
                'quantity',
              );
            }
          },
        });
      },
      () => {
        setCachedFields(client.cache, 'ShoppingListItem', itemId, {
          quantity: cachedItem.quantity,
        });
      },
      () =>
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'quantity'),
      refetchItems,
    );
  };

  const handleIncrementQuantity = (itemId: string) => adjustQuantity(itemId, 1);
  const handleDecrementQuantity = (itemId: string) =>
    adjustQuantity(itemId, -1);

  const handleTogglePurchase = async (itemId: string) => {
    Telemetry.trackEvent('toggle_item_purchase', { item_id: itemId });
    await executeTogglePurchase(toggleItem, itemId);
  };

  const handleDeleteItem = async (itemId: string) => {
    Telemetry.trackEvent('delete_item', { item_id: itemId });
    await executeDeleteItem(removeItem, itemId);
  };

  const { clearItems } = useClearShoppingListItems({
    listId: currentListId,
    unpurchasedItems,
    purchasedItems,
    refetch: refetchItems,
  });

  const handleClearAllPurchased = async () => {
    if (purchasedItems.length === 0) return;
    await executeClearItems(clearItems, true);
  };

  const handleClearAllShopping = async () => {
    if (unpurchasedItems.length === 0) return;
    await executeClearItems(clearItems, false);
  };

  const handleAddItemFromSearch = async (itemName: string) => {
    if (!currentListId) {
      toastService.error(t('toasts.selectShoppingListFirst'));
      return;
    }

    Telemetry.trackEvent('add_item_from_search', {
      list_id: currentListId,
      item_name_length: itemName.trim().length,
    });

    // Cleared up front; `executeAddItemFromSearch` puts the text back on failure.
    setSearchQuery('');

    await executeAddItemFromSearch(addItem, itemName, setSearchQuery);
  };

  return {
    handleIncrementQuantity,
    handleDecrementQuantity,
    handleTogglePurchase,
    handleDeleteItem,
    handleClearAllPurchased,
    handleClearAllShopping,
    handleAddItemFromSearch,
  };
}
