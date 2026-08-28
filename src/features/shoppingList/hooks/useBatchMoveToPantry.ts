import { useMutation } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import { MovePurchasedItemsToPantryDocument } from './useBatchMoveToPantry.generated';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { handleMutationError } from '#/utils/errorHandlers';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n';
import { getI18n } from '#/i18n/config';
import { errorService } from '#/services/errorService';
import {
  safeEvictMany,
  type ConnectionData,
} from '#/apollo/utils/cacheUpdaters';
import { isPurchasedVariant } from '#/apollo/utils/shoppingListCacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { generateEntityId } from '#/utils/generateEntityId';

/**
 * Cache side of a batch move-to-pantry: drop the moved rows from the purchased
 * connection variant, decrement the list counters, and evict the entities.
 *
 * Module-level rather than inlined into the mutation's `update` because its body
 * contains `?.` / `||` / `!` value blocks, and the React Compiler bails out of
 * the entire hook when one appears inside a try/catch — leaving the caller's try
 * body a single plain call. See scripts/probe-compiler-try-forms.mjs.
 */
function applyBatchMoveCacheUpdate(
  cache: ApolloCache,
  currentListId: string,
  movedItems: { shoppingListItemId: string }[],
): void {
  const movedCount = movedItems.length;
  if (movedCount === 0) return;

  const movedIds = new Set(movedItems.map(item => item.shoppingListItemId));

  const parentCacheId = cache.identify({
    __typename: 'ShoppingList',
    id: currentListId,
  });
  if (!parentCacheId) return;

  // Single cache.modify: remove from purchased variant only + update counters
  cache.modify({
    id: parentCacheId,
    fields: {
      itemsConnection(
        existing: ConnectionData | undefined,
        { readField, storeFieldName },
      ) {
        if (!isPurchasedVariant(storeFieldName) || !existing?.edges)
          return existing;

        return {
          ...existing,
          edges: existing.edges.filter(
            edge => !movedIds.has(readField<string>('id', edge?.node)!),
          ),
          totalCount: Math.max(0, (existing.totalCount || 0) - movedCount),
        };
      },
      totalItems(existing: number = 0) {
        return Math.max(0, existing - movedCount);
      },
      completedItems(existing: number = 0) {
        return Math.max(0, existing - movedCount);
      },
    },
  });

  // Evict all moved items from cache
  safeEvictMany(
    cache,
    movedItems.map(item => ({
      typename: 'ShoppingListItem',
      id: item.shoppingListItemId,
    })),
  );
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
  const [movePurchasedMutation, { loading }] = useMutation(
    MovePurchasedItemsToPantryDocument,
    {
      update: (cache, { data }) => {
        const payload = data?.movePurchasedItemsToPantry;
        if (
          payload?.__typename !== 'MovePurchasedItemsToPantryPayload' ||
          !currentListId
        )
          return;
        const { movedItems } = payload;

        try {
          applyBatchMoveCacheUpdate(cache, currentListId, movedItems);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for batch move to pantry:',
          });
        }
      },
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

    // Nothing is written eagerly. Three reasons, and the first is decisive:
    //
    // 1. The eager removal was aimed at the wrong set. `purchasedItems` is the
    //    paginated, search-filtered slice the user can see, while the input
    //    carries only `shoppingListId` — so the server moves EVERY purchased
    //    row. With 30 purchased and 10 loaded, the client removed 10 and the
    //    response removed 30, and no restore could have picked the right rows.
    // 2. Removing edges is idempotent; subtracting their count is not. The
    //    eager write and `applyBatchMoveCacheUpdate` decremented `totalItems`,
    //    `completedItems` and the purchased `totalCount` twice on every
    //    successful move.
    // 3. There was no restore path on either a refusal or a permanent replay
    //    failure, and the queue cannot identify this operation's entity —
    //    `getEntityId` has no branch for a plural `pantryItemIds` array — so a
    //    failed replay left the rows in neither list. `useMoveToPantry`
    //    documents avoiding exactly that.
    //
    // The mutation's `update` callback is therefore the only writer.

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
      toastService.success(getI18n().t('moveToPantry.queued'));
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

    const movedCount = payload.summary.succeeded;
    const skippedCount = payload.summary.skipped;

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
