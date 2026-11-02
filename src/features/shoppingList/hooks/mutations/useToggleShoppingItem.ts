/**
 * Local-first: the flip and its connection move are held until the server
 * answers. `purchaseInfo` goes through `writePurchaseInfo`, never `cache.modify`
 * (write-time invariant).
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  UpdateShoppingListItemDocument,
  GetShoppingListItemsFilteredDocument,
  type GetShoppingListItemsFilteredQuery,
  type GetShoppingListItemsFilteredQueryVariables,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import type { UpdateRowInputs } from '#features/shoppingList/offline/localWrites';
import { errorService } from '#/services/errorService';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';
import {
  UseToggleShoppingItem_ItemFragmentDoc,
  type UseToggleShoppingItem_ItemFragment,
} from './useToggleShoppingItem.generated';
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

  // A tick that cannot be sent says so as a refused one does, so a false
  // answer has always told the user.
  const unsent = (): false => {
    alertService.alert(t('labels.error'), t('errors.updateItemFailed'));
    return false;
  };

  /**
   * Sets a line's purchase state to `wanted`, or flips it when null. A line
   * already in that state is written nothing ahead, and the server answers a
   * bare claim of the state it holds with no write. `bought` names the product
   * a tick bought when the line names a concept above it (a store-mode scan),
   * so its price lands on that product.
   */
  const setPurchased = async (
    itemId: string,
    wanted: boolean | null,
    bought?: PurchasedItemInput,
  ) => {
    if (!listId) return unsent();

    const cacheId = client.cache.identify({
      __typename: 'ShoppingListItem',
      id: itemId,
    });
    if (!cacheId) return unsent();

    const snapshot =
      client.cache.readFragment<UseToggleShoppingItem_ItemFragment>({
        id: cacheId,
        fragment: UseToggleShoppingItem_ItemFragmentDoc,
        fragmentName: 'useToggleShoppingItem_item',
        optimistic: true,
      });
    if (!snapshot) return unsent();

    const previousIsPurchased = snapshot.purchaseInfo.isPurchased;
    const newStatus = wanted ?? !previousIsPurchased;

    // Depletion recovery: an empty source connection with totalCount > 0 means
    // the server holds unfetched items for the tab we toggled FROM.
    const recoverDepletedTab = () => {
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
        optimistic: true,
      });
      const conn = sourceQuery?.shoppingList?.itemsConnection;
      if (conn && conn.edges.length === 0 && (conn.totalCount ?? 0) > 0) {
        void refetch().catch(error =>
          errorService.reportError(error, {
            operation: 'ToggleShoppingItem.refetch',
          }),
        );
      }
    };
    const inputs: UpdateRowInputs = {
      purchase: {
        listId,
        isPurchased: newStatus,
        now: new Date().toISOString(),
      },
    };
    // A queued toggle keeps the flip; a refused one drops it.
    const settled = await pendingWritesOf(client.cache).send(
      UpdateShoppingListItemDocument,
      {
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
      write =>
        settleMutation(
          () =>
            updatePurchaseMutation({
              ...write,
              onCompleted: recoverDepletedTab,
            }),
          {
            document: UpdateShoppingListItemDocument,
            fallback: t('errors.updateItemFailed'),
          },
        ),
      inputs,
    );
    if (settled.status === 'failed') return false;
    // Queued is not a failure: the flip stands and replays.
    if (settled.status === 'queued') return true;

    return appliedPayload(settled.data)?.shoppingListItem ?? false;
  };

  const toggleItem = (itemId: string, bought?: PurchasedItemInput) =>
    setPurchased(itemId, null, bought);

  /** Puts a line in the cart and never takes it out, however often it is sent. */
  const claimPurchased = (itemId: string, bought?: PurchasedItemInput) =>
    setPurchased(itemId, true, bought);

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
    if (!listId) return unsent();

    const cacheId = client.cache.identify({
      __typename: 'ShoppingListItem',
      id: itemId,
    });
    if (!cacheId) return unsent();

    const snapshot =
      client.cache.readFragment<UseToggleShoppingItem_ItemFragment>({
        id: cacheId,
        fragment: UseToggleShoppingItem_ItemFragmentDoc,
        fragmentName: 'useToggleShoppingItem_item',
        optimistic: true,
      });
    if (!snapshot) return unsent();

    const inputs: UpdateRowInputs = {
      purchase: { listId, isPurchased: true, now: new Date().toISOString() },
    };
    // The entered amounts ride on the mutation's purchaseTracking; the detail
    // screen's cache-and-network query reflects the server's recorded values.
    const settled = await pendingWritesOf(client.cache).send(
      UpdateShoppingListItemDocument,
      {
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
      write =>
        settleMutation(() => updatePurchaseMutation(write), {
          document: UpdateShoppingListItemDocument,
          fallback: t('errors.updateItemFailed'),
        }),
      inputs,
    );
    return settled.status !== 'failed';
  };

  return { toggleItem, claimPurchased, recordPurchase };
}
