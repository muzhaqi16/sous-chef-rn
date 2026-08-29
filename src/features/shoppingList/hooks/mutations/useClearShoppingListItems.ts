/**
 * useClearShoppingListItems - Unified hook for batch clearing shopping list items
 *
 * Handles both purchased and unpurchased items:
 * - purchased=true: Clear all purchased items
 * - purchased=false: Clear all unpurchased (shopping) items
 *
 * Online-only: the clear is refused up front when the API is unreachable, and
 * the cache is cleared only once the server has confirmed the deletion.
 */

import { useRef } from 'react';
import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
import {
  RemoveItemsFromShoppingListDocument,
  type RemoveItemsFromShoppingListMutationVariables,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import {
  clearAllPurchasedItemsFromCache,
  clearAllUnpurchasedItemsFromCache,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { logger } from '#/utils/environment';

// The mutate function returned by useMutation for the clear operation. The
// hook only ever passes `variables` (the operation's `input`), so this captures
// just that subset of the Apollo mutate options.
type ClearMutationFn = (options: {
  variables: RemoveItemsFromShoppingListMutationVariables;
}) => Promise<{ data?: unknown; error?: unknown }>;

// The hook only reads `id` and the array length from the item lists.
interface ClearableItem {
  id: string;
}

interface UseClearShoppingListItemsOptions {
  listId: string | null | undefined;
  unpurchasedItems: ClearableItem[];
  purchasedItems: ClearableItem[];
  // Accepted but unread: nothing is written before the server answers, so there
  // is no local state to restore on failure.
  refetch: () => Promise<unknown>;
}

// --- Module-level helper (outside hook body for React Compiler) ---

async function executeClearItems(
  client: ApolloClient,
  clearMutation: ClearMutationFn,
  listId: string,
  purchased: boolean,
  itemIds: string[],
  isClearingRef: React.RefObject<boolean>,
): Promise<void> {
  // Fire a single batch mutation with the EXACT ids captured at tap time (not a
  // purchased filter), so it deletes only those and never items another member
  // added/purchased in the meantime.
  let result;
  try {
    result = await clearMutation({
      variables: { input: { shoppingListId: listId, ids: itemIds } },
    });
  } catch (error) {
    logger.warn(
      `Failed to clear ${purchased ? 'purchased' : 'shopping'} items:`,
      error,
    );
  }

  isClearingRef.current = false;
  if (!result) return;

  // A refusal (or a resolved transport error) means the items still exist
  // server-side; the cache still holds them, so there is nothing to undo.
  if (alertIfRejected(result, t('shoppingListScreens.failedToClear'))) {
    return;
  }

  // The server confirmed the deletion — drop the rows from the cache.
  if (purchased) {
    clearAllPurchasedItemsFromCache(client.cache, listId, itemIds);
  } else {
    clearAllUnpurchasedItemsFromCache(client.cache, listId, itemIds);
  }
}

/**
 * Hook for clearing shopping list items (purchased or unpurchased)
 *
 * Fires a single batch mutation and clears the cache on the server's response.
 * `isApiUnavailable` is returned so the screen can disable the affordance.
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
}: UseClearShoppingListItemsOptions) {
  const client = useApolloClient();
  const isClearingRef = useRef(false);
  const isApiUnavailable = useIsApiUnavailable();

  const [clearMutation] = useMutation(RemoveItemsFromShoppingListDocument, {});

  const clearItems = async (purchased: boolean) => {
    if (!listId || isClearingRef.current) return;

    const targetItems = purchased ? purchasedItems : unpurchasedItems;
    if (targetItems.length === 0) return;

    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return;
    }

    isClearingRef.current = true;
    const itemIds = targetItems.map(i => i.id);

    await executeClearItems(
      client,
      clearMutation,
      listId,
      purchased,
      itemIds,
      isClearingRef,
    );
  };

  return { clearItems, isApiUnavailable };
}
