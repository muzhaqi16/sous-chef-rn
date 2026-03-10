import { Alert } from 'react-native';
import { useApolloClient } from '@apollo/client/react';
import {
  ShoppingListItemDisplayFragmentDoc,
  useUpdateShoppingListItemQuantityMutation,
} from '#generated';
import { toastService } from '#/services/toastService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { useHaptic } from '#hooks/haptic/useHaptic';
import { Telemetry } from '#/services/telemetry';
import { useClearShoppingListItems } from './mutations/useClearShoppingListItems';

interface UseShoppingListActionsOptions {
  currentListId: string | undefined;
  unpurchasedItems: any[];
  purchasedItems: any[];
  addItem: (input: { itemName: string; quantity?: number }) => Promise<any>;
  toggleItem: (itemId: string) => Promise<any>;
  removeItem: (itemId: string) => Promise<any>;
  refetchItems: () => Promise<any>;
  setSearchQuery: (query: string) => void;
}

// --- Module-level helpers (outside hook body for React Compiler) ---

async function executeQuantityUpdate(
  updateFn: () => Promise<void>,
  revertCache: () => void,
  clearPersistence: () => void,
  refetchItems: () => Promise<any>,
): Promise<void> {
  const result = await executeMutation(updateFn, (error: any) => {
    revertCache();
    clearPersistence();

    if (handleVersionConflict(error)) {
      Alert.alert('Item Updated', getVersionConflictMessage(error), [
        { text: 'Refresh', onPress: () => refetchItems() },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    console.error('Failed to update quantity:', error);
    toastService.error('Failed to update quantity');
  });
  if (result === false) return;
}

async function executeTogglePurchase(
  haptic: { selection: () => void; error: () => void },
  toggleItem: (itemId: string) => Promise<any>,
  itemId: string,
): Promise<void> {
  const result = await executeMutation(
    async () => {
      haptic.selection();
      await toggleItem(itemId);
      Telemetry.trackEvent('toggle_item_purchase_success');
    },
    error => {
      Telemetry.trackError(
        error instanceof Error ? error : 'Failed to toggle item purchase',
        { component: 'ShoppingListMain', operation: 'togglePurchase' },
      );
      haptic.error();
      toastService.error('Failed to toggle item');
    },
  );
  if (result === false) return;
}

async function executeDeleteItem(
  haptic: { warning: () => void; error: () => void },
  removeItem: (itemId: string) => Promise<any>,
  itemId: string,
): Promise<void> {
  const result = await executeMutation(
    async () => {
      haptic.warning();
      await removeItem(itemId);
      Telemetry.trackEvent('delete_item_success');
    },
    error => {
      Telemetry.trackError(
        error instanceof Error ? error : 'Failed to delete item',
        { component: 'ShoppingListMain', operation: 'deleteItem' },
      );
      haptic.error();
      toastService.error('Failed to delete item');
    },
  );
  if (result === false) return;
}

async function executeClearItems(
  haptic: { warning: () => void; error: () => void },
  clearItems: (purchased: boolean) => Promise<void>,
  purchased: boolean,
): Promise<void> {
  const result = await executeMutation(
    async () => {
      haptic.warning();
      await clearItems(purchased);
    },
    () => {
      haptic.error();
      toastService.error(
        purchased
          ? 'Failed to clear purchased items'
          : 'Failed to clear shopping items',
      );
    },
  );
  if (result === false) return;
}

async function executeAddItemFromSearch(
  addItem: (input: { itemName: string; quantity?: number }) => Promise<any>,
  haptic: { success: () => void; error: () => void },
  itemName: string,
  setSearchQuery: (query: string) => void,
): Promise<void> {
  const trimmed = itemName.trim();
  const result = await executeMutation(
    async () => {
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
        toastService.error('Failed to add item');
        setSearchQuery(trimmed);
      }
    },
    error => {
      Telemetry.trackError(
        error instanceof Error ? error : 'Failed to add item from search',
        { component: 'ShoppingListMain', operation: 'addItemFromSearch' },
      );
      haptic.error();
      toastService.error('Failed to add item');
      setSearchQuery(trimmed);
    },
  );
  if (result === false) return;
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

  const [updateQuantity] = useUpdateShoppingListItemQuantityMutation({
    errorPolicy: 'all',
  });

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

    const cachedItem = client.readFragment<any>({
      id: cacheId,
      fragment: ShoppingListItemDisplayFragmentDoc,
      fragmentName: 'ShoppingListItemDisplayFragment',
    });

    if (!cachedItem) {
      console.warn('Item not in cache, cannot increment:', itemId);
      return;
    }

    const newQuantity = (cachedItem.quantity || 0) + 1;

    client.cache.modify({
      id: cacheId,
      fields: {
        quantity() {
          return newQuantity;
        },
      },
    });

    optimisticDataPersistence.save(
      'ShoppingListItem',
      itemId,
      'quantity',
      newQuantity,
    );

    await executeQuantityUpdate(
      async () => {
        await updateQuantity({
          variables: {
            itemId,
            quantity: newQuantity.toString(),
            version: cachedItem.version,
          },
          onCompleted: data => {
            const updatedItem =
              data?.updateShoppingListItemQuantity?.shoppingListItem;
            if (updatedItem) {
              optimisticDataPersistence.clear(
                'ShoppingListItem',
                updatedItem.id,
                'quantity',
              );
            }
          },
        });
      },
      () => {
        client.cache.modify({
          id: cacheId,
          fields: {
            quantity() {
              return cachedItem.quantity;
            },
          },
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

    const cachedItem = client.readFragment<any>({
      id: cacheId,
      fragment: ShoppingListItemDisplayFragmentDoc,
      fragmentName: 'ShoppingListItemDisplayFragment',
    });

    if (!cachedItem) {
      console.warn('Item not in cache, cannot decrement:', itemId);
      return;
    }

    const newQuantity = Math.max(1, (cachedItem.quantity ?? 1) - 1);

    client.cache.modify({
      id: cacheId,
      fields: {
        quantity() {
          return newQuantity;
        },
      },
    });

    optimisticDataPersistence.save(
      'ShoppingListItem',
      itemId,
      'quantity',
      newQuantity,
    );

    await executeQuantityUpdate(
      async () => {
        await updateQuantity({
          variables: {
            itemId,
            quantity: newQuantity.toString(),
            version: cachedItem.version,
          },
          onCompleted: data => {
            const updatedItem =
              data?.updateShoppingListItemQuantity?.shoppingListItem;
            if (updatedItem) {
              optimisticDataPersistence.clear(
                'ShoppingListItem',
                updatedItem.id,
                'quantity',
              );
            }
          },
        });
      },
      () => {
        client.cache.modify({
          id: cacheId,
          fields: {
            quantity() {
              return cachedItem.quantity;
            },
          },
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
      toastService.error('Please select a shopping list first');
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
