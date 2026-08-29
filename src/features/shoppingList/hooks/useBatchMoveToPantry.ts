import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import {
  BatchMoveStockedFragmentDoc,
  MovePurchasedItemsToPantryDocument,
} from './useBatchMoveToPantry.generated';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { handleMutationError } from '#/utils/errorHandlers';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n';
import { errorService } from '#/services/errorService';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { generateEntityId } from '#/utils/generateEntityId';

/**
 * Mark the moved lines as stocked, so their rows stop offering an action that
 * would now do nothing.
 *
 * The server keeps the lines and stamps them; without this the rows keep the
 * move-to-pantry button until the next fetch. Safe against the
 * `ShoppingListItemPurchaseInfo` merge, which clears omitted fields only when
 * `isPurchased` CHANGES — these lines are purchased before and after, so the
 * write takes the `mergeObjects` path and touches nothing else.
 *
 * The timestamp is a local placeholder: the field is read as "is this stocked",
 * and the server's own value replaces it on the next fetch.
 */
function markMovedLinesStocked(cache: ApolloCache, ids: string[]): void {
  const stampedAt = new Date().toISOString();
  for (const id of ids) {
    const cacheId = cache.identify({ __typename: 'ShoppingListItem', id });
    if (!cacheId) continue;
    cache.writeFragment({
      id: cacheId,
      fragment: BatchMoveStockedFragmentDoc,
      fragmentName: 'BatchMoveStocked',
      data: {
        __typename: 'ShoppingListItem',
        id,
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: true,
          movedToPantryAt: stampedAt,
        },
      },
    });
  }
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
  const [movePurchasedMutation, { loading }] = useMutation(
    MovePurchasedItemsToPantryDocument,
    {
      // No `update` callback, and nothing written before firing either.
      //
      // `movePurchasedItemsToPantry` NEVER removes the lines it moves — they
      // stay in the purchased section, and clearing them is
      // `deleteShoppingListItems(purchased: true)`, a separate act the user
      // confirms. So there is nothing here for the client to take out of the
      // list: this used to filter the purchased edges, decrement `totalItems`,
      // `completedItems` and the connection's `totalCount`, and evict the
      // `ShoppingListItem` entities — all of which contradicted the server and
      // came back on the next fetch.
      //
      // The pantry side is not written either: the mutation carries no
      // `pantryId`, so the client cannot know which pantry the rows land in.
      // The pantry query picks them up on its next fetch.
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

    // Nothing is written eagerly, and nothing is written on the response — the
    // server keeps every line it moves (see the `useMutation` comment above).
    //
    // Even if it removed them, an eager removal here would be aimed at the wrong
    // set: `purchasedItems` is the paginated, search-filtered slice the user can
    // see, while the input carries only `shoppingListId`, so the server acts on
    // EVERY purchased row.

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
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Batch move to pantry error:',
      });
    }

    const payload = result?.data?.movePurchasedItemsToPantry;

    // Queued (offline / API down): there is no summary, and the client cannot
    // know how many rows the server will move — `purchasedItems` is only the
    // slice on screen. Say the move is pending rather than reporting a count
    // that is right only when the whole list happens to be loaded.
    if (classifyCreateResult(result) === 'queued') {
      toastService.success(t('moveToPantry.queued'));
      onSuccess?.();
      return;
    }

    if (payload?.__typename !== 'MovePurchasedItemsToPantryPayload') {
      // A resolved `*Error` union member doesn't throw under errorPolicy:'all',
      // so the mutation `onError` never fired for it. Surface it here — guarded
      // to skip the transport-error case (`result.error`), which onError already
      // alerted, so the two never double-alert.
      alertRejectedMutation(result, t('errors.codes.genericRetry'));
      return;
    }

    // Three outcomes, and they mean different things to the user:
    //   succeeded — lines THIS call moved
    //   skipped   — lines an earlier call had already moved (already stocked)
    //   failed    — lines that errored, itemised in `failedItems`
    // A repeat call on an unchanged list reports `succeeded: 0`, which is the
    // honest answer rather than the same count forever.
    // Every line the payload lists is now in the pantry — the ones this call
    // moved and the ones it found already there.
    try {
      markMovedLinesStocked(
        client.cache,
        payload.movedItems.map(item => item.shoppingListItemId),
      );
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Mark moved shopping lines as stocked',
      });
    }

    const movedCount = payload.summary.succeeded;
    const alreadyThereCount = payload.summary.skipped;
    const failedCount = payload.summary.failed;

    if (movedCount > 0) {
      const alreadyThere =
        alreadyThereCount > 0
          ? t('moveToPantry.alreadyThereSuffix', {
              count: alreadyThereCount,
            })
          : '';
      toastService.success(
        t('moveToPantry.movedItems', {
          count: movedCount,
          skipped: alreadyThere,
        }),
      );
    } else if (alreadyThereCount > 0) {
      // Nothing moved because the pantry already held these lines. That is a
      // success for the user, not the "nothing could be moved" message.
      toastService.info(
        t('moveToPantry.allAlreadyThere', {
          count: alreadyThereCount,
        }),
      );
    } else if (failedCount === 0) {
      // Every bucket empty. Since the move began stamping the lines it moves,
      // this is the ordinary steady state — a second press with nothing new
      // purchased — not a failure, so it must not read like one.
      toastService.info(t('moveToPantry.nothingLeftToMove'));
    } else {
      toastService.info(t('moveToPantry.noItemsMoved'));
    }

    // Reported separately so a partial success still says what did not land.
    // `reason` is a server string and is never displayed; the item names are
    // the user's own words.
    if (failedCount > 0) {
      const names = payload.failedItems
        .map(item => item.itemName)
        .slice(0, 3)
        .join(', ');
      toastService.error(
        t('moveToPantry.failedItems', {
          count: failedCount,
          names,
        }),
      );
    }

    Telemetry.trackEvent('batch_move_purchased_to_pantry', {
      shopping_list_id: currentListId,
      moved_count: movedCount,
      already_in_pantry_count: alreadyThereCount,
      failed_count: failedCount,
    });

    onSuccess?.();
  };

  return {
    batchMoveToPantry,
    loading,
  };
}
