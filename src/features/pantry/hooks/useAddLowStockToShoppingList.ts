import { useMutation } from '@apollo/client/react';
import { AddLowStockItemsToShoppingListDocument } from '#features/pantry/graphql/pantry.generated';
import { toastService } from '#/services/toastService';
import { localizedErrorMessage } from '#/services/errorService';
import { Telemetry } from '#/services/telemetry';
import { unwrapPayload } from '#/utils/errors/mutationPayload';
import { handleMutationError } from '#/utils/errorHandlers';
import { t } from '#/i18n';
import { getI18n } from '#/i18n/config';

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
      toastService.error(t('errors.noHomeSelected'));
      return;
    }

    // The `?.` unwrap sits outside the try — a value block inside a try body
    // makes the React Compiler bail out of this hook.
    let response;
    let result;
    try {
      response = await addLowStockMutation({
        variables: { input: { homeId } },
      });
    } catch {
      // A transport throw. Its `message` is developer text — operation names
      // and identifiers — not something to put on screen.
      toastService.error(t('errors.addLowStockFailed'));
    }

    const payload = response?.data?.addLowStockItemsToShoppingList;
    if (response) {
      try {
        result = unwrapPayload(
          payload,
          'AddLowStockItemsToShoppingListPayload',
          t('errors.addLowStockFailed'),
        );
      } catch (error: unknown) {
        // `unwrapPayload` throws a GraphQLDomainError carrying the refusal's
        // own code; `localizedErrorMessage` resolves that to the app's copy.
        toastService.error(localizedErrorMessage(error));
      }
    }
    if (!result) return;

    // The payload's shared summary carries the authoritative counters — the
    // inlined item lists exist for display and may be capped server-side.
    const addedCount = result.summary.succeeded;
    const skippedCount = result.summary.skipped;

    if (addedCount === 0 && skippedCount === 0) {
      toastService.info(t('toasts.noLowStockItems'));
    } else if (addedCount > 0) {
      // Two whole sentences rather than a suffix: a parenthetical appended to
      // a translated string is not reorderable, and the plural form of the
      // noun depends on `count` in most languages.
      toastService.success(
        skippedCount > 0
          ? getI18n().t('toasts.addedItemsWithSkipped', {
              count: addedCount,
              skipped: skippedCount,
            })
          : getI18n().t('toasts.addedItems', { count: addedCount }),
      );
    } else {
      toastService.info(
        getI18n().t('toasts.allLowStockAlreadyListed', { count: skippedCount }),
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
