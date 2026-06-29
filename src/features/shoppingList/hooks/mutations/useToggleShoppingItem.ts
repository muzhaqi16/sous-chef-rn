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
  UpdateShoppingListItemDocument,
  GetShoppingListItemsFilteredDocument,
  type GetShoppingListItemsFilteredQuery,
  type GetShoppingListItemsFilteredQueryVariables,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
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
import { logger } from '#/utils/environment';
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

  // Recording a purchase WITH amounts goes through updateShoppingListItem — the
  // toggle input can't carry purchaseTracking. Offline-capable: UpdateShoppingListItem
  // replays via SyncShoppingListItem, which forwards purchaseTracking.
  const [updatePurchaseMutation] = useMutation(UpdateShoppingListItemDocument);

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
          // Local-first: if the API is unreachable while "online", queueLink
          // queues this for replay (toggle is idempotent on a real id) instead
          // of surfacing a blocking error. Offline already queues via queueLink.
          context: { localFirst: true },
          onCompleted: data => {
            // Drop the offline-survival marker only once the server confirms;
            // a queued completion resolves with a null payload — keep it so the
            // optimistic state survives an app-kill before replay.
            if (
              isSuccessPayload(
                data?.toggleShoppingListItemPurchased,
                'ToggleShoppingListItemPurchasedPayload',
              )
            ) {
              clearPersistence();
            }

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
              logger.debug('Toggle purchase queued for retry (network error)');
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

    // A resolved error-union member (ValidationError/ConflictError/…) doesn't
    // fire the mutation `onError`, so revert here — same post-result guard
    // recordPurchase uses. 'queued' (null payload, offline) keeps the optimistic
    // flip; only 'rejected' rolls back.
    if (
      classifyCreateResult(
        result,
        'toggleShoppingListItemPurchased',
        'ToggleShoppingListItemPurchasedPayload',
      ) === 'rejected'
    ) {
      revert();
      return false;
    }

    const payload = result.data?.toggleShoppingListItemPurchased;
    return isSuccessPayload(payload, 'ToggleShoppingListItemPurchasedPayload')
      ? payload.shoppingListItem
      : false;
  };

  /**
   * Mark an item purchased AND record the actual quantity/price the user entered
   * at purchase time. Mirrors toggleItem's optimistic move-to-purchased +
   * offline persistence, but fires updateShoppingListItem with `purchaseTracking`
   * (the toggle input can't carry amounts). `purchasedPrice` is omitted when null
   * so the server falls back to its own auto-derivation.
   */
  const recordPurchase = async (
    itemId: string,
    amounts: { purchasedQuantity: number; purchasedPrice: number | null },
  ) => {
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
    const previousUpdatedAt = snapshot.updatedAt;
    const now = new Date().toISOString();

    // 1. Optimistically mark purchased (same as toggleItem). The entered amounts
    //    ride on the mutation's purchaseTracking; the detail screen's
    //    cache-and-network query reflects the server's recorded values.
    client.cache.modify<UseToggleShoppingItem_ItemFragment>({
      id: cacheId,
      fields: {
        purchaseInfo(existing) {
          return { ...existing, isPurchased: true };
        },
        updatedAt: () => now,
      },
    });
    moveShoppingListItemToPurchased(client.cache, listId, { id: itemId });
    const clearPersistence = optimisticDataPersistence.track(
      'ShoppingListItem',
      itemId,
      'isPurchased',
      true,
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
      if (!previousIsPurchased) {
        moveShoppingListItemToUnpurchased(client.cache, listId, { id: itemId });
      }
      clearPersistence();
    };

    const result = await executeMutation(
      () =>
        updatePurchaseMutation({
          variables: {
            input: {
              id: itemId,
              version: snapshot.version,
              purchaseTracking: {
                isPurchased: true,
                purchasedQuantity: amounts.purchasedQuantity,
                ...(amounts.purchasedPrice != null && {
                  purchasedPrice: amounts.purchasedPrice,
                }),
              },
            },
          },
          context: { localFirst: true },
          onCompleted: data => {
            if (
              isSuccessPayload(
                data?.updateShoppingListItem,
                'UpdateShoppingListItemPayload',
              )
            ) {
              clearPersistence();
            }
          },
          onError: error => {
            if (isNetworkError(error)) {
              logger.debug('Record purchase queued for retry (network error)');
              return;
            }
            revert();
            handleMutationError(error, { operation: 'Record Purchase' });
            refetch();
          },
        }),
      'Record purchase error:',
    );
    if (!result) return false;

    if (
      classifyCreateResult(
        result,
        'updateShoppingListItem',
        'UpdateShoppingListItemPayload',
      ) === 'rejected'
    ) {
      revert();
      return false;
    }
    return true;
  };

  return { toggleItem, recordPurchase };
}
