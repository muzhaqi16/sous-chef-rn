import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n';
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
import { addToPantryItemsCache } from '#/apollo/utils/pantryCacheUpdaters';
import { buildOptimisticPantryItem } from '#features/pantry/hooks/buildOptimisticPantryItem';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  getPantryItemDuplicateFromResult,
  promptPantryDuplicate,
} from '#/utils/errors/pantryItemDuplicate';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { errorService } from '#/services/errorService';

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
        try {
          addToPantryItemsCache(cache, pantryId, pantryItem);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for createPantryItem:',
          });
        }
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
        t('labels.pleaseSelectAUnitForTheNetWeight'),
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
      const pkgSize = parseDecimalInput(packageSize);
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
        const nw = parseDecimalInput(itemNetWeight);
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
      ? parseDecimalInput(pantryNetWeight) || undefined
      : totalPackageNetWeight;
    const effectiveNetWeightUnitId =
      pantryNetWeightUnitId ||
      (totalPackageNetWeight ? displayUnitId : undefined);

    // Purchase info — send only when the user provided something. `storeId`
    // comes from picking an existing store (PurchaseInfoInput has no free-text
    // store name). acquisitionMethod is always meaningful, so include it
    // whenever any purchase field is set (or the method isn't the default).
    const parsedCost = costPerUnit.trim()
      ? parseDecimalInput(costPerUnit)
      : undefined;
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
      // Full ISO DateTime — the schema scalar is DateTime and every other
      // write path sends the complete timestamp (a bare date relies on
      // unspecified server coercion).
      expiresAt: expirationDate ? expirationDate.toISOString() : undefined,
      tags: tags
        ? tags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean)
        : undefined,
      thresholds:
        minQuantity || restockQuantity
          ? {
              minQuantity: minQuantity
                ? parseDecimalInput(minQuantity)
                : undefined,
              restockQuantity: restockQuantity
                ? parseDecimalInput(restockQuantity)
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
    // Built before the try: the conditionals below are value blocks, and the
    // React Compiler bails out of a hook when one appears inside a try body.
    const optimisticItem = buildOptimisticPantryItem(
      id,
      {
        pantryId,
        itemName: itemName.trim(),
        quantity,
        unitId,
        storageState,
        expiresAt: expirationDate ? expirationDate.toISOString() : null,
        location:
          !selectedStorageLocationId && storageLocation.trim()
            ? storageLocation.trim()
            : null,
        minQuantity: minQuantity ? parseDecimalInput(minQuantity) : null,
      },
      client.cache,
    );
    try {
      addToPantryItemsCache(client.cache, pantryId, optimisticItem);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Pantry Item (optimistic)',
      });
    }

    let result;
    try {
      result = await createPantryItem({
        variables: { input: mutationInput },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Create pantry item error:',
      });
    }
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
          let restockResult;
          const restockPantryItemOptions = {
            variables: {
              input: {
                id: duplicateInfo.existingPantryItemId,
                quantity,
                // Forward the purchase details the user just entered so the
                // restock records an ItemPriceHistory observation instead of
                // discarding cost/store/expiry on the duplicate path.
                ...(costValue !== undefined && { costPerUnit: costValue }),
                ...(storeId && { storeId }),
                ...(expirationDate && {
                  expiresAt: expirationDate.toISOString(),
                }),
                // idempotencyKey dedups the restock ledger row on replay.
                idempotencyKey: generateEntityId(),
              },
            },
            // Local-first: queued offline, replayed as the canonical
            // mutation (deduped by its idempotencyKey).
            context: { localFirst: true },
          };
          try {
            restockResult = await restockPantryItem(restockPantryItemOptions);
          } catch (error) {
            errorService.reportError(error, {
              operation: 'Restock pantry item error:',
            });
          }
          // executeMutation returns false only when the call threw; under
          // errorPolicy 'all' a transport/GraphQL error instead resolves as
          // `{ error }`. restockPantryItem has no `onError`, so surface both the
          // throw and the resolved-error cases here.
          if (!restockResult || restockResult.error) {
            alertService.alert(
              t('labels.error'),
              t('errors.restockFailedRetry'),
            );
            return;
          }
          // A resolved non-success union member carries no `error`, so classify
          // it — a bare falsy check would treat the refusal as success.
          if (classifyCreateResult(restockResult) === 'rejected') {
            alertRejectedMutation(
              restockResult,
              t('errors.restockFailedRetry'),
            );
            return;
          }
          onSuccess();
        },
        onAddAnyway: async () => {
          let retryResult;
          try {
            retryResult = await createPantryItem({
              variables: {
                input: { ...mutationInput, forceAdd: true },
              },
            });
          } catch (error) {
            errorService.reportError(error, {
              operation: 'Force add pantry item error:',
            });
          }
          if (!retryResult) {
            alertService.alert(
              t('labels.error'),
              t('errors.addItemFailedRetry'),
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
              t('labels.error'),
              t('errors.addItemFailedRetry'),
            );
          }
        },
      });
      return;
    }

    const outcome = classifyCreateResult(result);
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
