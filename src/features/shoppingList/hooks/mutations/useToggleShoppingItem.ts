/**
 * useToggleShoppingItem - Toggle purchase status mutation for shopping list
 *
 * Optimistic pattern: apply the cache changes (flip purchaseInfo,
 * move between purchased/unpurchased connections, persist for offline)
 * synchronously *before* firing the mutation. On error, revert from
 * the snapshot. Apollo auto-normalizes the server's authoritative
 * payload on success. No `optimisticResponse` callback — masking stays
 * load-bearing and no `@unmask` is needed.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  ToggleShoppingListItemPurchasedDocument,
  GetShoppingListItemsFilteredDocument,
  type GetShoppingListItemsFilteredQuery,
  type GetShoppingListItemsFilteredQueryVariables,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseToggleShoppingItem_ItemFragmentDoc,
  type UseToggleShoppingItem_ItemFragment,
} from './useToggleShoppingItem.generated';
import {
  moveShoppingListItemToPurchased,
  moveShoppingListItemToUnpurchased,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { isNetworkError } from '#/utils/isNetworkError';
import {
  executeMutation,
  isSuccessPayload,
} from '#/utils/compilerSafeWrappers';
import { handleMutationError } from '#/utils/errorHandlers';
import { PAGINATION } from '#/constants/shoppingList';

interface UseToggleShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<unknown>;
}

/**
 * Hook for toggling the purchased status of shopping list items
 */
export function useToggleShoppingItem({
  listId,
  refetch,
}: UseToggleShoppingItemOptions) {
  const client = useApolloClient();

  const [togglePurchasedMutation] = useMutation(
    ToggleShoppingListItemPurchasedDocument,
  );

  const toggleItem = async (itemId: string) => {
    if (!listId) return false;

    const cacheId = client.cache.identify({
      __typename: 'ShoppingListItem',
      id: itemId,
    });
    if (!cacheId) return false;

    const snapshot =
      client.cache.readFragment<UseToggleShoppingItem_ItemFragment>({
        id: cacheId,
        fragment: UseToggleShoppingItem_ItemFragmentDoc,
        fragmentName: 'useToggleShoppingItem_item',
      });
    if (!snapshot) return false;

    const previousIsPurchased = snapshot.purchaseInfo?.isPurchased ?? false;
    const newStatus = !previousIsPurchased;
    const previousUpdatedAt = snapshot.updatedAt;

    // 1. Flip purchaseInfo + bump updatedAt on the entity
    client.cache.modify<UseToggleShoppingItem_ItemFragment>({
      id: cacheId,
      fields: {
        purchaseInfo(existing) {
          return { ...existing, isPurchased: newStatus };
        },
        updatedAt: () => new Date().toISOString(),
      },
    });

    // 2. Move the item between the purchased/unpurchased connections
    if (newStatus) {
      moveShoppingListItemToPurchased(client.cache, listId, { id: itemId });
    } else {
      moveShoppingListItemToUnpurchased(client.cache, listId, { id: itemId });
    }

    // 3. Persist optimistic state so it survives app restarts while offline
    const clearPersistence = optimisticDataPersistence.track(
      'ShoppingListItem',
      itemId,
      'isPurchased',
      newStatus,
    );

    const revert = () => {
      client.cache.modify<UseToggleShoppingItem_ItemFragment>({
        id: cacheId,
        fields: {
          purchaseInfo(existing) {
            return { ...existing, isPurchased: previousIsPurchased };
          },
          updatedAt: () => previousUpdatedAt,
        },
      });
      if (previousIsPurchased) {
        moveShoppingListItemToPurchased(client.cache, listId, { id: itemId });
      } else {
        moveShoppingListItemToUnpurchased(client.cache, listId, { id: itemId });
      }
      clearPersistence();
    };

    const result = await executeMutation(
      () =>
        togglePurchasedMutation({
          variables: { input: { id: itemId, purchased: newStatus } },
          onCompleted: () => {
            clearPersistence();

            // Depletion recovery: if the source connection (the tab we toggled
            // FROM) is now empty but totalCount > 0, server has unfetched
            // items — refetch.
            const sourceQuery = client.cache.readQuery<
              GetShoppingListItemsFilteredQuery,
              GetShoppingListItemsFilteredQueryVariables
            >({
              query: GetShoppingListItemsFilteredDocument,
              variables: {
                id: listId,
                first: PAGINATION.ITEMS_PAGE_SIZE,
                isPurchased: previousIsPurchased,
              },
            });
            const conn = sourceQuery?.shoppingList?.itemsConnection;
            if (conn && conn.edges.length === 0 && (conn.totalCount ?? 0) > 0) {
              refetch();
            }
          },
          onError: error => {
            // For network errors, the queue handles retry — keep optimistic
            // UI intact while offline.
            if (isNetworkError(error)) {
              console.log('Toggle purchase queued for retry (network error)');
              return;
            }

            revert();
            handleMutationError(error, { operation: 'Toggle Item Purchased' });
            refetch();
          },
        }),
      'Toggle shopping list item purchased error:',
    );
    if (!result) return false;

    const payload = result.data?.toggleShoppingListItemPurchased;
    return isSuccessPayload(payload, 'ToggleShoppingListItemPurchasedPayload')
      ? payload.shoppingListItem
      : false;
  };

  return { toggleItem };
}
