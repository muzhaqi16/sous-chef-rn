import { useMovePurchasedItemsToPantryMutation } from '#generated';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { executeCacheUpdate, executeMutation } from '#/utils/compilerSafeWrappers';

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
  onSuccess }: UseBatchMoveToPantryOptions): UseBatchMoveToPantryReturn {
  const [movePurchasedMutation, { loading }] =
    useMovePurchasedItemsToPantryMutation({
      update: (cache, { data }) => {
        const result = data?.movePurchasedItemsToPantry;
        if (!result || !currentListId) return;

        executeCacheUpdate(
          () => {
            const removeFromList = createRemoveFromParentConnectionUpdater(
              'ShoppingList',
              'itemsConnection',
              'ShoppingListItem',
            );

            // Remove each moved item from the shopping list cache
            for (const item of result.movedItems) {
              removeFromList(cache, currentListId, item.shoppingListItemId);
            }

            // Update totalItems and completedItems counters
            const movedCount = result.movedItems.length;
            if (movedCount > 0) {
              const parentCacheId = cache.identify({
                __typename: 'ShoppingList',
                id: currentListId });
              if (parentCacheId) {
                cache.modify({
                  id: parentCacheId,
                  fields: {
                    totalItems(existing: number = 0) {
                      return Math.max(0, existing - movedCount);
                    },
                    completedItems(existing: number = 0) {
                      return Math.max(0, existing - movedCount);
                    } } });
              }
            }
          },
          'Cache update failed for batch move to pantry:',
        );
      },
      onError: error => {
        toastService.error(error.message || 'Failed to move items to pantry');
      } });

  const batchMoveToPantry = async () => {
    if (!currentListId) {
      toastService.error('No shopping list selected');
      return;
    }

    const result = await executeMutation(
      () => movePurchasedMutation({
        variables: { shoppingListId: currentListId } }),
      'Batch move to pantry error:',
    );
    if (!result) return;

    const data = result.data?.movePurchasedItemsToPantry;
    if (!data) return;

    const { movedCount, skippedCount, targetPantryName } = data;

    if (movedCount > 0) {
      const skippedText = skippedCount > 0 ? ` (${skippedCount} skipped)` : '';
      toastService.success(
        `Moved ${movedCount} item${movedCount !== 1 ? 's' : ''} to ${targetPantryName}${skippedText}`,
      );
    } else {
      toastService.info('No items could be moved to pantry');
    }

    Telemetry.trackEvent('batch_move_purchased_to_pantry', {
      shopping_list_id: currentListId,
      moved_count: movedCount,
      skipped_count: skippedCount });

    onSuccess?.();
  };

  return {
    batchMoveToPantry,
    loading };
}
