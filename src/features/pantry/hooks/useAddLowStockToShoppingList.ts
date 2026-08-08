import { useMutation } from '@apollo/client/react';
import { AddLowStockItemsToShoppingListDocument } from '#features/pantry/graphql/pantry.generated';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { executeMutation, unwrapPayload } from '#/utils/compilerSafeWrappers';
import { handleMutationError } from '#/utils/errorHandlers';
import { t } from '#/i18n/t';

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
        handleMutationError(error, { operation: 'Add Low Stock Items' });
      },
    },
  );

  const addLowStockToShoppingList = async () => {
    if (!homeId) {
      toastService.error('No home selected');
      return;
    }

    const result = await executeMutation(
      async () => {
        const { data } = await addLowStockMutation({
          variables: { input: { homeId } },
        });
        return unwrapPayload(
          data?.addLowStockItemsToShoppingList,
          'AddLowStockItemsToShoppingListPayload',
          t('errors.addLowStockFailed'),
        );
      },
      (error: unknown) => {
        toastService.error(
          error instanceof Error
            ? error.message
            : t('errors.addLowStockFailed'),
        );
      },
    );
    if (!result) return;

    // The payload's shared summary carries the authoritative counters — the
    // inlined item lists exist for display and may be capped server-side.
    const addedCount = result.summary.succeeded;
    const skippedCount = result.summary.skipped;

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
