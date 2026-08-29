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
import { ToggleShoppingListItemPurchasedDocument } from '#features/shoppingList/graphql/shoppingList.generated';
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
 * A toggle flips what is there, so the current flag IS the operation — reading
 * it is not an optimisation.
 *
 * No version: `ToggleShoppingListItemPurchasedInput` carries none. Replay
 * safety comes from the idempotency key instead, claimed before the transition
 * is performed.
 */
const ITEM_STATE = gql`
  fragment ToggleShoppingItemState on ShoppingListItem {
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
      purchaseInfo?: { isPurchased?: boolean } | null;
    }>({
      id: `ShoppingListItem:${itemId}`,
      fragment: ITEM_STATE,
      // A row cached without its purchaseInfo still identifies an item that
      // exists; the toggle flips from the default rather than refusing.
      returnPartialData: true,
    });
  const [togglePurchasedMutation] = useMutation(
    ToggleShoppingListItemPurchasedDocument,
  );

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

    // Replay-safe in BOTH directions only because of this key, and the schema
    // says so outright. Marking converges without one (a row already purchased
    // comes back unchanged), but un-marking resets the line's quantity and
    // clears its normalized quantity and unit — so a queued un-mark draining
    // after a co-shopper re-purchased the line would overwrite that. The key is
    // claimed as the first statement of the transaction that performs the
    // transition, before any of that state is read, which is what makes the
    // un-mark queueable at all.
    //
    // The line's own `isPurchased` cannot stand in for it: an un-mark clears
    // the flag, so "not purchased" answers both "never applied" and "applied
    // and then deliberately reversed".
    const idempotencyKey = generateEntityId();

    let result;
    try {
      result = await togglePurchasedMutation({
        variables: { input: { id: itemId, purchased, idempotencyKey } },
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
    //
    // The amounts ride the TOGGLE now. It is the one route for this transition
    // — it writes the Purchase row, the price observation and the summary
    // counters together, so a count never stands without the history behind it
    // — and `updateShoppingListItem` no longer carries them at all.
    const input = {
      id: itemId,
      purchased: true,
      purchasedQuantity: amounts.purchasedQuantity,
      ...(amounts.purchasedPrice != null && {
        purchasedPrice: amounts.purchasedPrice,
      }),
      idempotencyKey: generateEntityId(),
    };

    let result;
    try {
      result = await togglePurchasedMutation({
        variables: { input },
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
