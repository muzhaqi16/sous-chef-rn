/**
 * useUpdatePantryItemQuantity — update a pantry item's quantity and tracking
 * unit (local-first).
 *
 * The change goes through the declared write path: describe it once as a
 * `WriteIntent`, let the kit apply it permanently, invert it, and carry it to
 * the queue. A queued update stays visible and replays via the idempotent
 * `SyncPantryItem` upsert; a refusal is undone from the intent's inverse.
 *
 * The mutation is fired WITHOUT being awaited so `onSuccess` (which navigates
 * away) runs on the same tick as the tap.
 */

import { gql } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { generateEntityId } from '#/utils/generateEntityId';
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
import { useWrite } from '#/apollo/write/useWrite';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n';
import { buildOptimisticUnit } from './utils';
import type { UnitSelection } from './types';
import { normalizeNumericTextForApi } from '#/utils/parseDecimalInput';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { logger } from '#/utils/environment';

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

/**
 * The unit fields the item's own selection reads.
 *
 * The picked unit is normalized into the cache before the item is pointed at
 * it: `SearchUnits` does not select `autoConvertThreshold`, so a bare reference
 * to a just-searched unit would leave the item's read INCOMPLETE and drop it
 * out of every list until the server answered. `buildOptimisticUnit` fills the
 * gaps; this document is what writes them.
 */
const OPTIMISTIC_UNIT = gql`
  fragment UpdatePantryItemQuantityUnit on Unit {
    id
    name
    symbol
    type
    isMetric
    baseUnitId
    conversionFactor
    isCommon
    displayAsFraction
    minPrecision
    autoConvertThreshold
  }
`;

export function useUpdatePantryItemQuantity({
  onSuccess,
  refetch,
}: UseUpdatePantryItemQuantityOptions) {
  const client = useApolloClient();
  const { apply } = useWrite();

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
   * Update quantity and/or unit of a pantry item.
   * Fires the mutation without awaiting so navigation is not held up.
   */
  const updateQuantity = ({
    itemId,
    quantityInput,
    quantityValue,
    unitId,
    trackingUnit,
  }: UpdateQuantityParams): void => {
    // Still read: `version` rides on the input, and the current unit supplies
    // the defaults for any field the picked one did not carry.
    const currentItem =
      client.cache.readFragment<UseUpdatePantryItemQuantity_PantryItemFragment>(
        {
          id: client.cache.identify({ __typename: 'PantryItem', id: itemId }),
          fragment: UseUpdatePantryItemQuantity_PantryItemFragmentDoc,
          fragmentName: 'useUpdatePantryItemQuantity_pantryItem',
        },
      );

    if (!currentItem) {
      logger.warn('Item not found, cannot update quantity:', itemId);
      return;
    }

    // The field accepts fractions ("1 1/4") as well as decimals, so it needs
    // the fraction-aware parser — `parseDecimalInput` declines a fraction
    // outright rather than misreading it.
    const quantityText = quantityInput || quantityValue.toString();
    const newQuantity = parseFractionalInput(quantityText) ?? NaN;

    const optimisticUnit = buildOptimisticUnit(trackingUnit, currentItem.unit);
    if (optimisticUnit) {
      client.cache.writeFragment({
        id: `Unit:${optimisticUnit.id}`,
        fragment: OPTIMISTIC_UNIT,
        data: optimisticUnit,
      });
    }

    // The unit is patched as a REFERENCE, not as the unit object: a plain
    // object value is shallow-merged, and merging unit fields into the stored
    // `{ __ref }` would leave the item pointing at the old unit.
    const { context, revert } = apply({
      target: { __typename: 'PantryItem', id: itemId },
      patch: {
        quantity: newQuantity,
        unit: optimisticUnit ? { __ref: `Unit:${optimisticUnit.id}` } : null,
      },
      // The value is a final one the person typed as a fact, so a version
      // conflict is resolved by refreshing the version and re-sending rather
      // than by discarding their number. See `WriteConvergence`.
      convergence: 'absolute',
    });

    updateQuantityMutation({
      variables: {
        input: {
          pantryItemId: itemId,
          // Separators normalized, fraction preserved: the server parses
          // this string itself and rejects a comma decimal outright.
          quantity: normalizeNumericTextForApi(quantityText),
          unitId: unitId,
          version: currentItem.version ?? undefined,
          // Claimed before the server's version check, so a queued replay
          // converges instead of being refused on the version it carries.
          idempotencyKey: generateEntityId(),
        },
      },
      context,
    })
      .then(result => {
        // 'queued' (null payload, no error) keeps the permanent write — the
        // change replays later. A refusal reached the server on the spot, so
        // it never entered the queue and the queue's withdrawal will never see
        // it; a queued write refused on a later replay is undone from its
        // persisted intent instead. `alertRejectedMutation` stays silent when
        // the result carries an `error`, which the mutation's `onError`
        // already surfaced.
        if (classifyCreateResult(result) === 'rejected') {
          revert();
          alertRejectedMutation(result, t('errors.updateItemFailed'));
        }
      })
      .catch(error => {
        revert();
        errorService.reportError(error, {
          operation: 'updatePantryItemQuantity',
        });
        // The user-facing alert comes from the mutation's onError.
      });

    onSuccess?.();
  };

  return { updateQuantity };
}
