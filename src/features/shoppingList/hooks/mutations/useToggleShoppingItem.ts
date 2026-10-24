/**
 * Local-first: the flip, connection move and offline marker land before firing,
 * as an `optimisticResponse` rolls back on the queue's null result. `purchaseInfo`
 * goes through `writePurchaseInfo`, never `cache.modify` (write-time invariant).
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import {
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
import type { PurchasedItemInput } from '#/graphql/generated/schemaTypes';

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

  // An API unreachable while "online" queues for replay rather than raising a
  // blocking error. The server does not hold an update carrying only
  // `purchaseTracking` to its `version`, so a tick replays over a reorder.
  const [updatePurchaseMutation] = useMutation(UpdateShoppingListItemDocument, {
    context: { localFirst: true },
  });

  /**
   * `bought` names the product a tick bought when the line names a concept
   * above it (a store-mode scan), so its price lands on that product.
   */
  const toggleItem = async (itemId: string, bought?: PurchasedItemInput) => {
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

    const previousIsPurchased = snapshot.purchaseInfo.isPurchased;
    const newStatus = !previousIsPurchased;
    const previousUpdatedAt = snapshot.updatedAt;
    // The flip clears this, so the snapshot is its only record — a refusal that
    // cannot put it back offers move-to-pantry for an already-stocked line.
    const previousMovedToPantryAt =
      snapshot.purchaseInfo.movedToPantryAt ?? null;

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

    // Tracks `purchaseInfo`, not `isPurchased` inside it: restoration's
    // `cache.modify` ignores a modifier for a missing field, and shallow-merges
    // object values, so a partial `purchaseInfo` is enough.
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
      typeof updatePurchaseMutation
    >[0] = {
      variables: {
        input: {
          id: itemId,
          version: snapshot.version,
          // The flag alone: the server refuses amounts beside an un-tick.
          purchaseTracking: {
            isPurchased: newStatus,
            ...(newStatus && bought && { purchasedItem: bought }),
          },
        },
      },
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
      () => updatePurchaseMutation(togglePurchasedMutationOptions),
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
    if (settled.status === 'failed') return false;

    return appliedPayload(settled.data)?.shoppingListItem ?? false;
  };

  /**
   * `purchasedPrice` is PER UNIT: the server records it times the quantity as
   * `Purchase.totalPrice`. The sheet collects the TOTAL paid, so
   * `usePurchaseAmountModal` divides first; null records it unpriced.
   */
  const recordPurchase = async (
    itemId: string,
    amounts: { purchasedQuantity: number; purchasedPrice: number | null },
    bought?: PurchasedItemInput,
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

    const previousIsPurchased = snapshot.purchaseInfo.isPurchased;
    const previousUpdatedAt = snapshot.updatedAt;
    const previousMovedToPantryAt =
      snapshot.purchaseInfo.movedToPantryAt ?? null;
    const now = new Date().toISOString();

    // The entered amounts ride on the mutation's purchaseTracking; the detail
    // screen's cache-and-network query reflects the server's recorded values.
    writePurchaseInfo(
      client.cache,
      itemId,
      { isPurchased: true },
      { updatedAt: now },
    );
    // A row a collaborator already ticked is in the purchased counts.
    const counterChange = recordListCounters(client.cache, listId, () => {
      if (!previousIsPurchased) {
        moveShoppingListItemToPurchased(client.cache, listId, { id: itemId });
      }
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
            ...(bought && { purchasedItem: bought }),
          },
        },
      },
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
