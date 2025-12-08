import { useCallback, useRef, useLayoutEffect } from 'react';
import { Alert } from 'react-native';
import { useApolloClient } from '@apollo/client/react';
import {
  ShoppingListItemFragmentDoc,
  ShoppingListItemDisplayFragmentDoc,
  useMoveShoppingListItemMutation,
  useUpdateShoppingListItemQuantityMutation,
  GetShoppingListDocument,
  GetShoppingListQuery,
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
 * - Sort order updates
 * - Add item from search
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

  // Mutations
  const [moveItem] = useMoveShoppingListItemMutation({
    errorPolicy: 'all',
    // Optimistic response for instant UI feedback
    optimisticResponse: variables => {
      // Read full item from Apollo cache to get all fragment fields
      const cacheId = client.cache.identify({
        __typename: 'ShoppingListItem',
        id: variables.input.itemId,
      });

      const fullItem = cacheId
        ? client.readFragment<any>({
            id: cacheId,
            fragment: ShoppingListItemFragmentDoc,
            fragmentName: 'ShoppingListItemFragment',
          })
        : null;

      if (!fullItem) {
        // Fallback - return minimal item, real mutation will handle errors
        return {
          __typename: 'Mutation',
          moveShoppingListItem: {
            __typename: 'ShoppingListItem',
            id: variables.input.itemId,
            sortOrder: 'a0',
          },
        };
      }

      // Calculate optimistic sortOrder based on afterItemId
      const afterItem = variables.input.afterItemId
        ? items.find(item => item.id === variables.input.afterItemId)
        : null;

      // Use fractional indexing for sortOrder
      const optimisticSortOrder = afterItem?.sortOrder || fullItem.sortOrder;

      // Return updated item with new sortOrder
      return {
        __typename: 'Mutation',
        moveShoppingListItem: {
          ...fullItem,
          sortOrder: optimisticSortOrder,
          updatedAt: new Date().toISOString(),
          __typename: 'ShoppingListItem',
        },
      };
    },
    // Update cache to reflect new order
    // Uses GetShoppingList.itemsConnection as the cache location
    update(cache, { data }) {
      if (!data?.moveShoppingListItem || !currentListId) return;

      try {
        // Read the current shopping list query with itemsConnection
        const queryResult = cache.readQuery<GetShoppingListQuery>({
          query: GetShoppingListDocument,
          variables: { id: currentListId },
        });

        if (!queryResult?.shoppingList?.itemsConnection?.edges) return;

        // Update single item with new sortOrder
        const updatedEdges = queryResult.shoppingList.itemsConnection.edges.map(
          (edge: any) =>
            edge.node.id === data.moveShoppingListItem.id
              ? { ...edge, node: { ...edge.node, sortOrder: data.moveShoppingListItem.sortOrder } }
              : edge,
        );

        // Write back to cache
        cache.writeQuery({
          query: GetShoppingListDocument,
          variables: { id: currentListId },
          data: {
            shoppingList: {
              ...queryResult.shoppingList,
              itemsConnection: {
                ...queryResult.shoppingList.itemsConnection,
                edges: updatedEdges,
              },
            },
          },
        });
      } catch (error) {
        console.warn('Cache update failed for moveItem:', error);
      }
    },
    onError: error => {
      console.error('Move item error:', error);
      const errorMessage =
        error.message || 'Failed to reorder item. Please try again.';
      Alert.alert('Error', `Could not reorder item: ${errorMessage}`);
    },
  });

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

  // Sort order update handler
  const handleSortOrderUpdate = useCallback(
    async (
      itemId: string,
      afterItemId: string | null,
      beforeItemId: string | null,
      afterSortOrder: string | null,
      beforeSortOrder: string | null,
    ) => {
      if (!currentListId) return;

      try {
        // DEFENSIVE CHECK: Detect duplicate sortOrder values
        if (
          afterSortOrder !== null &&
          beforeSortOrder !== null &&
          afterSortOrder === beforeSortOrder
        ) {
          console.error('❌ Duplicate sortOrder detected:', {
            afterItemId,
            afterSortOrder,
            beforeItemId,
            beforeSortOrder,
          });

          Alert.alert(
            'Error',
            'Item positions are out of sync. Refreshing list...',
          );
          await refetchItems();
          return;
        }

        await moveItem({
          variables: {
            input: {
              itemId,
              afterItemId: afterItemId ?? undefined,
              beforeItemId: beforeItemId ?? undefined,
            },
          },
        });
      } catch (error) {
        console.error('Failed to move item:', error);
        toastService.error('Failed to reorder items');
      }
    },
    [currentListId, moveItem, refetchItems],
  );

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

      const newQuantity = Math.max(0, (cachedItem.quantity || 0) - 1);

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
    const purchasedItems = items.filter((item: any) => item.isPurchased);

    if (purchasedItems.length === 0) return;

    try {
      haptic.warning();
      await Promise.all(purchasedItems.map(item => removeItem(item.id)));
    } catch (error) {
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
    // Sort order
    handleSortOrderUpdate,

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
