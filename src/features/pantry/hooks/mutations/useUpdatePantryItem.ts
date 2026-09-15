/**
 * Updates the non-quantity fields the form dirtied. Local-first: the entity is
 * written to the cache PERMANENTLY before firing (an `optimisticResponse` rolls
 * back on the offline queue's null result), so a queued update stays visible and
 * replays via the idempotent `SyncPantryItem` upsert.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { errorService } from '#/services/errorService';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseUpdatePantryItem_PantryItemFragmentDoc,
  type UseUpdatePantryItem_PantryItemFragment,
} from './useUpdatePantryItem.generated';
import type { StorageType } from '#/graphql/generated/schemaTypes';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
import { buildDirtyUpdateInput, buildOptimisticUnit } from './utils';
import type { FormDataInput, UnitSelection } from './types';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { logger } from '#/utils/environment';

interface UseUpdatePantryItemOptions {
  onSuccess?: () => void;
  refetch?: () => void;
}

interface UpdatePantryItemFieldsParams {
  itemId: string;
  input: FormDataInput;
  dirtyFields: Record<string, boolean>;
  selectedLocationId: string | null;
  selectedBrandId: string | null;
  trackingUnit?: UnitSelection;
  selectedStorageLocation?: {
    id: string;
    name: string;
    type: StorageType;
  } | null;
  unitSymbol?: string;
}

export function useUpdatePantryItem({
  onSuccess,
  refetch,
}: UseUpdatePantryItemOptions) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [updateMutation] = useMutation(UpdatePantryItemDocument);

  /**
   * Update non-quantity fields of a pantry item
   * Fires mutation asynchronously - doesn't await to allow immediate navigation
   */
  const updatePantryItemFields = ({
    itemId,
    input,
    dirtyFields,
    selectedLocationId,
    selectedBrandId,
    trackingUnit,
    selectedStorageLocation,
    unitSymbol,
  }: UpdatePantryItemFieldsParams): void => {
    // Build input for dirty fields only
    const updateInput = buildDirtyUpdateInput(
      input,
      dirtyFields,
      selectedLocationId,
      selectedBrandId,
      unitSymbol,
    );

    // Only fire mutation if there are changes
    if (Object.keys(updateInput).length === 0) {
      onSuccess?.();
      return;
    }

    const currentItem =
      client.cache.readFragment<UseUpdatePantryItem_PantryItemFragment>({
        id: client.cache.identify({ __typename: 'PantryItem', id: itemId }),
        fragment: UseUpdatePantryItem_PantryItemFragmentDoc,
        fragmentName: 'useUpdatePantryItem_pantryItem',
      });

    if (!currentItem) {
      logger.warn('Item not found, cannot update:', itemId);
      return;
    }

    // Build optimistic update from form data (PantryItem-shaped, not mutation-input-shaped)
    const optimisticUpdate: Partial<UseUpdatePantryItem_PantryItemFragment> =
      {};
    if (dirtyFields.itemName) optimisticUpdate.itemName = input.itemName;
    if (dirtyFields.storageState)
      optimisticUpdate.storageState = input.storageState;
    if (dirtyFields.condition && input.condition)
      optimisticUpdate.condition = input.condition;
    if (dirtyFields.expirationDate) {
      optimisticUpdate.expiresAt = input.expirationDate?.toISOString() ?? null;
    }
    if (dirtyFields.tags) optimisticUpdate.tags = input.tags ?? [];
    if (dirtyFields.minQuantity) {
      optimisticUpdate.minQuantity = input.minQuantity
        ? parseDecimalInput(input.minQuantity)
        : null;
    }
    if (dirtyFields.restockQuantity) {
      optimisticUpdate.restockQuantity = input.restockQuantity
        ? parseDecimalInput(input.restockQuantity)
        : null;
    }
    if (dirtyFields.netWeight) {
      optimisticUpdate.netWeight = input.netWeight
        ? parseDecimalInput(input.netWeight)
        : null;
    }
    if (dirtyFields.location && selectedStorageLocation) {
      optimisticUpdate.storageLocation = {
        __typename: 'StorageLocation',
        id: selectedStorageLocation.id,
        name: selectedStorageLocation.name,
        type: selectedStorageLocation.type,
      };
    }
    if (dirtyFields.notes) optimisticUpdate.storageNotes = input.notes;
    if (dirtyFields.brand) {
      if (!selectedBrandId && !input.brand?.trim()) {
        optimisticUpdate.brand = null;
      }
    }

    // Include new unit in optimistic response to prevent race condition
    // with updateQuantity mutation overwriting the unit
    if (trackingUnit?.id && trackingUnit.id !== currentItem.unit.id) {
      optimisticUpdate.unit = buildOptimisticUnit(
        trackingUnit,
        currentItem.unit,
      );
    }

    const optimisticPantryItem = enhanceWithVersion(
      currentItem,
      optimisticUpdate,
    );

    // Permanent write BEFORE firing: survives an offline/API-down queue
    // (where no response ever arrives to materialize the change).
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    const writeItem = (data: UseUpdatePantryItem_PantryItemFragment) =>
      client.cache.writeFragment({
        id: cacheId,
        fragment: UseUpdatePantryItem_PantryItemFragmentDoc,
        fragmentName: 'useUpdatePantryItem_pantryItem',
        data,
      });
    try {
      writeItem(optimisticPantryItem);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Update Pantry Item (optimistic)',
      });
    }

    const revert = () => {
      try {
        writeItem(currentItem);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Pantry Item update',
        });
      }
    };

    // A refusal naming `field: "unit"` (a unit change while the item has
    // batches) reads as the localized `errors.field.unit` copy.
    void settleMutation(
      () =>
        updateMutation({
          variables: {
            input: { ...updateInput, id: itemId, version: currentItem.version },
          },
          // Queue offline / on API-down — replays via the idempotent SyncPantryItem.
          context: { localFirst: true },
        }),
      {
        document: UpdatePantryItemDocument,
        fallback: t('errors.updateItemFailed'),
        onFailed: revert,
        onConflictRefresh: refetch,
      },
    );

    onSuccess?.();
  };

  return { updatePantryItemFields };
}
