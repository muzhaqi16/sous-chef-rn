/**
 * useToggleShoppingItem - Toggle purchase status mutation for shopping list
 *
 * Single responsibility:
 * - Toggle mutation with optimistic response
 * - Move items between purchased/unpurchased connections
 * - Persist optimistic state for offline support
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useToggleShoppingListItemPurchasedMutation } from '#generated';
import type { ShoppingListItemDisplayFragment } from '#generated';
import { useErrorService } from '#/services/errorService';
import {
  moveShoppingListItemToPurchased,
  moveShoppingListItemToUnpurchased,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { isNetworkError } from '#/utils/isNetworkError';

interface UseToggleShoppingItemOptions {
  listId: string | null | undefined;
  items: ShoppingListItemDisplayFragment[];
  refetch: () => Promise<any>;
}

/**
 * Hook for toggling the purchased status of shopping list items
 *
 * Handles:
 * - Optimistic UI updates
 * - Moving items between purchased/unpurchased connections
 * - Offline persistence of optimistic state
 * - Network error handling (queue for retry)
 *
 * @example
 * ```tsx
 * const { toggleItem } = useToggleShoppingItem({ listId, items, refetch });
 * await toggleItem('item-123');
 * ```
 */
export function useToggleShoppingItem({ listId, items, refetch }: UseToggleShoppingItemOptions) {
  const { handleApolloError } = useErrorService();

  const [togglePurchasedMutation] = useToggleShoppingListItemPurchasedMutation({
    errorPolicy: 'all',
    // Optimistic response ensures update() runs immediately (not after network response)
    optimisticResponse: (variables, { IGNORE }) => {
      const item = items?.find(i => i.id === variables.input.id);
      if (!item) return IGNORE;
      return {
        __typename: 'Mutation',
        toggleShoppingListItemPurchased: {
          __typename: 'ShoppingListItemPayload',
          success: true,
          message: '',
          code: 'SUCCESS',
          shoppingListItem: {
            ...item,
            normalizedQuantity: null,
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: variables.input.purchased,
              purchasedQuantity: null,
              purchasedPrice: null,
              purchaseDate: variables.input.purchased ? new Date().toISOString() : null,
            },
            updatedAt: new Date().toISOString(),
          },
        },
      };
    },
    update(cache, _result, { variables }) {
      if (!variables || !listId) return;

      const itemId = variables.input.id;
      const newStatus = variables.input.purchased; // true = marking purchased, false = marking unpurchased

      // 1. Update the item's purchaseInfo field directly
      cache.modify({
        id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
        fields: {
          purchaseInfo(existingPurchaseInfo = {}) {
            return {
              ...existingPurchaseInfo,
              isPurchased: newStatus,
            };
          },
          updatedAt() {
            return new Date().toISOString();
          },
        },
      });

      // 2. Move item between purchased/unpurchased connections
      // moveShoppingListItem* handles BOTH itemsConnection filtered variants
      // AND aliased fields (unpurchasedItems/purchasedItems) in one call
      if (newStatus) {
        moveShoppingListItemToPurchased(cache, listId, { id: itemId });
      } else {
        moveShoppingListItemToUnpurchased(cache, listId, { id: itemId });
      }

      // 3. Persist optimistic isPurchased to survive app restarts while offline
      optimisticDataPersistence.save(
        'ShoppingListItem',
        itemId,
        'isPurchased',
        newStatus,
      );
    },
    onCompleted: data => {
      // Clear persisted optimistic data on successful server sync
      const item = data?.toggleShoppingListItemPurchased?.shoppingListItem;
      if (item?.id) {
        optimisticDataPersistence.clear(
          'ShoppingListItem',
          item.id,
          'isPurchased',
        );
      }
    },
    onError: error => {
      // For network errors, don't show alert or refetch - queue will handle retry
      // This keeps the optimistic UI intact while offline
      if (isNetworkError(error)) {
        console.log('Toggle purchase queued for retry (network error)');
        return;
      }

      // For server/validation errors, show alert and refetch to restore correct state
      const { message } = handleApolloError(error, {
        operation: 'Toggle Item Purchased',
      });
      Alert.alert('Error', message);
      refetch();
    },
  });

  // Simplified toggleItem - uses items ref instead of cache read
  const toggleItem = useCallback(
    async (itemId: string) => {
      if (!listId) return false;

      try {
        const item = items?.find(i => i.id === itemId);
        if (!item) return false;

        const newStatus = !item.purchaseInfo?.isPurchased;

        const result = await togglePurchasedMutation({
          variables: { input: { id: itemId, purchased: newStatus } },
        });

        return result.data?.toggleShoppingListItemPurchased?.shoppingListItem ?? false;
      } catch (error) {
        console.error('Toggle shopping list item purchased error:', error);
        return false;
      }
    },
    [listId, items, togglePurchasedMutation],
  );

  return { toggleItem };
}
