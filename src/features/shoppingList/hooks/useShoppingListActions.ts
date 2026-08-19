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
import { useHaptic } from '#hooks/haptic/useHaptic';
import { Telemetry } from '#/services/telemetry';
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

// --- Module-level helpers (outside hook body for React Compiler) ---

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

  // `errorPolicy: 'all'` RESOLVES a failed mutation with `error` set instead of
  // rejecting, so the catch above only sees a link-level throw. Both outcomes
  // must revert the optimistic quantity — without this a refused update stayed
  // on screen with no message and no version-conflict refresh.
  if (result?.error) fail(result.error);
}

async function executeTogglePurchase(
  haptic: { selection: () => void; error: () => void },
  toggleItem: (itemId: string) => Promise<unknown>,
  itemId: string,
): Promise<void> {
  try {
    haptic.selection();
    await toggleItem(itemId);
    Telemetry.trackEvent('toggle_item_purchase_success');
  } catch (error) {
    Telemetry.trackError(
      error instanceof Error ? error : 'Failed to toggle item purchase',
      { component: 'ShoppingListMain', operation: 'togglePurchase' },
    );
    haptic.error();
    toastService.error(t('toasts.itemToggleFailed'));
  }
}

async function executeDeleteItem(
  haptic: { warning: () => void; error: () => void },
  removeItem: (itemId: string) => Promise<unknown>,
  itemId: string,
): Promise<void> {
  try {
    haptic.warning();
    await removeItem(itemId);
    Telemetry.trackEvent('delete_item_success');
  } catch (error) {
    Telemetry.trackError(
      error instanceof Error ? error : 'Failed to delete item',
      { component: 'ShoppingListMain', operation: 'deleteItem' },
    );
    haptic.error();
    toastService.error(t('errors.deleteItemFailed'));
  }
}

async function executeClearItems(
  haptic: { warning: () => void; error: () => void },
  clearItems: (purchased: boolean) => Promise<void>,
  purchased: boolean,
): Promise<void> {
  try {
    haptic.warning();
    await clearItems(purchased);
  } catch {
    haptic.error();
    toastService.error(
      purchased
        ? 'Failed to clear purchased items'
        : 'Failed to clear shopping items',
    );
  }
}

async function executeAddItemFromSearch(
  addItem: (input: { itemName: string; quantity?: number }) => Promise<unknown>,
  haptic: { success: () => void; error: () => void },
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
      haptic.success();
    } else {
      Telemetry.trackEvent('add_item_failed', { source: 'search' });
      haptic.error();
      toastService.error(t('errors.addItemFailed'));
      setSearchQuery(trimmed);
    }
  } catch (error) {
    Telemetry.trackError(
      error instanceof Error ? error : 'Failed to add item from search',
      { component: 'ShoppingListMain', operation: 'addItemFromSearch' },
    );
    haptic.error();
    toastService.error(t('errors.addItemFailed'));
    setSearchQuery(trimmed);
  }
}

/**
 * Shopping List Actions Hook
 * Extracts mutation handlers from ShoppingListMain for better separation of concerns
 *
 * Handles:
 * - Quantity increment/decrement
 * - Toggle purchase status
 * - Delete item
 * - Clear all purchased
 * - Add item from search
 *
 * Note: Sort order updates are handled by useItemReordering (canonical handler)
 */
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
  const haptic = useHaptic();

  const [updateQuantity] = useMutation(
    UpdateShoppingListItemQuantityDocument,
    {},
  );

  // Quantity increment handler - uses cache.modify for instant UI without warnings
  const handleIncrementQuantity = async (itemId: string) => {
    const cacheId = client.cache.identify({
      __typename: 'ShoppingListItem',
      id: itemId,
    });

    if (!cacheId) {
      console.warn('Item not in cache, cannot increment:', itemId);
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
      console.warn('Item not in cache, cannot increment:', itemId);
      return;
    }

    const newQuantity = (cachedItem.quantity || 0) + 1;

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

  // Quantity decrement handler - uses cache.modify for instant UI without warnings
  const handleDecrementQuantity = async (itemId: string) => {
    const cacheId = client.cache.identify({
      __typename: 'ShoppingListItem',
      id: itemId,
    });

    if (!cacheId) {
      console.warn('Item not in cache, cannot decrement:', itemId);
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
      console.warn('Item not in cache, cannot decrement:', itemId);
      return;
    }

    const newQuantity = Math.max(1, (cachedItem.quantity ?? 1) - 1);

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

  // Toggle purchase handler
  const handleTogglePurchase = async (itemId: string) => {
    Telemetry.trackEvent('toggle_item_purchase', { item_id: itemId });
    await executeTogglePurchase(haptic, toggleItem, itemId);
  };

  // Delete item handler
  const handleDeleteItem = async (itemId: string) => {
    Telemetry.trackEvent('delete_item', { item_id: itemId });
    await executeDeleteItem(haptic, removeItem, itemId);
  };

  // Clear items handler - uses optimistic cache clearing for instant UI
  const { clearItems } = useClearShoppingListItems({
    listId: currentListId,
    unpurchasedItems,
    purchasedItems,
    refetch: refetchItems,
  });

  const handleClearAllPurchased = async () => {
    if (purchasedItems.length === 0) return;
    await executeClearItems(haptic, clearItems, true);
  };

  // Clear all shopping (unpurchased) items handler
  const handleClearAllShopping = async () => {
    if (unpurchasedItems.length === 0) return;
    await executeClearItems(haptic, clearItems, false);
  };

  // Add item from search handler
  const handleAddItemFromSearch = async (itemName: string) => {
    if (!currentListId) {
      toastService.error(t('toasts.selectShoppingListFirst'));
      return;
    }

    Telemetry.trackEvent('add_item_from_search', {
      list_id: currentListId,
      item_name_length: itemName.trim().length,
    });

    // Clear search input immediately for instant feedback
    setSearchQuery('');

    await executeAddItemFromSearch(addItem, haptic, itemName, setSearchQuery);
  };

  return {
    // Quantity
    handleIncrementQuantity,
    handleDecrementQuantity,

    // Item actions
    handleTogglePurchase,
    handleDeleteItem,
    handleClearAllPurchased,
    handleClearAllShopping,
    handleAddItemFromSearch,
  };
}
