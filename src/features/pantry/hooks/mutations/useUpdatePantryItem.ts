/**
 * useUpdatePantryItem - Update mutation for pantry item non-quantity fields
 *
 * Single responsibility:
 * - Update non-quantity fields (storage, notes, tags, brand, etc.)
 * - Only sends changed fields (dirty field tracking)
 * - Version conflict handling
 * - Optimistic response built from the hook's own narrow fragment read from
 *   cache — callers pass only `itemId`.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseUpdatePantryItem_PantryItemFragmentDoc,
  type UseUpdatePantryItem_PantryItemFragment,
} from './useUpdatePantryItem.generated';
import { StorageType } from '#/graphql/generated/schemaTypes';
import { useErrorService } from '#/services/errorService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import {
  buildDirtyUpdateInput,
  buildOptimisticUnit,
  modifyPantryStats,
  stateToCountKey,
} from './utils';
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
  const { handleApolloError } = useErrorService();
  const client = useApolloClient();

  const [updateMutation] = useMutation(UpdatePantryItemDocument, {
    onError: error => {
      if (handleVersionConflict(error)) {
        alertService.alert('Item Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch?.() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }
      const { message } = handleApolloError(error, {
        operation: 'Update Pantry Item',
      });
      alertService.alert('Error', message);
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

    const pantryId = currentItem.pantryId;
    const oldLocationId = currentItem.storageLocation?.id ?? null;
    const oldStorageState = currentItem.storageState;

    const optimisticPantryItem = enhanceWithVersion(
      currentItem,
      optimisticUpdate,
    );
    updateMutation({
      variables: { input: { ...updateInput, id: itemId } },
      optimisticResponse: {
        __typename: 'Mutation',
        updatePantryItem: {
          __typename: 'UpdatePantryItemSuccess',
          pantryItem: optimisticPantryItem,
        },
      },
      update(cache) {
        executeCacheUpdate(
          () => {
            // Update storageLocationCounts when location changed
            if (dirtyFields.location && oldLocationId !== selectedLocationId) {
              modifyPantryStats(cache, pantryId, existingStats => {
                if (!existingStats?.storageLocationCounts) return undefined;
                const counts = [...existingStats.storageLocationCounts];
                if (oldLocationId) {
                  const oldIdx = counts.findIndex(
                    (c: any) => c.storageLocationId === oldLocationId,
                  );
                  if (oldIdx >= 0) {
                    counts[oldIdx] = {
                      ...counts[oldIdx],
                      itemCount: Math.max(0, counts[oldIdx].itemCount - 1),
                    };
                  }
                }
                if (selectedLocationId) {
                  const newIdx = counts.findIndex(
                    (c: any) => c.storageLocationId === selectedLocationId,
                  );
                  if (newIdx >= 0) {
                    counts[newIdx] = {
                      ...counts[newIdx],
                      itemCount: counts[newIdx].itemCount + 1,
                    };
                  }
                }
                return { ...existingStats, storageLocationCounts: counts };
              });
            }

            // Update storageStateCounts when storage state changed
            if (dirtyFields.storageState) {
              const oldKey = stateToCountKey(oldStorageState);
              const newKey = stateToCountKey(input.storageState);
              if (oldKey !== newKey) {
                modifyPantryStats(cache, pantryId, existingStats => {
                  if (!existingStats?.storageStateCounts) return undefined;
                  return {
                    ...existingStats,
                    storageStateCounts: {
                      ...existingStats.storageStateCounts,
                      [oldKey]: Math.max(
                        0,
                        (existingStats.storageStateCounts[oldKey] || 0) - 1,
                      ),
                      [newKey]:
                        (existingStats.storageStateCounts[newKey] || 0) + 1,
                    },
                  };
                });
              }
            }
          },
          'Cache update failed for updatePantryItemFields:',
          refetch,
        );
      },
    }).catch(error => {
      console.error('Pantry item update failed:', error);
      // Error already handled by mutation's onError
    });

    onSuccess?.();
  };

  return { updatePantryItemFields };
}
