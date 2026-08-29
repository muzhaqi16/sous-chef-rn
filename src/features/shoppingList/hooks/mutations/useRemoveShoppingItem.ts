/**
 * useRemoveShoppingItem — remove an item from a shopping list (local-first).
 *
 * The removal goes through the declared write path: it is described once as a
 * `WriteIntent`, and the kit snapshots the row, evicts it, drops it from every
 * cached `itemsConnection` variant, and adjusts the list's counters — leaving
 * all of it in place, because the delete replays from the queue keyed by the
 * item's id.
 *
 * The snapshot is what makes this undoable at all. A withdrawal used to be a
 * bare evict with nothing to restore from, so a refused delete simply lost the
 * row: offline there is no read that could bring it back. It is also the case
 * that forced the kit to learn about existence — spelling a removal as a patch
 * with no fields made the reindexer ADD the row to every unfiltered variant.
 */

import { gql } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { RemoveItemFromShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { removeFromShoppingListItemsCache } from './utils';
import { useWrite } from '#/apollo/write/useWrite';
import { adjustBy, type WriteIntentDraft } from '#/apollo/write/writeIntent';
import { handleMutationError } from '#/utils/errorHandlers';
import { isNetworkError } from '#/utils/isNetworkError';
import { errorService } from '#/services/errorService';

/**
 * The purchased flag decides which counter moves, so it has to be read before
 * the row is evicted. Everything else the hook used to snapshot is the kit's
 * business now.
 */
const ITEM_STATE = gql`
  fragment _RemoveShoppingItemState on ShoppingListItem {
    purchaseInfo {
      isPurchased
    }
  }
`;

const LIST_STATS = gql`
  fragment _RemoveShoppingItemStats on ShoppingList {
    totalItems
    completedItems
  }
`;

/**
 * `completionRate` is DERIVED from the two counters, so it is the one aggregate
 * that cannot be a delta — a rate has no meaningful increment. It is written as
 * the value the counters imply after this removal, and the kit's inverse
 * restores the previous one.
 *
 * `reindex` states where the row WAS, not where it is going: a removal leaves
 * every variant regardless, but its UNDO has to know which variant to put it
 * back into. Left `{}`, a withdrawn delete restored the row into no list at
 * all.
 */
function removalIntent(
  itemId: string,
  listId: string,
  wasPurchased: boolean,
  stats: { totalItems: number; completedItems: number },
): WriteIntentDraft {
  const newTotal = Math.max(0, stats.totalItems - 1);
  const newCompleted = wasPurchased
    ? Math.max(0, stats.completedItems - 1)
    : stats.completedItems;

  return {
    target: { __typename: 'ShoppingListItem', id: itemId },
    lifecycle: 'remove',
    patch: {},
    // Relative, so a withdrawal cannot discard a count that moved meanwhile.
    aggregates: [
      {
        target: { __typename: 'ShoppingList', id: listId },
        patch: {
          totalItems: adjustBy(-1),
          ...(wasPurchased
            ? { completedItems: adjustBy(-1) }
            : { remainingItems: adjustBy(-1) }),
          completionRate: newTotal > 0 ? newCompleted / newTotal : 0,
        },
      },
    ],
    reindex: {
      parent: { __typename: 'ShoppingList', id: listId },
      field: 'itemsConnection',
      decidableFilters: ['isPurchased'],
      after: {},
      before: { isPurchased: wasPurchased },
    },
    // A delete is idempotent, so a replay re-sends it. The mutation carries no
    // version, so there is nothing for it to conflict on.
    convergence: 'absolute',
  };
}

interface UseRemoveShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<unknown>;
}

interface UseRemoveShoppingItemReturn {
  removeItem: (itemId: string) => Promise<unknown>;
}

export function useRemoveShoppingItem({
  listId,
  refetch,
}: UseRemoveShoppingItemOptions): UseRemoveShoppingItemReturn {
  const client = useApolloClient();
  const { apply } = useWrite();

  const [removeItemMutation] = useMutation(RemoveItemFromShoppingListDocument, {
    update(cache, { data }, { variables }) {
      // Re-evict on the server response: Apollo re-normalizes the
      // `shoppingListItem { id }` payload, which would otherwise resurrect the
      // (already removed) entity into its connection.
      if (
        data?.removeItemFromShoppingList?.__typename !==
          'RemoveItemFromShoppingListPayload' ||
        !listId ||
        !variables
      ) {
        return;
      }
      try {
        removeFromShoppingListItemsCache(cache, listId, variables.input.id, {
          evictItem: true,
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Cache cleanup failed for removeItem:',
        });
      }
    },
    onError: error => {
      // Network/transient error: queueLink queued the delete for replay — keep
      // the removal; do NOT restore.
      if (isNetworkError(error)) return;
      // Real (server/validation) error: the item still exists → restore.
      handleMutationError(error, { operation: 'Remove Shopping List Item' });
      refetch();
    },
  });

  const removeItem = async (itemId: string) => {
    if (!listId) return false;

    const itemState = client.cache.readFragment<{
      purchaseInfo: { isPurchased: boolean } | null;
    }>({
      id: client.cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
      fragment: ITEM_STATE,
      fragmentName: '_RemoveShoppingItemState',
    });
    const stats = client.cache.readFragment<{
      totalItems: number;
      completedItems: number;
    }>({
      id: client.cache.identify({ __typename: 'ShoppingList', id: listId }),
      fragment: LIST_STATS,
      fragmentName: '_RemoveShoppingItemStats',
    });

    const { context } = apply(
      removalIntent(
        itemId,
        listId,
        itemState?.purchaseInfo?.isPurchased ?? false,
        {
          totalItems: stats?.totalItems ?? 0,
          completedItems: stats?.completedItems ?? 0,
        },
      ),
    );

    try {
      return await removeItemMutation({
        variables: { input: { id: itemId } },
        context,
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Remove Shopping List Item error:',
      });
      return undefined;
    }
  };

  return { removeItem };
}
