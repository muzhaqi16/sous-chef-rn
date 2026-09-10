/**
 * Local-first: the flip, the connection move and the offline marker land in the
 * cache before firing — an `optimisticResponse` rolls back on the queue's null
 * result. `purchaseInfo` carries a write-time invariant in its merge policy, so it
 * goes through `writePurchaseInfo` (cache.writeFragment), never `cache.modify`.
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
} from '#features/shoppingList/cache/connections';
import { writePurchaseInfo } from '#features/shoppingList/cache/purchase';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { isNetworkError } from '#/utils/isNetworkError';
import { logger } from '#/utils/environment';
import { isSuccessPayload } from '#/utils/errors/mutationPayload';
import { handleMutationError } from '#/utils/errorHandlers';
import { PAGINATION } from '#features/shoppingList/utils/shoppingListConstants';
import { errorService } from '#/services/errorService';

interface UseToggleShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<unknown>;
}

export function useToggleShoppingItem({
  listId,
  refetch,
}: UseToggleShoppingItemOptions) {
  const client = useApolloClient();

  const [togglePurchasedMutation] = useMutation(
    ToggleShoppingListItemPurchasedDocument,
  );

  // Amounts go through updateShoppingListItem — the toggle input can't carry
  // purchaseTracking. Its replay fragment SyncShoppingListItem forwards it.
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
    // The flip clears this, so the snapshot is its only record — a refusal that
    // cannot put it back offers move-to-pantry for an already-stocked line.
    const previousMovedToPantryAt =
      snapshot.purchaseInfo?.movedToPantryAt ?? null;

    writePurchaseInfo(
      client.cache,
      itemId,
      { isPurchased: newStatus },
      { updatedAt: new Date().toISOString() },
    );

    if (newStatus) {
      moveShoppingListItemToPurchased(client.cache, listId, { id: itemId });
    } else {
      moveShoppingListItemToUnpurchased(client.cache, listId, { id: itemId });
    }

    // Survives an app restart while offline. The tracked field must be one the
    // entity actually has (`isPurchased` lives inside `purchaseInfo`) — restoration
    // goes through `cache.modify`, which ignores a modifier for a missing field.
    // It shallow-merges object values, so a partial `purchaseInfo` is enough.
    const clearPersistence = optimisticDataPersistence.track(
      'ShoppingListItem',
      itemId,
      'purchaseInfo',
      { isPurchased: newStatus },
    );

    const revert = () => {
      writePurchaseInfo(
        client.cache,
        itemId,
        {
          isPurchased: previousIsPurchased,
          movedToPantryAt: previousMovedToPantryAt,
        },
        // Restoring, not flipping: the server never saw the change and still holds
        // the stamp, which a flip would clear again over the snapshot's value.
        { updatedAt: previousUpdatedAt, restoring: true },
      );
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
      // An API unreachable while "online" queues for replay rather than raising a
      // blocking error; the toggle is idempotent on a real id.
      context: { localFirst: true },
      onCompleted: data => {
        // Drop the offline marker only once the server confirms — a queued
        // completion resolves with a null payload and must keep it.
        if (
          isSuccessPayload(
            data?.toggleShoppingListItemPurchased,
            'ToggleShoppingListItemPurchasedPayload',
          )
        ) {
          clearPersistence();
        }

        // Depletion recovery: an empty source connection with totalCount > 0 means
        // the server holds unfetched items for the tab we toggled FROM.
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
        // The queue handles the retry — keep the optimistic UI while offline.
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

    // A refusal arrives as DATA under errorPolicy:'all' and never fires `onError`,
    // so revert it here. A set `result.error` was already routed by `onError`, and
    // 'queued' (null payload, offline) keeps the optimistic flip.
    if (!result.error && classifyCreateResult(result) === 'rejected') {
      revert();
      // A field-attributed ValidationError routes to LOCALIZED `errors.field.*`
      // copy; the copy below is the fallback. The server's `message` is never shown.
      alertRejectedMutation(result, t('errors.updateItemFailed'));
      return false;
    }

    const payload = result.data?.toggleShoppingListItemPurchased;
    return isSuccessPayload(payload, 'ToggleShoppingListItemPurchasedPayload')
      ? payload.shoppingListItem
      : false;
  };

  /**
   * `purchasedPrice` is PER UNIT — the server records
   * `Purchase.totalPrice = purchasedPrice × purchasedQuantity` and move-to-pantry
   * derives its per-unit cost from it. The Mark Purchased sheet collects the TOTAL
   * paid, so `usePurchaseAmountModal` divides first; null omits it (server derives).
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
    const previousMovedToPantryAt =
      snapshot.purchaseInfo?.movedToPantryAt ?? null;
    const now = new Date().toISOString();

    // The entered amounts ride on the mutation's purchaseTracking; the detail
    // screen's cache-and-network query reflects the server's recorded values.
    writePurchaseInfo(
      client.cache,
      itemId,
      { isPurchased: true },
      { updatedAt: now },
    );
    moveShoppingListItemToPurchased(client.cache, listId, { id: itemId });
    const clearPersistence = optimisticDataPersistence.track(
      'ShoppingListItem',
      itemId,
      'purchaseInfo',
      { isPurchased: true },
    );

    const revert = () => {
      writePurchaseInfo(
        client.cache,
        itemId,
        {
          isPurchased: previousIsPurchased,
          movedToPantryAt: previousMovedToPantryAt,
        },
        { updatedAt: previousUpdatedAt, restoring: true },
      );
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

    // Same contract as toggleItem's guard: only the resolved refusal is handled
    // here, and a field-specific ValidationError routes to `errors.field.*`.
    if (!result.error && classifyCreateResult(result) === 'rejected') {
      revert();
      alertRejectedMutation(result, t('errors.updateItemFailed'));
      return false;
    }
    return true;
  };

  return { toggleItem, recordPurchase };
}
