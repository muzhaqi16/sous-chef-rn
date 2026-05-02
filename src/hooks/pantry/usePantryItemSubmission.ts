import { useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#operations/pantry/pantry.generated';
import { StorageState } from '#/graphql/generated/schemaTypes';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  isPantryItemDuplicateError,
  getPantryItemDuplicateInfo,
} from '#/utils/errors/pantryItemDuplicate';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';

export interface PantryItemSubmissionParams {
  pantryId: string | undefined;
  itemName: string;
  quantityInput: string;
  unit: string;
  unitId: string | null;
  storageState: StorageState;
  showPackageDetails: boolean;
  packageSize: string;
  contentUnit: string;
  contentUnitId: string | null;
  itemNetWeight: string;
  weightUnitId: string | null;
  pantryNetWeight: string;
  pantryNetWeightUnitId: string | null;
  expirationDate: Date | null;
  selectedStorageLocationId: string | null;
  storageLocation: string;
  storageNotes: string;
  tags: string;
  brand: string;
  minQuantity: string;
  restockQuantity: string;
  onSuccess: () => void;
  handlePageChange: (index: number) => void;
}

export function usePantryItemSubmission(params: PantryItemSubmissionParams) {
  const {
    pantryId,
    itemName,
    quantityInput,
    unit,
    unitId,
    storageState,
    showPackageDetails,
    packageSize,
    contentUnit,
    contentUnitId,
    itemNetWeight,
    weightUnitId,
    pantryNetWeight,
    pantryNetWeightUnitId,
    expirationDate,
    selectedStorageLocationId,
    storageLocation,
    storageNotes,
    tags,
    brand,
    minQuantity,
    restockQuantity,
    onSuccess,
    handlePageChange,
  } = params;

  // Create mutation
  const [createPantryItem, { loading }] = useMutation(
    CreatePantryItemDocument,
    {
      update: (cache, { data }) => {
        const pantryItem = data?.createPantryItem?.pantryItem;
        if (!pantryItem || !pantryId) return;

        executeCacheUpdate(() => {
          const addToPantryCache = createAddToParentConnectionUpdater(
            'Pantry',
            'itemsConnection',
            'PantryItem',
          );
          addToPantryCache(cache, pantryId, pantryItem);
        }, 'Cache update failed for createPantryItem:');
      },
    },
  );

  // Restock mutation
  const [restockPantryItem] = useMutation(RestockPantryItemDocument, {});

  const handleConfirm = async () => {
    if (!pantryId) return;

    if (!itemName.trim()) {
      alertService.alert('Error', 'Please enter an item name');
      handlePageChange(0);
      return;
    }

    const quantity = parseFractionalInput(quantityInput);
    if (quantity === null || isNaN(quantity) || quantity <= 0) {
      alertService.alert('Error', 'Please enter a valid quantity');
      handlePageChange(1);
      return;
    }

    // Build itemUnits array if package details are provided (outside try for React Compiler)
    let itemUnits;
    let netWeight;
    let displayUnitId;
    let totalPackageNetWeight: number | undefined;
    if (showPackageDetails && packageSize && contentUnit) {
      const pkgSize = parseFloat(packageSize);
      if (!isNaN(pkgSize) && pkgSize > 0) {
        itemUnits = [
          {
            unitId: unitId || undefined,
            unitName: !unitId && unit.trim() ? unit.trim() : undefined,
            packageSize: pkgSize,
            contentUnitId: contentUnitId || undefined,
            contentUnitName: !contentUnitId ? contentUnit.trim() : undefined,
            retailUnit: true,
          },
          {
            unitId: contentUnitId || undefined,
            unitName: !contentUnitId ? contentUnit.trim() : undefined,
            isDefault: true,
          },
        ];
      }
      // Set net weight if provided
      if (itemNetWeight) {
        const nw = parseFloat(itemNetWeight);
        if (!isNaN(nw) && nw > 0) {
          netWeight = nw;
          displayUnitId = weightUnitId || undefined;
          if (netWeight !== undefined) {
            totalPackageNetWeight = pkgSize * netWeight;
          }
        }
      }
    }

    // Compute the effective pantry-level net weight
    const effectivePantryNetWeight = pantryNetWeight
      ? parseFloat(pantryNetWeight) || undefined
      : totalPackageNetWeight;
    const effectiveNetWeightUnitId =
      pantryNetWeightUnitId ||
      (totalPackageNetWeight ? displayUnitId : undefined);

    const mutationInput = {
      pantryId,
      quantity,
      unit:
        unitId || unit.trim()
          ? {
              unitId: unitId || undefined,
              unitName: !unitId && unit.trim() ? unit.trim() : undefined,
            }
          : undefined,
      storage: {
        storageState,
        storageLocationId: selectedStorageLocationId || undefined,
        storageLocationName:
          !selectedStorageLocationId && storageLocation.trim()
            ? storageLocation.trim()
            : undefined,
        storageNotes: storageNotes.trim() || undefined,
      },
      expiresAt: expirationDate
        ? expirationDate.toISOString().split('T')[0]
        : undefined,
      tags: tags
        ? tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean)
        : undefined,
      thresholds:
        minQuantity || restockQuantity
          ? {
              minQuantity: minQuantity ? parseFloat(minQuantity) : undefined,
              restockQuantity: restockQuantity
                ? parseFloat(restockQuantity)
                : undefined,
            }
          : undefined,
      netWeight:
        effectivePantryNetWeight || effectiveNetWeightUnitId
          ? {
              netWeight: effectivePantryNetWeight,
              netWeightUnitId: effectiveNetWeightUnitId,
            }
          : undefined,
      item: {
        name: itemName.trim(),
        brand: brand.trim() || undefined,
        units: itemUnits,
        netWeight: netWeight,
        displayUnitId: displayUnitId,
      },
    };

    const result = await executeMutation(
      () =>
        createPantryItem({
          variables: { input: mutationInput },
        }),
      'Create pantry item error:',
    );
    if (!result) {
      alertService.alert('Error', 'Failed to add item. Please try again.');
      return;
    }

    // Check for duplicate pantry item error (outside try for React Compiler)
    if (result.error && isPantryItemDuplicateError(result.error)) {
      const duplicateInfo = getPantryItemDuplicateInfo(result.error);
      if (duplicateInfo) {
        alertService.alert(
          'Item Already in Pantry',
          'This item is already in your pantry. Would you like to restock it or add a separate entry?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Restock',
              onPress: async () => {
                const restockResult = await executeMutation(
                  () =>
                    restockPantryItem({
                      variables: {
                        id: duplicateInfo.existingPantryItemId,
                        input: { quantity },
                      },
                    }),
                  'Restock pantry item error:',
                );
                if (!restockResult) {
                  alertService.alert(
                    'Error',
                    'Failed to restock item. Please try again.',
                  );
                  return;
                }
                onSuccess();
              },
            },
            {
              text: 'Add Anyway',
              onPress: async () => {
                const retryResult = await executeMutation(
                  () =>
                    createPantryItem({
                      variables: {
                        input: { ...mutationInput, forceAdd: true },
                      },
                    }),
                  'Force add pantry item error:',
                );
                if (!retryResult) {
                  alertService.alert(
                    'Error',
                    'Failed to add item. Please try again.',
                  );
                  return;
                }
                if (retryResult.data?.createPantryItem?.pantryItem) {
                  onSuccess();
                } else {
                  alertService.alert(
                    'Error',
                    'Failed to add item. Please try again.',
                  );
                }
              },
            },
          ],
        );
        return;
      }
    }

    if (result.data?.createPantryItem?.pantryItem) {
      onSuccess();
    } else if (result.error) {
      alertService.alert('Error', 'Failed to add item. Please try again.');
    }
  };

  return { handleConfirm, loading };
}
