import { useCallback, useRef, useLayoutEffect } from 'react';
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
import { useHaptic } from '#hooks/haptic';
import { Telemetry } from '#/services/telemetry';

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

  // Refs for stable callbacks (avoid recreating callbacks on items change)
  const updateQuantityRef = useRef(updateQuantity);
  const refetchItemsRef = useRef(refetchItems);

  // Keep refs updated
  useLayoutEffect(() => {
    updateQuantityRef.current = updateQuantity;
    refetchItemsRef.current = refetchItems;
  }, [updateQuantity, refetchItems]);

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

        await updateQuantityRef.current({
          variables: {
            itemId,
            quantity: newQuantity.toString(),
            version: cachedItem.version,
          },
          // NO optimisticResponse - cache.modify handles instant UI
          onCompleted: data => {
            if (data?.updateShoppingListItemQuantity) {
              optimisticDataPersistence.clear(
                'ShoppingListItem',
                data.updateShoppingListItemQuantity.id,
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

        if (handleVersionConflict(error)) {
          Alert.alert('Item Updated', getVersionConflictMessage(error), [
            { text: 'Refresh', onPress: () => refetchItemsRef.current() },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        console.error('Failed to update quantity:', error);
        toastService.error('Failed to update quantity');
      }
    },
    [client],
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

        await updateQuantityRef.current({
          variables: {
            itemId,
            quantity: newQuantity.toString(),
            version: cachedItem.version,
          },
          // NO optimisticResponse - cache.modify handles instant UI
          onCompleted: data => {
            if (data?.updateShoppingListItemQuantity) {
              optimisticDataPersistence.clear(
                'ShoppingListItem',
                data.updateShoppingListItemQuantity.id,
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

        if (handleVersionConflict(error)) {
          Alert.alert('Item Updated', getVersionConflictMessage(error), [
            { text: 'Refresh', onPress: () => refetchItemsRef.current() },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        console.error('Failed to update quantity:', error);
        toastService.error('Failed to update quantity');
      }
    },
    [client],
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

  // Clear all purchased handler
  const handleClearAllPurchased = useCallback(async () => {
    const purchasedItems = items.filter(
      (item: any) => item.purchaseInfo?.isPurchased,
    );

    if (purchasedItems.length === 0) return;

    try {
      haptic.warning();
      await Promise.all(purchasedItems.map(item => removeItem(item.id)));
    } catch {
      haptic.error();
      toastService.error('Failed to clear purchased items');
    }
  }, [items, removeItem, haptic]);

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
    handleAddItemFromSearch,
  };
}
