import { useApolloClient, useMutation } from '@apollo/client/react';
import { MovePurchasedItemsToPantryDocument } from './useBatchMoveToPantry.generated';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { handleMutationError } from '#/utils/errorHandlers';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n';
import { getI18n } from '#/i18n/config';
import { errorService } from '#/services/errorService';
import { useWrite } from '#/apollo/write/useWrite';
import { revertIntent } from '#/apollo/write/applyIntent';
import { adjustBy, type WriteIntentDraft } from '#/apollo/write/writeIntent';
import {} from '#/apollo/utils/cacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { generateEntityId } from '#/utils/generateEntityId';

/**
 * One purchased row leaving the list, as a `WriteIntent`.
 *
 * `lifecycle: 'remove'` snapshots the row before taking it out, which is what
 * makes a batch move undoable at all: the old hand-rolled path removed the
 * edges with nothing able to put them back, so a replay refused after a restart
 * left those rows gone from the list and never in the pantry. Restoring them
 * needed a refetch, and offline there is none.
 *
 * The pantry side is deliberately absent — this mutation takes no `pantryId`,
 * so the client cannot know where the rows land. They appear when it syncs.
 */
function purchasedRemovalIntent(
  itemId: string,
  listId: string,
): WriteIntentDraft {
  return {
    target: { __typename: 'ShoppingListItem', id: itemId },
    lifecycle: 'remove',
    patch: {},
    // Every row here is purchased, so both counters move by one each.
    // Relative, so a withdrawal cannot discard a count that moved meanwhile.
    aggregates: [
      {
        target: { __typename: 'ShoppingList', id: listId },
        patch: { totalItems: adjustBy(-1), completedItems: adjustBy(-1) },
      },
    ],
    reindex: {
      parent: { __typename: 'ShoppingList', id: listId },
      field: 'itemsConnection',
      decidableFilters: ['isPurchased'],
      after: {},
      // Where the row was, so the UNDO can put it back — every row here is
      // purchased. A removal needs no membership statement to LEAVE; it needs
      // one to come BACK.
      before: { isPurchased: true },
    },
    // The move is idempotent on the item's id, so a replay re-sends it.
    convergence: 'absolute',
  };
}

interface UseBatchMoveToPantryOptions {
  currentListId: string | undefined;
  /**
   * The purchased rows, from the screen that already renders them.
   *
   * Passed in rather than re-read from cache: minting a client id per line
   * needs the exact set the user is looking at, and reconstructing it here
   * would mean matching the filtered connection's cached field key — which,
   * got subtly wrong, yields silently NO hints offline rather than a visible
   * failure.
   */
  purchasedItems: readonly { id: string }[];
  onSuccess?: () => void;
}

interface UseBatchMoveToPantryReturn {
  batchMoveToPantry: () => Promise<void>;
  loading: boolean;
}

export function useBatchMoveToPantry({
  currentListId,
  purchasedItems,
  onSuccess,
}: UseBatchMoveToPantryOptions): UseBatchMoveToPantryReturn {
  const client = useApolloClient();
  const { applyAll } = useWrite();
  const [movePurchasedMutation, { loading }] = useMutation(
    MovePurchasedItemsToPantryDocument,
    {
      onError: error => {
        handleMutationError(error, { operation: 'Batch Move to Pantry' });
      },
    },
  );

  const batchMoveToPantry = async () => {
    if (!currentListId) {
      toastService.error(t('moveToPantry.noListSelected'));
      return;
    }

    // One client-minted pantry-row id per purchased line. The server still
    // decides which lines are actually purchased — a hint for a line that is
    // no longer purchased is ignored, and a line with no hint gets a
    // server-minted id — so this is a hint, not an instruction.
    const idHints = purchasedItems.map(item => ({
      shoppingListItemId: item.id,
      pantryItemId: generateEntityId(),
      idempotencyKey: generateEntityId(),
    }));
    const movingIds = idHints.map(hint => hint.shoppingListItemId);

    // Only the shopping side is written eagerly. The pantry side cannot be:
    // this mutation takes no `pantryId`, so the client does not know which
    // pantry the rows will land in. They appear when the move syncs.
    //
    // ONE write over N entities: a mutation carries one context, so N separate
    // `apply` calls would send only the last intent to the queue and leave the
    // rest applied with nothing able to undo them.
    const { context, intents, revert } = applyAll(
      movingIds.map(id => purchasedRemovalIntent(id, currentListId)),
    );

    // Built outside the try: a `&&` spread is a value block, and one inside a
    // try body bails this whole hook out of the React Compiler.
    const moveInput =
      idHints.length > 0
        ? { shoppingListId: currentListId, pantryItemIds: idHints }
        : { shoppingListId: currentListId };

    let result;
    try {
      result = await movePurchasedMutation({
        variables: { input: moveInput },
        context,
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Batch move to pantry error:',
      });
    }

    const payload = result?.data?.movePurchasedItemsToPantry;

    // Queued (offline / API down): no summary to report, so speak from the
    // local count. The rows are already gone from the list.
    if (classifyCreateResult(result) === 'queued') {
      toastService.success(
        getI18n().t('moveToPantry.movedItems', {
          count: movingIds.length,
          skipped: '',
        }),
      );
      onSuccess?.();
      return;
    }

    if (payload?.__typename !== 'MovePurchasedItemsToPantryPayload') {
      // A resolved `*Error` union member doesn't throw under errorPolicy:'all',
      // so the mutation `onError` never fired for it. Surface it here — guarded
      // to skip the transport-error case (`result.error`), which onError already
      // alerted, so the two never double-alert.
      // Refused on the spot, so it never entered the queue and the queue's
      // withdrawal will never see it. Without this the rows stayed gone from
      // the list, absent from the pantry, with the snapshots that could restore
      // them discarded.
      revert();
      alertRejectedMutation(result, t('errors.codes.genericRetry'));
      return;
    }

    const movedCount = payload.summary.succeeded;
    const skippedCount = payload.summary.skipped;

    // Every row was taken out of the list before firing, but the server decides
    // which lines actually move — a line no longer purchased is SKIPPED. Put
    // those back: without this the toast says "2 moved, 1 skipped" over a list
    // that lost all three, and the skipped row is in neither place.
    const moved = new Set(
      payload.movedItems.map(item => item.shoppingListItemId),
    );
    for (const intent of intents) {
      if (!moved.has(intent.target.id)) revertIntent(client.cache, intent);
    }

    if (movedCount > 0) {
      const skipped =
        skippedCount > 0
          ? getI18n().t('moveToPantry.skippedSuffix', { skippedCount })
          : '';
      toastService.success(
        getI18n().t('moveToPantry.movedItems', { count: movedCount, skipped }),
      );
    } else {
      toastService.info(t('moveToPantry.noItemsMoved'));
    }

    Telemetry.trackEvent('batch_move_purchased_to_pantry', {
      shopping_list_id: currentListId,
      moved_count: movedCount,
      skipped_count: skippedCount,
    });

    onSuccess?.();
  };

  return {
    batchMoveToPantry,
    loading,
  };
}
