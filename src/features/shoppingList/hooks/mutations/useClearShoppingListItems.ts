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
import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
import { ClearShoppingListItemsDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import {
  clearAllPurchasedItemsFromCache,
  clearAllUnpurchasedItemsFromCache,
} from '#/apollo/utils/shoppingListCacheUpdaters';

// The mutate function returned by useMutation for the clear operation. The
// runtime call passes batch variables un-nested (shoppingListId/purchased)
// rather than under the operation's `input` variable. Reconciling that requires
// changing the graphql operation/call (cross-module), so the options bag is kept
// loose here; only `variables` is untyped (see rule on cross-module refactors).
// `variables` stays `any`: the real useMutation mutate fn requires the strict
// `{ input }` shape, but the call passes un-nested fields. Bivariant assignment
// of the real fn to this type is only possible with `any` here; fixing it means
// changing the graphql operation/call (cross-module, out of scope).
type ClearMutationFn = (options: {
  variables: any;
  update?: () => void;
}) => Promise<unknown>;

// The hook only reads `id` and the array length from the item lists.
interface ClearableItem {
  id: string;
}

interface UseClearShoppingListItemsOptions {
  listId: string | null | undefined;
  unpurchasedItems: ClearableItem[];
  purchasedItems: ClearableItem[];
  refetch: () => Promise<unknown>;
}

// --- Module-level helper (outside hook body for React Compiler) ---

async function executeClearItems(
  client: ApolloClient,
  clearMutation: ClearMutationFn,
  listId: string,
  purchased: boolean,
  itemIds: string[],
  refetch: () => Promise<unknown>,
  isClearingRef: React.RefObject<boolean>,
): Promise<void> {
  // 1. IMMEDIATE: Optimistic cache clear (instant UI feedback)
  if (purchased) {
    clearAllPurchasedItemsFromCache(client.cache, listId, itemIds);
  } else {
    clearAllUnpurchasedItemsFromCache(client.cache, listId, itemIds);
  }

  // 2. Fire single batch mutation
  const result = await executeMutation(
    () =>
      clearMutation({
        variables: { shoppingListId: listId, purchased },
        update: () => {}, // Cache already cleared optimistically
      }),
    async error => {
      console.warn(
        `Failed to clear ${purchased ? 'purchased' : 'shopping'} items:`,
        error,
      );
      // Items were evicted from cache — refetch to restore authoritative state
      await refetch();
      isClearingRef.current = false;
    },
  );

  isClearingRef.current = false;
  if (result === false) return;
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
  unpurchasedItems,
  purchasedItems,
  refetch,
}: UseClearShoppingListItemsOptions) {
  const client = useApolloClient();
  const isClearingRef = useRef(false);

  const [clearMutation] = useMutation(ClearShoppingListItemsDocument, {});

  const clearItems = async (purchased: boolean) => {
    if (!listId || isClearingRef.current) return;

    const targetItems = purchased ? purchasedItems : unpurchasedItems;
    if (targetItems.length === 0) return;

    isClearingRef.current = true;
    const itemIds = targetItems.map(i => i.id);

    await executeClearItems(
      client,
      clearMutation,
      listId,
      purchased,
      itemIds,
      refetch,
      isClearingRef,
    );
  };

  return { clearItems };
}
