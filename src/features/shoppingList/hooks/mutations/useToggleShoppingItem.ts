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
import { settleMutation } from '#/apollo/utils/settleMutation';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import {
  UseToggleShoppingItem_ItemFragmentDoc,
  type UseToggleShoppingItem_ItemFragment,
} from './useToggleShoppingItem.generated';
import {
  moveShoppingListItemToPurchased,
  moveShoppingListItemToUnpurchased,
  recordListCounters,
  undoListCounters,
} from '#features/shoppingList/cache/connections';
import { writePurchaseInfo } from '#features/shoppingList/cache/purchase';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { PAGINATION } from '#features/shoppingList/utils/shoppingListConstants';

interface UseToggleShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<unknown>;
}

export function useToggleShoppingItem({
  listId,
  refetch,
}: UseToggleShoppingItemOptions) {
  const client = useApolloClient();
  const { t } = useTranslation();

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

    const counterChange = recordListCounters(client.cache, listId, () => {
      if (newStatus) {
        moveShoppingListItemToPurchased(client.cache, listId, { id: itemId });
      } else {
        moveShoppingListItemToUnpurchased(client.cache, listId, { id: itemId });
      }
    });

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
      // Every failure refetches, which also settles counters that cannot be exact.
      undoListCounters(client.cache, counterChange, () => {
        if (previousIsPurchased) {
          moveShoppingListItemToPurchased(client.cache, listId, { id: itemId });
        } else {
          moveShoppingListItemToUnpurchased(client.cache, listId, {
            id: itemId,
          });
        }
      });
      clearPersistence();
    };

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
        if (appliedPayload(data)) clearPersistence();

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
          void refetch().catch(error =>
            errorService.reportError(error, {
              operation: 'ToggleShoppingItem.refetch',
            }),
          );
        }
      },
    };
    // A queued toggle keeps the optimistic flip; a failure reverts it and
    // refetches, since the server's state is the one to show.
    const settled = await settleMutation(
      () => togglePurchasedMutation(togglePurchasedMutationOptions),
      {
        document: ToggleShoppingListItemPurchasedDocument,
        fallback: t('errors.updateItemFailed'),
        onFailed: () => {
          revert();
          void refetch().catch(error =>
            errorService.reportError(error, {
              operation: 'ToggleShoppingItem.refetch',
            }),
          );
        },
      },
    );
    if (settled.status === 'failed') return false;

    return appliedPayload(settled.data)?.shoppingListItem ?? false;
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
    const counterChange = recordListCounters(client.cache, listId, () => {
      moveShoppingListItemToPurchased(client.cache, listId, { id: itemId });
    });
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
      undoListCounters(client.cache, counterChange, () => {
        if (!previousIsPurchased) {
          moveShoppingListItemToUnpurchased(client.cache, listId, {
            id: itemId,
          });
        }
      });
      clearPersistence();
    };

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
        if (appliedPayload(data)) clearPersistence();
      },
    };
    const settled = await settleMutation(
      () => updatePurchaseMutation(updatePurchaseMutationOptions),
      {
        document: UpdateShoppingListItemDocument,
        fallback: t('errors.updateItemFailed'),
        onFailed: () => {
          revert();
          void refetch().catch(error =>
            errorService.reportError(error, {
              operation: 'ToggleShoppingItem.refetch',
            }),
          );
        },
      },
    );
    return settled.status !== 'failed';
  };

  return { toggleItem, recordPurchase };
}
