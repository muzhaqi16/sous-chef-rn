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
import {
  DeleteShoppingListItemsDocument,
  type DeleteShoppingListItemsMutationVariables,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  clearAllPurchasedItemsFromCache,
  clearAllUnpurchasedItemsFromCache,
} from '#/apollo/utils/shoppingListCacheUpdaters';

// The mutate function returned by useMutation for the clear operation. The
// hook only ever passes `variables` (the operation's `input`), a no-op
// `update`, and the local-first context, so this captures just that subset of
// the Apollo mutate options.
type ClearMutationFn = (options: {
  variables: DeleteShoppingListItemsMutationVariables;
  update?: () => void;
  context?: { localFirst: boolean };
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

  // 2. Fire single batch mutation. Local-first: a queued offline clear keeps
  //    the cache cleared and replays later (clearing an already-cleared list
  //    is a no-op, so the replay is idempotent).
  const result = await executeMutation(
    () =>
      clearMutation({
        variables: { input: { shoppingListId: listId, purchased } },
        update: () => {}, // Cache already cleared optimistically
        context: { localFirst: true },
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

  // 'queued' (null payload, no error) keeps the cleared cache — the clear
  // replays later. A rejection means the server refused it: the evicted items
  // still exist server-side, so refetch to restore them.
  const outcome = classifyCreateResult(
    result as { data?: unknown; error?: unknown },
    'deleteShoppingListItems',
    'DeleteShoppingListItemsPayload',
  );
  if (outcome === 'rejected') {
    await refetch();
  }
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

  const [clearMutation] = useMutation(DeleteShoppingListItemsDocument, {});

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
