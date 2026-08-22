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
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n';
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
import { isSuccessPayload } from '#/utils/errors/mutationPayload';
import { handleMutationError } from '#/utils/errorHandlers';
import { PAGINATION } from '#/constants/shoppingList';
import { errorService } from '#/services/errorService';

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

    // 3. Persist optimistic state so it survives app restarts while offline.
    //    The persisted field name must be a field the entity actually has:
    //    `isPurchased` lives inside `purchaseInfo`, and `cache.modify` silently
    //    ignores a modifier for a field the entity does not have — so persisting
    //    it under `isPurchased` restored nothing at all. Restoration
    //    shallow-merges object values, so a partial `purchaseInfo` is enough.
    const clearPersistence = optimisticDataPersistence.track(
      'ShoppingListItem',
      itemId,
      'purchaseInfo',
      { isPurchased: newStatus },
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

    let result;
    const togglePurchasedMutationOptions: Parameters<
      typeof togglePurchasedMutation
    >[0] = {
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
    };
    try {
      result = await togglePurchasedMutation(togglePurchasedMutationOptions);
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Toggle shopping list item purchased error:',
      });
    }
    if (!result) return false;

    // A resolved error-union member (ValidationError/ConflictError/…) doesn't
    // fire the mutation `onError`, so surface + revert it here — same
    // post-result guard recordPurchase uses. When `result.error` is set,
    // `onError` already ran and decided (network errors keep the flip for the
    // queue's retry; other errors reverted + alerted) — don't second-guess it.
    // 'queued' (null payload, offline) keeps the optimistic flip.
    if (!result.error && classifyCreateResult(result) === 'rejected') {
      revert();
      alertRejectedMutation(result, t('errors.updateItemFailed'));
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
   *
   * `purchasedPrice` is PER UNIT: the server records
   * `Purchase.totalPrice = purchasedPrice × purchasedQuantity`, and move-to-pantry
   * derives its per-unit cost from it. The Mark Purchased sheet collects the
   * total paid; `usePurchaseAmountModal` divides before calling this.
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
      'purchaseInfo',
      { isPurchased: true },
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

    let result;
    const updatePurchaseMutationOptions: Parameters<
      typeof updatePurchaseMutation
    >[0] = {
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
    };
    try {
      result = await updatePurchaseMutation(updatePurchaseMutationOptions);
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Record purchase error:',
      });
    }
    if (!result) return false;

    // Same contract as toggleItem's guard: only handle the resolved
    // error-union case here; `result.error` was already routed by `onError`.
    if (!result.error && classifyCreateResult(result) === 'rejected') {
      revert();
      alertRejectedMutation(result, t('errors.updateItemFailed'));
      return false;
    }
    return true;
  };

  return { toggleItem, recordPurchase };
}
