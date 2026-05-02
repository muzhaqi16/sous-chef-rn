/**
 * useToggleShoppingItem - Toggle purchase status mutation for shopping list
 *
 * Single responsibility:
 * - Toggle mutation with optimistic response
 * - Move items between purchased/unpurchased connections
 * - Persist optimistic state for offline support
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import {
  ToggleShoppingListItemPurchasedDocument,
  GetShoppingListItemsFilteredDocument,
  type ToggleShoppingListItemPurchasedMutation,
  type GetShoppingListItemsFilteredQuery,
  type GetShoppingListItemsFilteredQueryVariables,
} from '../../../graphql/operations/shoppingList/shoppingList.generated';
import {
  ShoppingListItemDisplayFragmentDoc,
  type ShoppingListItemDisplayFragment,
} from '#operations/shoppingList/shoppingListFragments.generated';
import { useErrorService } from '#/services/errorService';
import {
  moveShoppingListItemToPurchased,
  moveShoppingListItemToUnpurchased,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { isNetworkError } from '#/utils/isNetworkError';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { PAGINATION } from '#/constants/shoppingList';

interface UseToggleShoppingItemOptions {
  listId: string | null | undefined;
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
export function useToggleShoppingItem({
  listId,
  refetch,
}: UseToggleShoppingItemOptions) {
  const { handleApolloError } = useErrorService();
  const client = useApolloClient();

  const [togglePurchasedMutation] = useMutation(
    ToggleShoppingListItemPurchasedDocument,
    {
      // Optimistic response ensures update() runs immediately (not after network response)
      optimisticResponse: (variables, { IGNORE }) => {
        const item = client.cache.readFragment<ShoppingListItemDisplayFragment>(
          {
            id: client.cache.identify({
              __typename: 'ShoppingListItem',
              id: variables.input.id,
            }),
            fragment: ShoppingListItemDisplayFragmentDoc,
            fragmentName: 'ShoppingListItemDisplayFragment',
          },
        );
        if (!item) return IGNORE;
        const optimistic: ToggleShoppingListItemPurchasedMutation = {
          __typename: 'Mutation',
          toggleShoppingListItemPurchased: {
            __typename: 'ShoppingListItemPayload',
            success: true,
            message: '',
            code: 'SUCCESS',
            shoppingListItem: {
              ...item,
              purchaseInfo: {
                __typename: 'ShoppingListItemPurchaseInfo',
                isPurchased: variables.input.purchased,
              },
              updatedAt: new Date().toISOString(),
            },
          },
        };
        return optimistic;
      },
      update(cache, _result, { variables }) {
        if (!variables || !listId) return;

        const itemId = variables.input.id;
        const newStatus = variables.input.purchased; // true = marking purchased, false = marking unpurchased

        // 1. Update the item's purchaseInfo field directly
        cache.modify<ShoppingListItemDisplayFragment>({
          id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
          fields: {
            purchaseInfo(existingPurchaseInfo) {
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

        // Depletion recovery: if the source connection (the tab we toggled FROM)
        // is now empty but totalCount > 0, server has unfetched items — refetch.
        // Only fires when online (server responded), safe for offline-first.
        if (listId && item) {
          const sourceIsPurchased = !item.purchaseInfo?.isPurchased;
          const sourceQuery = client.cache.readQuery<
            GetShoppingListItemsFilteredQuery,
            GetShoppingListItemsFilteredQueryVariables
          >({
            query: GetShoppingListItemsFilteredDocument,
            variables: {
              id: listId,
              first: PAGINATION.ITEMS_PAGE_SIZE,
              isPurchased: sourceIsPurchased,
            },
          });
          const conn = sourceQuery?.shoppingList?.itemsConnection;
          if (conn && conn.edges.length === 0 && (conn.totalCount ?? 0) > 0) {
            refetch();
          }
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
        alertService.alert('Error', message);
        refetch();
      },
    },
  );

  const toggleItem = async (itemId: string) => {
    if (!listId) return false;

    const item = client.cache.readFragment<ShoppingListItemDisplayFragment>({
      id: client.cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
      fragment: ShoppingListItemDisplayFragmentDoc,
      fragmentName: 'ShoppingListItemDisplayFragment',
    });
    if (!item) return false;

    const newStatus = !item.purchaseInfo?.isPurchased;

    const result = await executeMutation(
      () =>
        togglePurchasedMutation({
          variables: { input: { id: itemId, purchased: newStatus } },
        }),
      'Toggle shopping list item purchased error:',
    );
    if (!result) return false;

    return (
      result.data?.toggleShoppingListItemPurchased?.shoppingListItem ?? false
    );
  };

  return { toggleItem };
}
