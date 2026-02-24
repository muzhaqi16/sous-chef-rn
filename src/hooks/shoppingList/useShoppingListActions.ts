import { useCallback } from 'react';
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
import { useHaptic } from '#hooks/haptic/useHaptic';
import { Telemetry } from '#/services/telemetry';
import { useClearShoppingListItems } from './mutations/useClearShoppingListItems';

interface UseShoppingListActionsOptions {
  currentListId: string | undefined;
  items: any[];
  addItem: (input: { itemName: string; quantity?: number }) => Promise<any>;
  toggleItem: (itemId: string) => Promise<any>;
  removeItem: (itemId: string) => Promise<any>;
  refetchItems: () => Promise<any>;
  setSearchQuery: (query: string) => void;
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
  items,
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
  const handleIncrementQuantity = useCallback(
    async (itemId: string) => {
      const cacheId = client.cache.identify({
        __typename: 'ShoppingListItem',
        id: itemId,
      });

      if (!cacheId) {
        console.warn('Item not in cache, cannot increment:', itemId);
        return;
      }

      // Read current quantity from cache using lightweight display fragment
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

      // Immediate cache update for instant UI feedback (Pattern 5 from apollo-client-patterns.md)
      client.cache.modify({
        id: cacheId,
        fields: {
          quantity() {
            return newQuantity;
          },
        },
      });

      try {
        optimisticDataPersistence.save(
          'ShoppingListItem',
          itemId,
          'quantity',
          newQuantity,
        );

        await updateQuantity({
          variables: {
            itemId,
            quantity: newQuantity.toString(),
            version: cachedItem.version,
          },
          // NO optimisticResponse - cache.modify handles instant UI
          onCompleted: data => {
            const updatedItem = data?.updateShoppingListItemQuantity?.shoppingListItem;
            if (updatedItem) {
              optimisticDataPersistence.clear(
                'ShoppingListItem',
                updatedItem.id,
                'quantity',
              );
            }
          },
        });
      } catch (error: any) {
        // Revert cache on error
        client.cache.modify({
          id: cacheId,
          fields: {
            quantity() {
              return cachedItem.quantity;
            },
          },
        });
        // Clear persisted optimistic data to prevent stale quantity on app restart
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'quantity');

        if (handleVersionConflict(error)) {
          Alert.alert('Item Updated', getVersionConflictMessage(error), [
            { text: 'Refresh', onPress: () => refetchItems() },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        console.error('Failed to update quantity:', error);
        toastService.error('Failed to update quantity');
      }
    },
    [client, refetchItems, updateQuantity],
  );

  // Quantity decrement handler - uses cache.modify for instant UI without warnings
  const handleDecrementQuantity = useCallback(
    async (itemId: string) => {
      const cacheId = client.cache.identify({
        __typename: 'ShoppingListItem',
        id: itemId,
      });

      if (!cacheId) {
        console.warn('Item not in cache, cannot decrement:', itemId);
        return;
      }

      // Read current quantity from cache using lightweight display fragment
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

      // Immediate cache update for instant UI feedback (Pattern 5 from apollo-client-patterns.md)
      client.cache.modify({
        id: cacheId,
        fields: {
          quantity() {
            return newQuantity;
          },
        },
      });

      try {
        optimisticDataPersistence.save(
          'ShoppingListItem',
          itemId,
          'quantity',
          newQuantity,
        );

        await updateQuantity({
          variables: {
            itemId,
            quantity: newQuantity.toString(),
            version: cachedItem.version,
          },
          // NO optimisticResponse - cache.modify handles instant UI
          onCompleted: data => {
            const updatedItem = data?.updateShoppingListItemQuantity?.shoppingListItem;
            if (updatedItem) {
              optimisticDataPersistence.clear(
                'ShoppingListItem',
                updatedItem.id,
                'quantity',
              );
            }
          },
        });
      } catch (error: any) {
        // Revert cache on error
        client.cache.modify({
          id: cacheId,
          fields: {
            quantity() {
              return cachedItem.quantity;
            },
          },
        });
        // Clear persisted optimistic data to prevent stale quantity on app restart
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'quantity');

        if (handleVersionConflict(error)) {
          Alert.alert('Item Updated', getVersionConflictMessage(error), [
            { text: 'Refresh', onPress: () => refetchItems() },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        console.error('Failed to update quantity:', error);
        toastService.error('Failed to update quantity');
      }
    },
    [client, refetchItems, updateQuantity],
  );

  // Toggle purchase handler
  // Animation timing is handled by AnimatedCheckbox via onToggleComplete callback
  const handleTogglePurchase = useCallback(
    async (itemId: string) => {
      Telemetry.trackEvent('toggle_item_purchase', { item_id: itemId });
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
        toastService.error('Failed to toggle item');
      }
    },
    [toggleItem, haptic],
  );

  // Delete item handler
  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      Telemetry.trackEvent('delete_item', { item_id: itemId });
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
        toastService.error('Failed to delete item');
      }
    },
    [removeItem, haptic],
  );

  // Clear items handler - uses optimistic cache clearing for instant UI
  const { clearItems } = useClearShoppingListItems({
    listId: currentListId,
    items,
    refetch: refetchItems,
  });

  const handleClearAllPurchased = useCallback(async () => {
    const purchasedItems = items.filter(
      (item: any) => item.purchaseInfo?.isPurchased,
    );

    if (purchasedItems.length === 0) return;

    try {
      haptic.warning();
      await clearItems(true);
    } catch {
      haptic.error();
      toastService.error('Failed to clear purchased items');
    }
  }, [items, clearItems, haptic]);

  // Clear all shopping (unpurchased) items handler
  const handleClearAllShopping = useCallback(async () => {
    const unpurchasedItems = items.filter(
      (item: any) => !item.purchaseInfo?.isPurchased,
    );

    if (unpurchasedItems.length === 0) return;

    try {
      haptic.warning();
      await clearItems(false);
    } catch {
      haptic.error();
      toastService.error('Failed to clear shopping items');
    }
  }, [items, clearItems, haptic]);

  // Add item from search handler
  const handleAddItemFromSearch = useCallback(
    async (itemName: string) => {
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

      try {
        const result = await addItem({
          itemName: itemName.trim(),
          quantity: 1,
        });

        if (result) {
          Telemetry.trackEvent('add_item_success', { source: 'search' });
          haptic.success();
        } else {
          Telemetry.trackEvent('add_item_failed', { source: 'search' });
          haptic.error();
          toastService.error('Failed to add item');
          setSearchQuery(itemName.trim());
        }
      } catch (error) {
        Telemetry.trackError(
          error instanceof Error ? error : 'Failed to add item from search',
          { component: 'ShoppingListMain', operation: 'addItemFromSearch' },
        );
        haptic.error();
        toastService.error('Failed to add item');
        setSearchQuery(itemName.trim());
      }
    },
    [currentListId, addItem, setSearchQuery, haptic],
  );

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
