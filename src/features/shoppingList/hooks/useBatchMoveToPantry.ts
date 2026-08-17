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
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';

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
  onSuccess?: () => void;
}

interface UseBatchMoveToPantryReturn {
  batchMoveToPantry: () => Promise<void>;
  loading: boolean;
  isApiUnavailable: boolean;
}

export function useBatchMoveToPantry({
  currentListId,
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

  const isApiUnavailable = useIsApiUnavailable();

  const batchMoveToPantry = async () => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return;
    }

    if (!currentListId) {
      toastService.error(t('moveToPantry.noListSelected'));
      return;
    }

    let result;
    try {
      result = await movePurchasedMutation({
        variables: { input: { shoppingListId: currentListId } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Batch move to pantry error:',
      });
    }
    if (!result) return;

    const payload = result.data?.movePurchasedItemsToPantry;
    if (payload?.__typename !== 'MovePurchasedItemsToPantryPayload') {
      // A resolved `*Error` union member doesn't throw under errorPolicy:'all',
      // so the mutation `onError` never fired for it. Surface it here — guarded
      // to skip the transport-error case (`result.error`), which onError already
      // alerted, so the two never double-alert.
      alertRejectedMutation(result, t('errors.somethingWentWrong'));
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
    isApiUnavailable,
  };
}
