/**
 * useToggleShoppingItem — purchase-status writes for the shopping list.
 *
 * Both actions go through the declared write path: describe the change once as
 * a `WriteIntent`, let the kit apply it, invert it, and carry it to the queue.
 * The hook no longer owns a snapshot, a hand-written revert, a connection move,
 * a parent-stat recompute, a persistence marker, or the three-way branch over
 * queued / rejected / network results — all of which were the same shape at
 * every call site and drifted at each one.
 */

import { gql } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  ToggleShoppingListItemPurchasedDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { generateEntityId } from '#/utils/generateEntityId';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n';
import { useWrite } from '#/apollo/write/useWrite';
import { adjustBy, type WriteIntentDraft } from '#/apollo/write/writeIntent';
import { handleMutationError } from '#/utils/errorHandlers';
import { errorService } from '#/services/errorService';

interface UseToggleShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<unknown>;
}

/**
 * The change a purchase-status write makes, as data.
 *
 * `purchaseInfo` is patched as a partial object because the field the person
 * sees lives one level down; the kit shallow-merges it, so the rest of the
 * object survives both the write and its undo.
 *
 * `reindex` names `isPurchased` as the only filter it can decide, so a cached
 * variant filtered on anything else is left for its next read from the server
 * rather than guessed at.
 */
function purchaseIntent(
  itemId: string,
  listId: string,
  purchased: boolean,
): WriteIntentDraft {
  const delta = purchased ? 1 : -1;
  return {
    target: { __typename: 'ShoppingListItem', id: itemId },
    patch: {
      purchaseInfo: { isPurchased: purchased },
      updatedAt: new Date().toISOString(),
    },
    // Relative, so a withdrawal cannot discard a count that moved meanwhile.
    aggregates: [
      {
        target: { __typename: 'ShoppingList', id: listId },
        patch: {
          completedItems: adjustBy(delta),
          remainingItems: adjustBy(-delta),
        },
      },
    ],
    reindex: {
      parent: { __typename: 'ShoppingList', id: listId },
      field: 'itemsConnection',
      decidableFilters: ['isPurchased'],
      after: { isPurchased: purchased },
      before: { isPurchased: !purchased },
    },
    // The write carries a final state the person chose, so a version conflict
    // is resolved by re-sending against a fresh version rather than by
    // discarding what they did.
    convergence: 'absolute',
  };
}

/**
 * `UpdateShoppingListItemInput.version` is required, so the write has to carry
 * one. Read here rather than snapshotted: the kit owns the undo, and this is
 * the only field the call site still needs for itself.
 *
 * It is necessarily the version as of the tap — nothing can refresh it before a
 * queued replay — so a stale one is expected offline. The queue's conflict path
 * refreshes it and re-sends, which is what `convergence: 'absolute'` selects.
 */
const ITEM_STATE = gql`
  fragment ToggleShoppingItemState on ShoppingListItem {
    version
    purchaseInfo {
      isPurchased
    }
  }
`;

