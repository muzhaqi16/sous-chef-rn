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
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { writePantryItemDetailStub } from '#features/pantry/hooks/writePantryItemDetailStub';
import {
  addToPantryItemsCache,
  addPantryItemLocally,
  revertOptimisticPantryItem,
} from '#features/pantry/cache/items';
import { buildOptimisticPantryItem } from '#features/pantry/hooks/buildOptimisticPantryItem';
import { findCachedPantryItemDuplicate } from '#features/pantry/utils/pantryCacheReaders';
import { adoptServerEntityId } from '#/apollo/utils/cacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  alertIfRejected,
  alertRejectedMutation,
} from '#/apollo/utils/alertRejectedMutation';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  getPantryItemDuplicateFromResult,
  promptPantryDuplicate,
} from '#domain/pantryItemDuplicate';
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
  } = params;

  const client = useApolloClient();

  // Create mutation
  const [createPantryItem, { loading }] = useMutation(
    CreatePantryItemDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = data?.createPantryItem;
        if (payload?.__typename !== 'CreatePantryItemPayload' || !pantryId)
          return;
        const pantryItem = payload.pantryItem;
        // Read outside the try: `?.` is a value block, and one inside a try
        // body bails the React Compiler out of the whole hook.
        const clientId = variables?.input?.id;

        // Idempotent re-add (same cuid id) so the connection holds the
        // authoritative server entity.
        try {
          addToPantryItemsCache(cache, pantryId, pantryItem);
          // The re-add above dedupes BY ID, so if the server resolved the
          // create to a different row the client cuid survives as a second,
          // permanently unresolvable edge — tapping it 404s for the rest of
          // the session. Read the client id off this mutation's own variables
          // so overlapping creates stay correct.
          adoptServerEntityId(cache, 'PantryItem', pantryItem.id, clientId);
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

    // No validation here. The sheet's yup schema owns it and reports on the
    // field; `handleSubmit` only reaches this on a valid form. `quantity` is
    // therefore known to parse.
    const quantity = parseFractionalInput(quantityInput);
    if (quantity === null) return;

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
      // Per-container net weight, and it is all-or-nothing here too: a bare
      // `item.netWeight` with no `displayUnitId` is a number the server cannot
      // interpret, and it fed a pantry-level `NetWeightInput` that the
      // both-or-neither guard below then dropped. The form's
      // `item-net-weight-needs-unit` rule reports the missing unit on the
      // field; this is the second line of defence, matching the guard below.
      if (itemNetWeight && weightUnitId) {
        const nw = parseDecimalInput(itemNetWeight);
        if (!isNaN(nw) && nw > 0) {
          netWeight = nw;
          displayUnitId = weightUnitId;
          totalPackageNetWeight = pkgSize * nw;
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
    // The cache write below publishes this id to `Pantry.itemsConnection`,
    // which makes the row tappable — and its detail/edit screens query by this
    // id. Hold those queries off until the server has a row to answer with;
    // otherwise they can only get RESOURCE_NOT_FOUND. See `unconfirmedCreates`.
    unconfirmedCreates.mark(id);
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
    // The detail screens read a wider fragment than the list, so the optimistic
    // entity is materialized for both or a fresh row dead-ends on tap. Built out
    // here because a value block inside a try body bails the compiler.
    const detailStubFields = {
      itemName: itemName.trim(),
      condition,
      acquisitionMethod,
      quantity,
      costPerUnit: costValue ?? null,
      storageNotes: storageNotes.trim() || null,
      restockQuantity: restockQuantity
        ? parseDecimalInput(restockQuantity)
        : null,
      tags: tags
        ? tags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean)
        : [],
    };
    // Publishing and withdrawing the optimistic row are a pair, and the
    // force-add retry below has to do both again after the duplicate branch
    // has withdrawn it. Named here so the two halves cannot drift.
    const applyOptimisticItem = () => {
      try {
        // Publishes the row AND counts it. The count cannot live in the
        // mutation's `update:` callback — that only runs with a server
        // payload, so offline the row would appear while the header kept the
        // old count. The helper counts only a row it actually added, so the
        // force-add retry below cannot double-count.
        addPantryItemLocally(client.cache, pantryId, optimisticItem);
        writePantryItemDetailStub(client.cache, id, detailStubFields);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Add Pantry Item (optimistic)',
        });
      }
    };
    const revertOptimisticItem = () => {
      revertOptimisticPantryItem(client.cache, pantryId, id);
    };
    /**
     * The shared recovery for "you already have this". Reached from the local
     * cache check below and, when that could not see the row, from the server's
     * refusal — so both offer the same choice.
     */
    const promptDuplicateRecovery = (existingPantryItemId: string) => {
      promptPantryDuplicate({
        onRestock: async () => {
          let restockResult;
          const restockPantryItemOptions = {
            variables: {
              input: {
                id: existingPantryItemId,
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
          // Nothing is on screen at this point — either no row was ever
          // published, or the refusal branch withdrew it — so publish before
          // firing, or a force-add that queues offline shows nothing until the
          // replay lands. The id is reused deliberately: no row was committed
          // under it, and reusing it is what makes the replay idempotent.
          unconfirmedCreates.mark(id);
          applyOptimisticItem();
          let retryResult;
          try {
            retryResult = await createPantryItem({
              variables: {
                input: { ...mutationInput, forceAdd: true },
              },
              // Same local-first contract as the first attempt: without it the
              // force-add is the one add on this screen that cannot queue.
              context: { localFirst: true },
            });
          } catch (error) {
            errorService.reportError(error, {
              operation: 'Force add pantry item error:',
            });
          }
          unconfirmedCreates.confirm(id);
          if (!retryResult) {
            revertOptimisticItem();
            alertService.alert(
              t('labels.error'),
              t('errors.addItemFailedRetry'),
            );
            return;
          }
          // `alertIfRejected`, not a payload-typename check: a retry whose first
          // attempt did commit answers ConflictError(IDEMPOTENT_REPLAY), a
          // successful no-op. Not `alertRejectedMutation` either — this mutation
          // has no `onError`, so the resolved-`error` case would go unreported.
          if (alertIfRejected(retryResult, t('errors.addItemFailedRetry'))) {
            revertOptimisticItem();
            return;
          }
          onSuccess();
        },
      });
    };

    // Offline-first: the pantry answers "do I already stock this?" itself, so
    // nothing is published and no doomed create is queued. This form sends an
    // inline item and has no catalog id, so it matches on the name — the same
    // resolution the server does — and only ever prompts, never acts on it.
    const cachedDuplicate = findCachedPantryItemDuplicate(
      client.cache,
      pantryId,
      {
        itemName: itemName.trim(),
      },
    );
    if (cachedDuplicate) {
      // Nothing was published under this id; release the detail-read gate the
      // force-add path re-claims for itself.
      unconfirmedCreates.confirm(id);
      promptDuplicateRecovery(cachedDuplicate.existingPantryItemId);
      return;
    }

    applyOptimisticItem();

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
    // Released on every outcome: acknowledged and rejected both leave nothing
    // for a detail read to miss, and a create that went to the queue has
    // already been handed off to `queueStore`'s pending set by now.
    unconfirmedCreates.confirm(id);
    if (!result) {
      // Hard failure (threw) → revert the optimistic item.
      revertOptimisticItem();
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
      // Backstop for what the local check could not see — a windowed list, or a
      // collaborator's add. The server writes nothing on a refusal, so withdraw
      // the row we published, count included.
      revertOptimisticItem();
      promptDuplicateRecovery(duplicateInfo.existingPantryItemId);
      return;
    }

    const outcome = classifyCreateResult(result);
    if (outcome === 'rejected') {
      // The server refused the create — discard the item we showed.
      revertOptimisticItem();
      // The create document selects `... on ValidationError { field }`, and a
      // refusal that names a field has localized copy under `errors.field.*`
      // (`netWeight` is reachable from this form). A fixed string threw that
      // away and told the user only that "something" failed.
      // `alertIfRejected` rather than `alertRejectedMutation`: this mutation
      // has no `onError`, so the resolved-`error` case needs telling too.
      alertIfRejected(result, t('errors.addItemFailed'));
    } else {
      // 'created' or 'queued' — the item stays (and replays if queued offline).
      onSuccess();
    }
  };

  return { handleConfirm, loading };
}
