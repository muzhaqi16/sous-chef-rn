import { useTranslation } from '#/i18n';
import { AcquisitionMethod } from '#/graphql/generated/schemaTypes';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { contentsOf, statedContents } from '#domain/stockAmount';
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
  const asksCost = useBudgetAndPricesEnabled();

  const handleConfirm = async ({
    itemName,
    quantityInput,
    unit,
    unitId,
    unitType,
    sizeInput,
    sizeUnitDisplay,
    sizeUnitId,
    sizeUnitType,
    storageState,
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

    const { packageSize, measurementProfile } = contentsOf(
      statedContents({
        unitType,
        sizeInput,
        sizeUnitDisplay,
        sizeUnitId,
        sizeUnitType,
      }),
    );

    // Sent only when the user gave some: `storeId` comes from a picked store
    // (no free-text store name), and `acquisitionMethod` rides along with any
    // purchase field or a non-default method. With prices off, no cost is sent,
    // whatever the hidden field holds.
    const parsedCost =
      asksCost && costPerUnit.trim()
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
      netWeight: packageSize ?? undefined,
      measurementProfile,
      item: {
        inline: {
          name: itemName.trim(),
          brand: brand.trim() || undefined,
          category: refByIdOrName(null, category),
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
    // held product joins its stack or opens its own, never refused.
    if (outcome.status === 'added') onSuccess();
  };

  return { handleConfirm, loading: adding };
}
