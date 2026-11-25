/**
 * Local-first: the row is held until the server answers; the minted `input.id`
 * makes a replay converge.
 */

import { useAddShoppingRows } from '#features/shoppingList/hooks/useAddShoppingRows';
import { alertService } from '#services/alertService';
import { useTranslation } from '#i18n';
import type { ShoppingListItemInput } from './types';
import {
  normalizeNumericTextForApi,
  parseDecimalInput,
} from '#utils/parseDecimalInput';
import { parseFractionalInput } from '#utils/fractionUtils';
import { refByIdOrName, typedItemRef } from '#utils/refInput';
import { lineUnitFields } from '#features/shoppingList/utils/lineUnit';

interface UseAddShoppingItemOptions {
  listId: string | null | undefined;
}

export function useAddShoppingItem({ listId }: UseAddShoppingItemOptions) {
  const { t } = useTranslation();

  const { addRow } = useAddShoppingRows();

  /** `true` once the item is added or its create is queued; `false` when refused. */
  const addItem = async (input: ShoppingListItemInput): Promise<boolean> => {
    if (!listId) return false;

    // The manual-add form sends a raw FlexibleQuantity string, quick-add a number;
    // the string wins (the server parses it). The optimistic entity needs its
    // numeric value, fractions included ("1 1/2" → 1.5).
    const typedQuantity = input.quantityInput
      ? parseFractionalInput(input.quantityInput)
      : null;
    const optimisticQuantity =
      typedQuantity !== null && typedQuantity > 0
        ? typedQuantity
        : input.quantity ?? 1;

    // The typed text in API form: a comma device's "2,2" is refused as sent.
    const apiQuantityText =
      input.quantityInput == null
        ? null
        : normalizeNumericTextForApi(input.quantityInput);

    // `shoppingListId` rides on the batch input, not on the line.
    const line = {
      item: typedItemRef(input.itemName),
      quantity: apiQuantityText ?? input.quantity ?? 1,
      ...lineUnitFields(input.unitId, input.unitName),
      ...(input.notes && { notes: input.notes }),
      ...(input.category && { category: input.category }),
      ...(input.estimatedPrice && {
        pricing: { estimatedPrice: parseDecimalInput(input.estimatedPrice) },
      }),
      brand: refByIdOrName(input.brandId, input.brandName),
      // Net weight is all-or-nothing — only send when both value and unit are set.
      ...(input.netWeight !== undefined &&
        input.netWeightUnitId && {
          netWeight: {
            netWeight: input.netWeight,
            netWeightUnitId: input.netWeightUnitId,
          },
        }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.preferredStoreId && {
        storePrefs: { preferredStoreId: input.preferredStoreId },
      }),
    };

    const created = await addRow({
      listId,
      row: {
        itemName: input.itemName,
        quantity: optimisticQuantity,
        quantityInput: apiQuantityText,
        unitName: input.unitName ?? null,
        category: input.category ?? null,
        unitId: input.unitId,
      },
      line,
      fallback: t('errors.addItemFailed'),
    });
    if (created.failure) {
      alertService.alert(created.failure.title, created.failure.body);
    }
    return created.outcome === 'kept';
  };

  return { addItem };
}
