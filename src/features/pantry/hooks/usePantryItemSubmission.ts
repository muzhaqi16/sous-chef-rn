import { useApolloClient } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { AcquisitionMethod, UnitType } from '#/graphql/generated/schemaTypes';
import type { AddPantryItemFormData } from '#features/pantry/components/modals/AddToPantrySheet/addPantryItemFormConfig';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { usePantryRestock } from '#features/pantry/hooks/usePantryRestock';
import {
  findCachedPantryItemDuplicate,
  readStackUnit,
} from '#features/pantry/utils/pantryCacheReaders';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { promptPantryDuplicate } from '#domain/pantryItemDuplicate';
import { stockAmountOf } from '#domain/stockAmount';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { refByIdOrName } from '#/utils/refInput';
import { toDateKey } from '#/utils/dateUtils';

export function usePantryItemSubmission({
  pantryId,
  onSuccess,
}: {
  pantryId: string | undefined;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const { addItem, adding } = usePantryIntake(pantryId);
  const { restock } = usePantryRestock(pantryId);

  const handleConfirm = async ({
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
  }: AddPantryItemFormData) => {
    if (!pantryId) return;

    // No validation here. The sheet's yup schema owns it and reports on the
    // field; `handleSubmit` only reaches this on a valid form. `quantity` is
    // therefore known to parse.
    const quantity = parseFractionalInput(quantityInput);
    if (quantity === null) return;

    // Build itemUnits array if package details are provided
    let itemUnits;
    let netWeight;
    let displayUnitId;
    let totalPackageNetWeight: number | undefined;
    if (showPackageDetails && packageSize && contentUnit) {
      const pkgSize = parseDecimalInput(packageSize);
      if (!isNaN(pkgSize) && pkgSize > 0) {
        const packageUnit = refByIdOrName(unitId, unit);
        const packageContentUnit = refByIdOrName(contentUnitId, contentUnit);
        if (packageUnit && packageContentUnit) {
          itemUnits = [
            {
              unit: packageUnit,
              packageSize: pkgSize,
              contentUnit: packageContentUnit,
              retailUnit: true,
            },
            { unit: packageContentUnit, isDefault: true },
          ];
        }
      }
      // Per-container net weight is all-or-nothing too: `item.netWeight`
      // without `displayUnitId` means nothing to the server. The form's
      // `item-net-weight-needs-unit` rule reports it on the field first.
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

    // Sent only when the user gave some: `storeId` comes from a picked store
    // (no free-text store name), and `acquisitionMethod` rides along with any
    // purchase field or a non-default method.
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

    const expiresOn = expirationDate ? toDateKey(expirationDate) : undefined;
    const tagList = tags
      ? tags
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean)
      : undefined;
    // NetWeightInput is all-or-nothing: the API rejects a partial input (value
    // without unit, or unit without value) with a ValidationError(field:
    // "netWeight"). Only send it when BOTH are present.
    const statedNetWeight =
      effectivePantryNetWeight && effectiveNetWeightUnitId
        ? {
            netWeight: effectivePantryNetWeight,
            netWeightUnitId: effectiveNetWeightUnitId,
          }
        : null;
    const input = {
      quantity,
      unit: refByIdOrName(unitId, unit),
      storage: {
        storageState,
        condition,
        location: refByIdOrName(selectedStorageLocationId, storageLocation),
        storageNotes: storageNotes.trim() || undefined,
      },
      purchase,
      expiresOn,
      tags: tagList,
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
      netWeight: statedNetWeight ?? undefined,
      item: {
        inline: {
          name: itemName.trim(),
          brand: brand.trim() || undefined,
          category: refByIdOrName(null, category),
          units: itemUnits,
          netWeight: netWeight,
          displayUnitId: displayUnitId,
        },
      },
    };

    // What the row shows until the server answers, beyond what `input` states.
    const local = {
      unitId,
      expiresOn: expiresOn ?? null,
      location:
        !selectedStorageLocationId && storageLocation.trim()
          ? storageLocation.trim()
          : null,
      minQuantity: minQuantity ? parseDecimalInput(minQuantity) : null,
      restockQuantity: restockQuantity
        ? parseDecimalInput(restockQuantity)
        : null,
      condition,
      acquisitionMethod,
      costPerUnit: costValue ?? null,
      storageNotes: storageNotes.trim() || null,
      tags: tagList ?? [],
    };

    /**
     * The shared recovery for "you already have this". Reached from the local
     * cache check below and, when that could not see the row, from the server's
     * refusal — so both offer the same choice.
     */
    const promptDuplicateRecovery = (existingPantryItemId: string) => {
      const restockExisting = async () => {
        // A stated size is one package's, so it goes with a whole count on a
        // counted stack (2 jars), never with an amount; the server does the
        // arithmetic. A stack the cache does not hold takes the plain amount.
        const amount = stockAmountOf(quantity, {
          asPackages:
            statedNetWeight !== null &&
            Number.isInteger(quantity) &&
            readStackUnit(client.cache, existingPantryItemId)?.type ===
              UnitType.Count,
          packageSize: statedNetWeight,
        });
        const restocked = await restock(existingPantryItemId, {
          amount,
          // Forward the purchase details the user just entered so the
          // restock records an ItemPriceHistory observation.
          ...(costValue !== undefined && { costPerUnit: costValue }),
          ...(storeId && { storeId }),
          ...(expiresOn && { expiresOn }),
          present: 'alert',
        });
        if (restocked.status === 'rejected') return;
        onSuccess();
      };
      // The restock never rejects, so it needs no catch here.
      promptPantryDuplicate({
        onRestock: () => {
          void restockExisting();
        },
      });
    };

    // The pantry answers "do I stock this?" itself, so no doomed create queues.
    // The server refuses only the item IN THAT UNIT: name plus unit id, where a
    // blank unit (the tracking unit) matches any; free text is the server's.
    const cachedDuplicate =
      unitId || !unit.trim()
        ? findCachedPantryItemDuplicate(client.cache, pantryId, {
            itemName: itemName.trim(),
            unitId,
          })
        : null;
    if (cachedDuplicate) {
      promptDuplicateRecovery(cachedDuplicate.existingPantryItemId);
      return;
    }

    // A refusal naming a field (`netWeight` is reachable from this form) reads
    // as its localized `errors.field.*` copy.
    const outcome = await addItem(itemName.trim(), input, {
      local,
      present: 'alert',
      fallback: t('errors.addItemFailed'),
    });
    // Backstop for what the local check could not see — a windowed list, or a
    // collaborator's add.
    if (outcome.status === 'duplicate') {
      promptDuplicateRecovery(outcome.existingPantryItemId);
      return;
    }
    // Applied or queued — the item stays (and replays if queued offline).
    if (outcome.status === 'added') onSuccess();
  };

  return { handleConfirm, loading: adding };
}
