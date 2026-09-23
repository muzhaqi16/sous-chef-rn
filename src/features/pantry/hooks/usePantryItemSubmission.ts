import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import type {
  StorageState,
  ItemCondition,
} from '#/graphql/generated/schemaTypes';
import { AcquisitionMethod } from '#/graphql/generated/schemaTypes';
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
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  getPantryItemDuplicateFromResult,
  promptPantryDuplicate,
} from '#domain/pantryItemDuplicate';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { errorService } from '#/services/errorService';
import { toDateKey } from '#/utils/dateUtils';

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

  const { t } = useTranslation();
  const client = useApolloClient();

  // Create mutation
  const [createPantryItem, { loading }] = useMutation(
    CreatePantryItemDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = appliedPayload(data);
        if (!payload || !pantryId) return;
        const pantryItem = payload.pantryItem;
        // Read outside the try: `?.` is a value block, and one inside a try
        // body bails the React Compiler out of the whole hook.
        const clientId = variables?.input.id;

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
            unitId: unitId ?? undefined,
            unitName: !unitId && unit.trim() ? unit.trim() : undefined,
            packageSize: pkgSize,
            contentUnitId: contentUnitId ?? undefined,
            contentUnitName: !contentUnitId ? contentUnit.trim() : undefined,
            retailUnit: true,
          },
          {
            unitId: contentUnitId ?? undefined,
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
      pantryNetWeightUnitId ??
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
            storeId: storeId ?? undefined,
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
              unitId: unitId ?? undefined,
              unitName: !unitId && unit.trim() ? unit.trim() : undefined,
            }
          : undefined,
      storage: {
        storageState,
        condition,
        storageLocationId: selectedStorageLocationId ?? undefined,
        storageLocationName:
          !selectedStorageLocationId && storageLocation.trim()
            ? storageLocation.trim()
            : undefined,
        storageNotes: storageNotes.trim() || undefined,
      },
      purchase,
      expiresOn: expirationDate ? toDateKey(expirationDate) : undefined,
      today: toDateKey(new Date()),
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
        expiresOn: expirationDate ? toDateKey(expirationDate) : null,
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
    // Publishing and withdrawing the optimistic row are a pair; named here so
    // the two halves cannot drift.
    const applyOptimisticItem = () => {
      try {
        // Publishes the row AND counts it. The count cannot live in the
        // mutation's `update:` callback — that only runs with a server
        // payload, so offline the row would appear while the header kept the
        // old count.
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
      const restockExisting = async () => {
        const settled = await settleMutation(
          () =>
            restockPantryItem({
              variables: {
                input: {
                  id: existingPantryItemId,
                  quantity,
                  // Forward the purchase details the user just entered so the
                  // restock records an ItemPriceHistory observation.
                  ...(costValue !== undefined && { costPerUnit: costValue }),
                  ...(storeId && { storeId }),
                  ...(expirationDate && {
                    expiresOn: toDateKey(expirationDate),
                  }),
                  // These packages' own size; without it the batch takes the
                  // stack's default, which may be another size (a 22 oz jar
                  // on a 32 oz stack).
                  ...(effectivePantryNetWeight &&
                    effectiveNetWeightUnitId && {
                      packageSize: {
                        netWeight: effectivePantryNetWeight,
                        netWeightUnitId: effectiveNetWeightUnitId,
                      },
                    }),
                  // idempotencyKey dedups the restock ledger row on replay.
                  idempotencyKey: generateEntityId(),
                },
              },
              // Local-first: queued offline, replayed as the canonical
              // mutation (deduped by its idempotencyKey).
              context: { localFirst: true },
            }),
          {
            document: RestockPantryItemDocument,
            fallback: t('errors.restockFailedRetry'),
          },
        );
        if (settled.status === 'failed') return;
        onSuccess();
      };
      // `settleMutation` never rejects, so the restock needs no catch here.
      promptPantryDuplicate({
        onRestock: () => {
          void restockExisting();
        },
      });
    };

    // Offline-first: the pantry answers "do I already stock this?" itself, so
    // nothing is published and no doomed create is queued. The server refuses
    // only the item IN THAT UNIT, so the match is name plus unit id. A blank
    // unit resolves server-side to the item's tracking unit, which a held stack
    // almost always is, so it matches any held unit; free text is the server's.
    const cachedDuplicate =
      unitId || !unit.trim()
        ? findCachedPantryItemDuplicate(client.cache, pantryId, {
            itemName: itemName.trim(),
            unitId,
          })
        : null;
    if (cachedDuplicate) {
      // Nothing was published under this id; release the detail-read gate.
      unconfirmedCreates.confirm(id);
      promptDuplicateRecovery(cachedDuplicate.existingPantryItemId);
      return;
    }

    applyOptimisticItem();

    let result;
    let thrown: unknown;
    try {
      result = await createPantryItem({
        variables: { input: mutationInput, today: mutationInput.today },
        context: { localFirst: true },
      });
    } catch (error) {
      thrown = error;
    }
    // Released on every outcome: acknowledged and rejected both leave nothing
    // for a detail read to miss, and a create that went to the queue has
    // already been handed off to `queueStore`'s pending set by now.
    unconfirmedCreates.confirm(id);

    // A duplicate arrives as a typed DuplicatePantryItemError member in `data`
    // or as the legacy PANTRY_ITEM_ALREADY_EXISTS GraphQL error.
    const answered = result;
    const duplicateInfo = answered
      ? getPantryItemDuplicateFromResult(
          answered.data?.createPantryItem,
          answered.error,
        )
      : null;
    if (duplicateInfo) {
      // Backstop for what the local check could not see — a windowed list, or a
      // collaborator's add. The server writes nothing on a refusal, so withdraw
      // the row we published, count included.
      revertOptimisticItem();
      promptDuplicateRecovery(duplicateInfo.existingPantryItemId);
      return;
    }

    // A refusal naming a field (`netWeight` is reachable from this form) reads
    // as its localized `errors.field.*` copy.
    const settled = await settleMutation(
      () => (answered ? Promise.resolve(answered) : Promise.reject(thrown)),
      {
        document: CreatePantryItemDocument,
        fallback: t('errors.addItemFailed'),
        onFailed: revertOptimisticItem,
      },
    );
    // Applied or queued — the item stays (and replays if queued offline).
    if (settled.status !== 'failed') onSuccess();
  };

  return { handleConfirm, loading };
}
