/**
 * Local-first: the updated quantity/unit is written to the cache PERMANENTLY
 * before firing (an `optimisticResponse` would roll back on the offline queue's
 * null result), so a queued update stays visible and replays via the idempotent
 * `SyncPantryItem` upsert; a real rejection restores the pre-edit snapshot.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { errorService } from '#/services/errorService';
import { UpdatePantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseUpdatePantryItemQuantity_PantryItemFragmentDoc,
  type UseUpdatePantryItemQuantity_PantryItemFragment,
} from './useUpdatePantryItemQuantity.generated';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { buildOptimisticUnit } from './utils';
import type { UnitSelection } from './types';
import { normalizeNumericTextForApi } from '#/utils/parseDecimalInput';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { logger } from '#/utils/environment';
import { useTranslation } from '#/i18n';

interface UseUpdatePantryItemQuantityOptions {
  onSuccess?: () => void;
  refetch?: () => void;
}

interface UpdateQuantityParams {
  itemId: string;
  quantityInput: string;
  quantityValue: number;
  unitId: string | null;
  unitSymbol: string;
  trackingUnit: UnitSelection;
}

export function useUpdatePantryItemQuantity({
  onSuccess,
  refetch,
}: UseUpdatePantryItemQuantityOptions) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [updateQuantityMutation] = useMutation(
    UpdatePantryItemQuantityDocument,
  );

  /**
   * Updates quantity and/or unit. `onSuccess` runs as soon as the write is
   * fired; the returned promise resolves once it settles, false on a refusal.
   */
  const updateQuantity = async ({
    itemId,
    quantityInput,
    quantityValue,
    unitId,
    trackingUnit,
  }: UpdateQuantityParams): Promise<boolean> => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    const currentItem =
      client.cache.readFragment<UseUpdatePantryItemQuantity_PantryItemFragment>(
        {
          id: cacheId,
          fragment: UseUpdatePantryItemQuantity_PantryItemFragmentDoc,
          fragmentName: 'useUpdatePantryItemQuantity_pantryItem',
        },
      );

    if (!currentItem) {
      logger.warn('Item not found, cannot update quantity:', itemId);
      return false;
    }

    // The field accepts fractions ("1 1/4") as well as decimals, so it needs
    // the fraction-aware parser — `parseDecimalInput` declines a fraction
    // outright rather than misreading it.
    const quantityText = quantityInput || quantityValue.toString();
    const newQuantity = parseFractionalInput(quantityText);
    if (newQuantity === null) {
      logger.warn('Unreadable quantity, nothing written:', itemId);
      return false;
    }

    const optimisticPantryItem = enhanceWithVersion(currentItem, {
      quantity: newQuantity,
      unit: buildOptimisticUnit(trackingUnit, currentItem.unit),
    });

    // Permanent write BEFORE firing: survives an offline/API-down queue
    // (where no response ever arrives to materialize the change).
    const writeItem = (data: UseUpdatePantryItemQuantity_PantryItemFragment) =>
      client.cache.writeFragment({
        id: cacheId,
        fragment: UseUpdatePantryItemQuantity_PantryItemFragmentDoc,
        fragmentName: 'useUpdatePantryItemQuantity_pantryItem',
        data,
      });
    try {
      writeItem(optimisticPantryItem);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Update Pantry Item Quantity (optimistic)',
      });
    }

    const revert = () => {
      try {
        writeItem(currentItem);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Pantry Item quantity update',
        });
      }
    };

    const settled = settleMutation(
      () =>
        updateQuantityMutation({
          variables: {
            input: {
              pantryItemId: itemId,
              // Separators normalized, fraction preserved: the server parses
              // this string itself and rejects a comma decimal outright.
              quantity: normalizeNumericTextForApi(quantityText),
              unitId: unitId,
              version: currentItem.version,
            },
          },
          // Queue offline / on API-down — replays via the idempotent SyncPantryItem.
          context: { localFirst: true },
        }),
      {
        document: UpdatePantryItemQuantityDocument,
        fallback: t('errors.updateItemFailed'),
        onFailed: revert,
        onConflictRefresh: refetch,
      },
    );

    onSuccess?.();
    return (await settled).status !== 'failed';
  };

  return { updateQuantity };
}
