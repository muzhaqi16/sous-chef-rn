import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import { MovePurchasedItemsToPantryDocument } from './useBatchMoveToPantry.generated';
import {
  readMovedToPantryAt,
  writePurchaseInfo,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { handleMutationError } from '#/utils/errorHandlers';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n';
import { errorService } from '#/services/errorService';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { generateEntityId } from '#/utils/generateEntityId';

/**
 * Mark moved lines as stocked so their rows stop offering a no-op action.
 * `writePurchaseInfo` owns the write-time rules (never asserts a flag it was not
 * given; clears the stamp on a flip). The stamp is a local placeholder, so it is
 * written only onto a line with none — the payload lists earlier moves too.
 */
function markMovedLinesStocked(cache: ApolloCache, ids: string[]): void {
  const stampedAt = new Date().toISOString();
  for (const id of ids) {
    if (readMovedToPantryAt(cache, id)) continue;
    writePurchaseInfo(cache, id, { movedToPantryAt: stampedAt });
  }
}

interface UseBatchMoveToPantryOptions {
  currentListId: string | undefined;
  /**
   * The purchased rows the screen already renders. Passed in rather than re-read
   * from cache: minting a client id per line needs the exact set on screen, and
   * matching the filtered connection's cached field key wrong yields silently NO
   * hints offline rather than a visible failure.
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
      // No `update` callback and nothing written before firing:
      // `movePurchasedItemsToPantry` never removes the lines it moves (clearing
      // them is a separate `deleteShoppingListItems(purchased: true)`), and it
      // carries no `pantryId`, so the client cannot know which pantry the rows
      // land in. The pantry query picks them up on its next fetch.
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

    // One client-minted pantry-row id per purchased line — a hint, not an
    // instruction: the server decides which lines are actually purchased and
    // mints its own id for any line it gets no hint for.
    const idHints = purchasedItems.map(item => ({
      shoppingListItemId: item.id,
      pantryItemId: generateEntityId(),
      idempotencyKey: generateEntityId(),
    }));

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

    // Queued (offline / API down): no summary, and `purchasedItems` is only the
    // slice on screen, so report pending rather than a possibly-wrong count.
    if (classifyCreateResult(result) === 'queued') {
      toastService.success(t('moveToPantry.queued'));
      onSuccess?.();
      return;
    }

    if (payload?.__typename !== 'MovePurchasedItemsToPantryPayload') {
      // A resolved `*Error` union member doesn't throw under errorPolicy:'all',
      // so `onError` never fired for it. The helper skips the transport-error
      // case, which onError already alerted, so the two never double-alert.
      alertRejectedMutation(result, t('errors.codes.genericRetry'));
      return;
    }

    // succeeded = lines THIS call moved; skipped = lines already stocked; failed
    // = itemised in `failedItems`. Every line the payload lists is now in the
    // pantry, whether this call moved it or found it there.
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
      // Every bucket empty is the ordinary steady state — a second press with
      // nothing newly purchased — so it must not read like a failure.
      toastService.info(t('moveToPantry.nothingLeftToMove'));
    } else {
      toastService.info(t('moveToPantry.noItemsMoved'));
    }

    // Reported separately so a partial success still says what did not land; the
    // names are the user's own words, and nothing else from the failure is shown.
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
      // A count alone cannot tell a validation refusal from a database fault.
      // Distinct codes keep this bounded; the capped ids are how support finds
      // the server-side log for a failure nobody can reproduce.
      failed_codes: [...new Set(payload.failedItems.map(item => item.code))]
        .sort()
        .join(','),
      failed_error_ids: payload.failedItems
        .map(item => item.errorId)
        .filter((id): id is string => !!id)
        .slice(0, 3)
        .join(','),
    });

    onSuccess?.();
  };

  return {
    batchMoveToPantry,
    loading,
  };
}