export function useToggleShoppingItem({
  listId,
  refetch,
}: UseToggleShoppingItemOptions) {
  const client = useApolloClient();
  const { apply } = useWrite();

  const readState = (itemId: string) =>
    client.cache.readFragment<{
      version?: number;
      purchaseInfo?: { isPurchased?: boolean } | null;
    }>({
      id: `ShoppingListItem:${itemId}`,
      fragment: ITEM_STATE,
      // A row cached without its purchaseInfo still yields a version, and the
      // toggle should flip from the default rather than refuse.
      returnPartialData: true,
    });
  const [togglePurchasedMutation] = useMutation(
    ToggleShoppingListItemPurchasedDocument,
  );
  // Recording a purchase WITH amounts goes through updateShoppingListItem — the
  // toggle input cannot carry purchaseTracking.
  const [updatePurchaseMutation] = useMutation(UpdateShoppingListItemDocument);

  const toggleItem = async (itemId: string) => {
    if (!listId) return false;
    const state = readState(itemId);
    if (!state) return false;

    // A toggle flips what is there — reading the current value is the whole
    // operation, not an optimisation.
    const purchased = !(state.purchaseInfo?.isPurchased ?? false);
    const { context, revert } = apply(
      purchaseIntent(itemId, listId, purchased),
    );

    let result;
    try {
      result = await togglePurchasedMutation({
        variables: { input: { id: itemId, purchased } },
        context,
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Toggle shopping list item purchased',
      });
      return false;
    }

    // A refusal RESOLVES under the global `errorPolicy: 'all'`, so the outcome
    // is read off the result rather than left to `onError`. The kit's
    // withdrawal path owns the undo — including after a restart, which a
    // closure here could not survive.
    // `result.error` is tested FIRST, and the order is load-bearing:
    // `classifyCreateResult` returns 'rejected' for a transport error too, and
    // `alertRejectedMutation` deliberately no-ops when `result.error` is set —
    // so classifying first makes this branch unreachable and a transport
    // failure reverts the change and says NOTHING. This hook keeps no
    // `useMutation` onError, so this is the only place that reports it.
    if (result.error) {
      revert();
      handleMutationError(result.error, { operation: 'Toggle Item Purchased' });
      return false;
    }
    if (classifyCreateResult(result) === 'rejected') {
      revert();
      alertRejectedMutation(result, t('errors.updateItemFailed'));
      return false;
    }
    return true;
  };

  /**
   * Mark an item purchased AND record what the person actually paid.
   *
   * `purchasedPrice` is PER UNIT: the server records
   * `Purchase.totalPrice = purchasedPrice × purchasedQuantity`, and
   * move-to-pantry derives its per-unit cost from that. The Mark Purchased
   * sheet collects the total; `usePurchaseAmountModal` divides before calling.
   */
  const recordPurchase = async (
    itemId: string,
    amounts: { purchasedQuantity: number; purchasedPrice: number | null },
  ) => {
    if (!listId) return false;
    const state = readState(itemId);
    if (!state) return false;

    // Recording a purchase always marks purchased — it is not a toggle.
    const { context, revert } = apply(purchaseIntent(itemId, listId, true));

    // Built above the try: a value block (`??`, `&&`, `?.`, a ternary) inside a
    // try body bails the React Compiler out of the whole function, and this
    // project's bailout baseline is empty.
    const purchaseTracking = {
      isPurchased: true,
      purchasedQuantity: amounts.purchasedQuantity,
      ...(amounts.purchasedPrice != null && {
        purchasedPrice: amounts.purchasedPrice,
      }),
    };
    const version = state.version ?? 0;
    // Claimed by the server BEFORE its version check, so a queued replay
    // converges instead of being refused on the stale version it carries.
    const idempotencyKey = generateEntityId();

    let result;
    try {
      result = await updatePurchaseMutation({
        variables: {
          input: { id: itemId, version, purchaseTracking, idempotencyKey },
        },
        context,
      });
    } catch (error) {
      errorService.reportError(error, { operation: 'Record purchase' });
      return false;
    }

    // `result.error` is tested FIRST, and the order is load-bearing:
    // `classifyCreateResult` returns 'rejected' for a transport error too, and
    // `alertRejectedMutation` deliberately no-ops when `result.error` is set —
    // so classifying first makes this branch unreachable and a transport
    // failure reverts the change and says NOTHING. This hook keeps no
    // `useMutation` onError, so this is the only place that reports it.
    if (result.error) {
      revert();
      handleMutationError(result.error, { operation: 'Record Purchase' });
      return false;
    }
    if (classifyCreateResult(result) === 'rejected') {
      revert();
      alertRejectedMutation(result, t('errors.updateItemFailed'));
      return false;
    }
    return true;
  };

  return { toggleItem, recordPurchase, refetch };
}
