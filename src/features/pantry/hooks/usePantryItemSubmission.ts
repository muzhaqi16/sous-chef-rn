import { useTranslation } from '#/i18n';
import { AcquisitionMethod } from '#/graphql/generated/schemaTypes';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { refByIdOrName } from '#/utils/refInput';
import { toDateKey } from '#/utils/dateUtils';
import type { AddPantryItemFormData } from '#features/pantry/types';

export function usePantryItemSubmission({
  pantryId,
  onSuccess,
}: {
  pantryId: string | undefined;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const { addItem, adding } = usePantryIntake(pantryId);

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

    // A refusal naming a field (`netWeight` is reachable from this form) reads
    // as its localized `errors.field.*` copy.
    const outcome = await addItem(itemName.trim(), input, {
      local,
      present: 'alert',
      fallback: t('errors.addItemFailed'),
    });
    // Applied or queued — the item stays (and replays if queued offline). A
    // held product joins its stack or stands apart from it, never refused.
    if (outcome.status === 'added') onSuccess();
  };

  return { handleConfirm, loading: adding };
}
