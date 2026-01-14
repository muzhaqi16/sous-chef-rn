/**
 * useClearPurchasedItems - Batch clear all purchased items from shopping list
 *
 * Optimized for instant UI feedback:
 * 1. Immediately clears all purchased items from cache (instant UI update)
 * 2. Fires single batch mutation (efficient server-side deletion)
 * 3. Refetch on error to restore consistency
 */

import { useCallback, useRef } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { useClearPurchasedShoppingListItemsMutation } from '#generated';
import type { ShoppingListItemDisplayFragment } from '#generated';
import { clearAllPurchasedItemsFromCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { isNetworkError } from './utils';

interface UseClearPurchasedItemsOptions {
  listId: string | null | undefined;
  items: ShoppingListItemDisplayFragment[];
  refetch: () => Promise<any>;
}

/**
 * Hook for clearing all purchased items from a shopping list
 *
 * Uses optimistic cache clearing for instant UI feedback,
 * then fires a single batch mutation.
 *
 * @example
 * ```tsx
 * const { clearPurchased } = useClearPurchasedItems({ listId, items, refetch });
 *
 * const handleClearAll = async () => {
 *   await clearPurchased();
 * };
 * ```
 */
export function useClearPurchasedItems({
  listId,
  items,
  refetch,
}: UseClearPurchasedItemsOptions) {
  const client = useApolloClient();
  const isClearingRef = useRef(false);

  const [clearMutation] = useClearPurchasedShoppingListItemsMutation({
    errorPolicy: 'all',
  });

  const clearPurchased = useCallback(async () => {
    if (!listId || isClearingRef.current) return;

    const purchasedItems = items.filter(i => i.purchaseInfo?.isPurchased);
    if (purchasedItems.length === 0) return;

    isClearingRef.current = true;
    const purchasedItemIds = purchasedItems.map(i => i.id);

    try {
      // 1. IMMEDIATE: Optimistic cache clear (instant UI feedback)
      clearAllPurchasedItemsFromCache(client.cache, listId, purchasedItemIds);

      // 2. Fire single batch mutation
      await clearMutation({
        variables: { shoppingListId: listId },
        update: () => {}, // Cache already cleared optimistically
      });
    } catch (error: any) {
      // On error, refetch to restore correct state
      if (!isNetworkError(error)) {
        console.warn('Failed to clear purchased items:', error);
      }
      await refetch();
      throw error;
    } finally {
      isClearingRef.current = false;
    }
  }, [listId, items, client.cache, clearMutation, refetch]);

  return { clearPurchased };
}
