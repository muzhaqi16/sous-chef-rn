/**
 * useClearShoppingListItems - Unified hook for batch clearing shopping list items
 *
 * Handles both purchased and unpurchased items:
 * - purchased=true: Clear all purchased items
 * - purchased=false: Clear all unpurchased (shopping) items
 *
 * Optimized for instant UI feedback:
 * 1. Immediately clears items from cache (instant UI update)
 * 2. Fires single batch mutation (efficient server-side deletion)
 * 3. Refetch on error to restore consistency
 */

import { useRef } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { useClearShoppingListItemsMutation } from '#generated';
import type { ShoppingListItemDisplayFragment } from '#generated';
import {
  clearAllPurchasedItemsFromCache,
  clearAllUnpurchasedItemsFromCache } from '#/apollo/utils/shoppingListCacheUpdaters';

interface UseClearShoppingListItemsOptions {
  listId: string | null | undefined;
  items: ShoppingListItemDisplayFragment[];
  refetch: () => Promise<any>;
}

/**
 * Hook for clearing shopping list items (purchased or unpurchased)
 *
 * Uses optimistic cache clearing for instant UI feedback,
 * then fires a single batch mutation.
 *
 * @example
 * ```tsx
 * const { clearItems } = useClearShoppingListItems({ listId, items, refetch });
 *
 * // Clear purchased items
 * await clearItems(true);
 *
 * // Clear unpurchased items
 * await clearItems(false);
 * ```
 */
export function useClearShoppingListItems({
  listId,
  items,
  refetch }: UseClearShoppingListItemsOptions) {
  const client = useApolloClient();
  const isClearingRef = useRef(false);

  const [clearMutation] = useClearShoppingListItemsMutation({
    errorPolicy: 'all' });

  const clearItems = async (purchased: boolean) => {
      if (!listId || isClearingRef.current) return;

      const targetItems = items.filter(i =>
        purchased ? i.purchaseInfo?.isPurchased : !i.purchaseInfo?.isPurchased,
      );
      if (targetItems.length === 0) return;

      isClearingRef.current = true;
      const itemIds = targetItems.map(i => i.id);

      try {
        // 1. IMMEDIATE: Optimistic cache clear (instant UI feedback)
        if (purchased) {
          clearAllPurchasedItemsFromCache(client.cache, listId, itemIds);
        } else {
          clearAllUnpurchasedItemsFromCache(client.cache, listId, itemIds);
        }

        // 2. Fire single batch mutation
        await clearMutation({
          variables: { shoppingListId: listId, purchased },
          update: () => {}, // Cache already cleared optimistically
        });
      } catch (error: any) {
        console.warn(
          `Failed to clear ${purchased ? 'purchased' : 'shopping'} items:`,
          error,
        );
        // Items were evicted from cache — refetch to restore authoritative state
        await refetch();
        throw error;
      } finally {
        isClearingRef.current = false;
      }
    };

  return { clearItems };
}
