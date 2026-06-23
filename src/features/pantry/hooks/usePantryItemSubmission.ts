import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n/t';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  StorageState,
  ItemCondition,
  AcquisitionMethod,
} from '#/graphql/generated/schemaTypes';
import { generateEntityId } from '#/utils/generateEntityId';
import { addToPantryItemsCache } from '#hooks/home/pantry/utils';
import { buildOptimisticPantryItem } from '#hooks/home/pantry/buildOptimisticPantryItem';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  getPantryItemDuplicateFromResult,
  promptPantryDuplicate,
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
  condition: ItemCondition;
  tags: string;
  brand: string;
  category: string;
  minQuantity: string;
  restockQuantity: string;
  storeId: string | null;
  costPerUnit: string;
  acquisitionMethod: AcquisitionMethod;
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
    condition,
    tags,
    brand,
    category,
    minQuantity,
    restockQuantity,
    storeId,
    costPerUnit,
    acquisitionMethod,
    onSuccess,
    handlePageChange,
  } = params;

  const client = useApolloClient();

  // Create mutation
  const [createPantryItem, { loading }] = useMutation(
    CreatePantryItemDocument,
    {
      update: (cache, { data }) => {
        const payload = data?.createPantryItem;
        if (payload?.__typename !== 'CreatePantryItemPayload' || !pantryId)
          return;
        const pantryItem = payload.pantryItem;

        // Idempotent re-add (same cuid id) so the connection holds the
        // authoritative server entity.
        executeCacheUpdate(
          () => addToPantryItemsCache(cache, pantryId, pantryItem),
          'Cache update failed for createPantryItem:',
        );
      },
    },
  );

  // Restock mutation
  const [restockPantryItem] = useMutation(RestockPantryItemDocument, {});

  const handleConfirm = async () => {
    if (!pantryId) return;

    if (!itemName.trim()) {
      alertService.alert(t('labels.error'), t('errors.itemNameRequired'));
      handlePageChange(0);
      return;
    }

    const quantity = parseFractionalInput(quantityInput);
    if (quantity === null || isNaN(quantity) || quantity <= 0) {
      alertService.alert(t('labels.error'), t('errors.invalidQuantity'));
      handlePageChange(1);
      return;
    }

    // Net weight is all-or-nothing — a value without a unit would be rejected by
    // the API, so prompt the user to pick a unit instead of silently dropping it.
    if (pantryNetWeight.trim() && !pantryNetWeightUnitId) {
      alertService.alert(
        t('labels.error'),
        t('addToPantry.netWeightUnitRequired'),
      );
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

    // Purchase info — send only when the user provided something. `storeId`
    // comes from picking an existing store (PurchaseInfoInput has no free-text
    // store name). acquisitionMethod is always meaningful, so include it
    // whenever any purchase field is set (or the method isn't the default).
    const parsedCost = costPerUnit.trim() ? parseFloat(costPerUnit) : undefined;
    const costValue =
      parsedCost !== undefined && !isNaN(parsedCost) && parsedCost > 0
        ? parsedCost
        : undefined;
    const purchase =
      storeId ||
      costValue !== undefined ||
      acquisitionMethod !== AcquisitionMethod.Purchased
        ? {
            storeId: storeId || undefined,
            costPerUnit: costValue,
            acquisitionMethod,
          }
        : undefined;

    const id = generateEntityId();
    const mutationInput = {
      id,
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
        condition,
        storageLocationId: selectedStorageLocationId || undefined,
        storageLocationName:
          !selectedStorageLocationId && storageLocation.trim()
            ? storageLocation.trim()
            : undefined,
        storageNotes: storageNotes.trim() || undefined,
      },
      purchase,
      expiresAt: expirationDate
        ? expirationDate.toISOString().split('T')[0]
        : undefined,
      tags: tags
        ? tags
            .split(',')
            .map(tag => tag.trim())
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
      // NetWeightInput is all-or-nothing: the API rejects a partial input
      // (value without unit, or unit without value) with a
      // ValidationError(field: "netWeight"). Only send it when BOTH are present.
      netWeight:
        effectivePantryNetWeight && effectiveNetWeightUnitId
          ? {
              netWeight: effectivePantryNetWeight,
              netWeightUnitId: effectiveNetWeightUnitId,
            }
          : undefined,
      item: {
        name: itemName.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        units: itemUnits,
        netWeight: netWeight,
        displayUnitId: displayUnitId,
      },
    };

    // Write the item into the cache before firing, so it shows immediately and
    // stays if the create is queued offline (the queue replays it later, keyed by
    // this id).
    executeCacheUpdate(
      () =>
        addToPantryItemsCache(
          client.cache,
          pantryId,
          buildOptimisticPantryItem(id, {
            pantryId,
            itemName: itemName.trim(),
            quantity,
            unitId,
            unitName: unit.trim() || null,
            storageState,
            expiresAt: expirationDate ? expirationDate.toISOString() : null,
            location:
              !selectedStorageLocationId && storageLocation.trim()
                ? storageLocation.trim()
                : null,
            minQuantity: minQuantity ? parseFloat(minQuantity) : null,
          }),
        ),
      'Add Pantry Item (optimistic)',
    );

    const result = await executeMutation(
      () =>
        createPantryItem({
          variables: { input: mutationInput },
          context: { localFirst: true },
        }),
      'Create pantry item error:',
    );
    if (!result) {
      // Hard failure (threw) → revert the optimistic item.
      safeEvict(client.cache, 'PantryItem', id);
      alertService.alert(t('labels.error'), t('errors.addItemFailed'));
      return;
    }

    // Check for a duplicate (typed DuplicatePantryItemError member in `data` or
    // the legacy PANTRY_ITEM_ALREADY_EXISTS GraphQL error). Outside try for the
    // React Compiler.
    const duplicateInfo = getPantryItemDuplicateFromResult(
      result.data?.createPantryItem,
      result.error,
    );
    if (duplicateInfo) {
      // Already in the pantry → the server keeps the existing row, not our
      // optimistic cuid. Evict the phantom optimistic item.
      safeEvict(client.cache, 'PantryItem', id);
      promptPantryDuplicate({
        onRestock: async () => {
          const restockResult = await executeMutation(
            () =>
              restockPantryItem({
                variables: {
                  input: {
                    id: duplicateInfo.existingPantryItemId,
                    quantity,
                  },
                },
                // Local-first: replay-safe via syncRestockPantryItem (operationId
                // dedups the restock ledger row if the request is queued).
                context: {
                  localFirst: true,
                  operationId: generateEntityId(),
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
        onAddAnyway: async () => {
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
          if (
            retryResult.data?.createPantryItem?.__typename ===
            'CreatePantryItemPayload'
          ) {
            onSuccess();
          } else {
            alertService.alert(
              'Error',
              'Failed to add item. Please try again.',
            );
          }
        },
      });
      return;
    }

    const outcome = classifyCreateResult(
      result,
      'createPantryItem',
      'CreatePantryItemPayload',
    );
    if (outcome === 'rejected') {
      // The server refused the create — discard the item we showed.
      safeEvict(client.cache, 'PantryItem', id);
      alertService.alert(t('labels.error'), t('errors.addItemFailed'));
    } else {
      // 'created' or 'queued' — the item stays (and replays if queued offline).
      onSuccess();
    }
  };

  return { handleConfirm, loading };
}
