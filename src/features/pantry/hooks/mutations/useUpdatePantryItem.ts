/**
 * useUpdatePantryItem - Update mutation for pantry item non-quantity fields
 * (local-first).
 *
 * Single responsibility:
 * - Update non-quantity fields (storage, notes, tags, brand, etc.)
 * - Only sends changed fields (dirty field tracking)
 * - Version conflict handling
 * - Writes the updated entity to the cache PERMANENTLY before firing (an
 *   `optimisticResponse` would roll back the moment the offline queue
 *   completes the request with a null result). A queued update stays visible
 *   and replays via the idempotent `SyncPantryItem` upsert; a real rejection
 *   restores the pre-edit snapshot.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseUpdatePantryItem_PantryItemFragmentDoc,
  type UseUpdatePantryItem_PantryItemFragment,
} from './useUpdatePantryItem.generated';
import { StorageType } from '#/graphql/generated/schemaTypes';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { buildDirtyUpdateInput, buildOptimisticUnit } from './utils';
import type { FormDataInput, UnitSelection } from './types';

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
  selectedStorageLocation?: { id: string; name: string; type: string } | null;
  unitSymbol?: string;
}

export function useUpdatePantryItem({
  onSuccess,
  refetch,
}: UseUpdatePantryItemOptions) {
  const client = useApolloClient();

  const [updateMutation] = useMutation(UpdatePantryItemDocument, {
    onError: error => {
      handleMutationError(error, {
        operation: 'Update Pantry Item',
        checks: [versionConflictCheck({ onRefresh: refetch })],
      });
    },
  });

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
      console.warn('Item not found, cannot update:', itemId);
      return;
    }

    // Build optimistic update from form data (PantryItem-shaped, not mutation-input-shaped)
    const optimisticUpdate: Partial<UseUpdatePantryItem_PantryItemFragment> =
      {};
    if (dirtyFields.itemName) optimisticUpdate.itemName = input.itemName;
    if (dirtyFields.storageState)
      optimisticUpdate.storageState = input.storageState;
    if (dirtyFields.expirationDate) {
      optimisticUpdate.expiresAt = input.expirationDate?.toISOString() ?? null;
    }
    if (dirtyFields.tags) optimisticUpdate.tags = input.tags || [];
    if (dirtyFields.minQuantity) {
      optimisticUpdate.minQuantity = input.minQuantity
        ? parseFloat(input.minQuantity)
        : null;
    }
    if (dirtyFields.restockQuantity) {
      optimisticUpdate.restockQuantity = input.restockQuantity
        ? parseFloat(input.restockQuantity)
        : null;
    }
    if (dirtyFields.netWeight) {
      optimisticUpdate.netWeight = input.netWeight
        ? parseFloat(input.netWeight)
        : null;
    }
    if (dirtyFields.location && selectedStorageLocation) {
      optimisticUpdate.storageLocation = {
        __typename: 'StorageLocation',
        id: selectedStorageLocation.id,
        name: selectedStorageLocation.name,
        type: selectedStorageLocation.type as StorageType,
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
    if (trackingUnit?.id && trackingUnit.id !== currentItem.unit?.id) {
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
    executeCacheUpdate(
      () => writeItem(optimisticPantryItem),
      'Update Pantry Item (optimistic)',
    );

    updateMutation({
      variables: { input: { ...updateInput, id: itemId } },
      // Queue offline / on API-down — replays via the idempotent SyncPantryItem.
      context: { localFirst: true },
    })
      .then(result => {
        // 'queued' (null payload, no error) keeps the permanent write — the
        // change replays later. A rejection (ValidationError / version
        // conflict / surfaced error) restores the pre-edit snapshot; the
        // user-facing alert comes from the mutation's onError.
        const outcome = classifyCreateResult(
          result,
          'updatePantryItem',
          'UpdatePantryItemPayload',
        );
        if (outcome === 'rejected') {
          executeCacheUpdate(
            () => writeItem(currentItem),
            'Revert rejected Pantry Item update',
          );
        }
      })
      .catch(error => {
        executeCacheUpdate(
          () => writeItem(currentItem),
          'Revert failed Pantry Item update',
        );
        console.error('Pantry item update failed:', error);
        // Error already handled by mutation's onError
      });

    onSuccess?.();
  };

  return { updatePantryItemFields };
}
