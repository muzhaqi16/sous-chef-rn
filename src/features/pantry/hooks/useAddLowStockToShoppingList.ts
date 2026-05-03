import { useMutation } from '@apollo/client/react';
import { AddLowStockItemsToShoppingListDocument } from '#features/pantry/graphql/pantry.generated';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { executeMutation } from '#/utils/compilerSafeWrappers';

interface UseAddLowStockToShoppingListOptions {
  homeId: string | undefined;
}

export function useAddLowStockToShoppingList({
  homeId,
}: UseAddLowStockToShoppingListOptions) {
  const [addLowStockMutation, { loading }] = useMutation(
    AddLowStockItemsToShoppingListDocument,
    {
      onError: error => {
        toastService.error(error.message || 'Failed to add low stock items');
      },
    },
  );

  const addLowStockToShoppingList = async () => {
    if (!homeId) {
      toastService.error('No home selected');
      return;
    }

    const result = await executeMutation(
      () =>
        addLowStockMutation({
          variables: { homeId },
        }),
      'Add low stock to shopping list error:',
    );
    if (!result) return;

    const data = result.data?.addLowStockItemsToShoppingList;
    if (!data) return;

    const { addedCount, skippedCount } = data;

    if (addedCount === 0 && skippedCount === 0) {
      toastService.info('No low stock items found');
    } else if (addedCount > 0) {
      const skippedText = skippedCount > 0 ? ` (${skippedCount} skipped)` : '';
      toastService.success(
        `Added ${addedCount} item${
          addedCount !== 1 ? 's' : ''
        } to shopping list${skippedText}`,
      );
    } else {
      toastService.info(
        `All ${skippedCount} low stock items were already in your list`,
      );
    }

    Telemetry.trackEvent('low_stock_items_added_to_shopping_list', {
      home_id: homeId,
      added_count: addedCount,
      skipped_count: skippedCount,
    });
  };

  return {
    addLowStockToShoppingList,
    loading,
  };
}
