import { useMovePurchasedItemsToPantryMutation } from '#generated';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import { safeEvictMany } from '#/apollo/utils/cacheUpdaters';
import { isPurchasedVariant } from '#/apollo/utils/shoppingListCacheUpdaters';

interface UseBatchMoveToPantryOptions {
  currentListId: string | undefined;
  onSuccess?: () => void;
}

interface UseBatchMoveToPantryReturn {
  batchMoveToPantry: () => Promise<void>;
  loading: boolean;
}

export function useBatchMoveToPantry({
  currentListId,
  onSuccess,
}: UseBatchMoveToPantryOptions): UseBatchMoveToPantryReturn {
  const [movePurchasedMutation, { loading }] =
    useMovePurchasedItemsToPantryMutation({
      update: (cache, { data }) => {
        const result = data?.movePurchasedItemsToPantry;
        if (!result || !currentListId) return;

        executeCacheUpdate(() => {
          const movedCount = result.movedItems.length;
          if (movedCount === 0) return;

          const movedIds = new Set(
            result.movedItems.map(item => item.shoppingListItemId),
          );

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
                existing: any,
                { readField, storeFieldName }: any,
              ) {
                if (!isPurchasedVariant(storeFieldName) || !existing?.edges)
                  return existing;

                return {
                  ...existing,
                  edges: existing.edges.filter(
                    (edge: any) =>
                      !movedIds.has(readField('id', edge?.node) as string),
                  ),
                  totalCount: Math.max(
                    0,
                    (existing.totalCount || 0) - movedCount,
                  ),
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
            result.movedItems.map(item => ({
              typename: 'ShoppingListItem',
              id: item.shoppingListItemId,
            })),
          );
        }, 'Cache update failed for batch move to pantry:');
      },
      onError: error => {
        toastService.error(error.message || 'Failed to move items to pantry');
      },
    });

  const batchMoveToPantry = async () => {
    if (!currentListId) {
      toastService.error('No shopping list selected');
      return;
    }

    const result = await executeMutation(
      () =>
        movePurchasedMutation({
          variables: { shoppingListId: currentListId },
        }),
      'Batch move to pantry error:',
    );
    if (!result) return;

    const data = result.data?.movePurchasedItemsToPantry;
    if (!data) return;

    const { movedCount, skippedCount, targetPantryName } = data;

    if (movedCount > 0) {
      const skippedText = skippedCount > 0 ? ` (${skippedCount} skipped)` : '';
      toastService.success(
        `Moved ${movedCount} item${
          movedCount !== 1 ? 's' : ''
        } to ${targetPantryName}${skippedText}`,
      );
    } else {
      toastService.info('No items could be moved to pantry');
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
