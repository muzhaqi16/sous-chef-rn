/**
 * useUpdatePantryItemQuantity - Update mutation for pantry item quantity/unit
 * (local-first).
 *
 * Single responsibility:
 * - Update quantity and unit fields via dedicated endpoint
 * - Version conflict handling
 * - Writes the updated quantity/unit to the cache PERMANENTLY before firing
 *   (an `optimisticResponse` would roll back the moment the offline queue
 *   completes the request with a null result). A queued update stays visible
 *   and replays via the idempotent `SyncPantryItem` upsert; a real rejection
 *   restores the pre-edit snapshot.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { errorService } from '#/services/errorService';
import { UpdatePantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseUpdatePantryItemQuantity_PantryItemFragmentDoc,
  type UseUpdatePantryItemQuantity_PantryItemFragment,
} from './useUpdatePantryItemQuantity.generated';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { buildOptimisticUnit } from './utils';
import type { UnitSelection } from './types';
import { normalizeNumericTextForApi } from '#/utils/parseDecimalInput';
import { parseFractionalInput } from '#/utils/fractionUtils';

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
  const client = useApolloClient();

  const [updateQuantityMutation] = useMutation(
    UpdatePantryItemQuantityDocument,
    {
      onError: error => {
        handleMutationError(error, {
          operation: 'Update Quantity',
          checks: [versionConflictCheck({ onRefresh: refetch })],
        });
      },
    },
  );

  /**
   * Update quantity and/or unit of a pantry item
   * Fires mutation asynchronously - doesn't await to allow immediate navigation
   */
  const updateQuantity = ({
    itemId,
    quantityInput,
    quantityValue,
    unitId,
    trackingUnit,
  }: UpdateQuantityParams): void => {
    const currentItem =
      client.cache.readFragment<UseUpdatePantryItemQuantity_PantryItemFragment>(
        {
          id: client.cache.identify({ __typename: 'PantryItem', id: itemId }),
          fragment: UseUpdatePantryItemQuantity_PantryItemFragmentDoc,
          fragmentName: 'useUpdatePantryItemQuantity_pantryItem',
        },
      );

    if (!currentItem) {
      console.warn('Item not found, cannot update quantity:', itemId);
      return;
    }

    // The field accepts fractions ("1 1/4") as well as decimals, so it needs
    // the fraction-aware parser — `parseDecimalInput` declines a fraction
    // outright rather than misreading it.
    const quantityText = quantityInput || quantityValue.toString();
    const newQuantity = parseFractionalInput(quantityText) ?? NaN;

    // Fire mutation asynchronously - don't await to allow immediate navigation
    const optimisticPantryItem = enhanceWithVersion(currentItem, {
      quantity: newQuantity,
      unit: buildOptimisticUnit(trackingUnit, currentItem.unit),
    });

    // Permanent write BEFORE firing: survives an offline/API-down queue
    // (where no response ever arrives to materialize the change).
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    const writeItem = (data: UseUpdatePantryItemQuantity_PantryItemFragment) =>
      client.cache.writeFragment({
        id: cacheId,
        fragment: UseUpdatePantryItemQuantity_PantryItemFragmentDoc,
        fragmentName: 'useUpdatePantryItemQuantity_pantryItem',
        data,
      });
    executeCacheUpdate(
      () => writeItem(optimisticPantryItem),
      'Update Pantry Item Quantity (optimistic)',
    );

    updateQuantityMutation({
      variables: {
        input: {
          pantryItemId: itemId,
          // Separators normalized, fraction preserved: the server parses
          // this string itself and rejects a comma decimal outright.
          quantity: normalizeNumericTextForApi(quantityText),
          unitId: unitId,
          version: currentItem.version ?? undefined,
        },
      },
      // Queue offline / on API-down — replays via the idempotent SyncPantryItem.
      context: { localFirst: true },
    })
      .then(result => {
        // 'queued' (null payload, no error) keeps the permanent write — the
        // change replays later. A rejection restores the pre-edit snapshot;
        // the user-facing alert comes from the mutation's onError.
        const outcome = classifyCreateResult(result);
        if (outcome === 'rejected') {
          executeCacheUpdate(
            () => writeItem(currentItem),
            'Revert rejected Pantry Item quantity update',
          );
        }
      })
      .catch(error => {
        executeCacheUpdate(
          () => writeItem(currentItem),
          'Revert failed Pantry Item quantity update',
        );
        errorService.reportError(error, {
          operation: 'updatePantryItemQuantity',
        });
        // Error already handled by mutation's onError
      });

    onSuccess?.();
  };

  return { updateQuantity };
}
