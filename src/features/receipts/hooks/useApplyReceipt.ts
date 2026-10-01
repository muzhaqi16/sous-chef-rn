import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { AcquisitionMethod } from '#/graphql/generated/schemaTypes';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { useMoveToPantry } from '#features/shoppingList/hooks/useMoveToPantry';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { refByIdOrName } from '#/utils/refInput';
import {
  useReceiptDraftStore,
  type ReceiptLineChoice,
} from '../store/receiptDraftStore';

export interface ReceiptLineFailure {
  index: number;
  reason: string;
}

export interface ReceiptApplyLine {
  index: number;
  choice: ReceiptLineChoice;
  /** The open shopping-list line it ticks off instead of adding on its own. */
  listLine?: ShoppingListItemDisplayFragment;
}

// The total is the API's authoritative figure; it derives the rate per unit.
const purchaseOf = (choice: ReceiptLineChoice) =>
  choice.price === null
    ? { acquisitionMethod: AcquisitionMethod.Purchased }
    : {
        acquisitionMethod: AcquisitionMethod.Purchased,
        totalCost: choice.price,
      };

// A bare 1 with no unit is left to the API: one, or the item's package size,
// rather than one of its tracking unit (1 mL of milk).
const statedQuantity = (choice: ReceiptLineChoice) =>
  choice.unitId || choice.unitText || choice.quantity !== 1
    ? choice.quantity
    : undefined;

/**
 * Adds a receipt's chosen lines to the current pantry. A line on the shopping
 * list is moved from it, which marks it bought; any other is added, with
 * `forceAdd` so an item the pantry already holds is restocked, not refused.
 */
export function useApplyReceipt(listId: string | undefined) {
  const { t } = useTranslation();
  const { pantry } = useCurrentPantry();
  const pantryId = pantry?.id;
  const { addItem } = usePantryIntake(pantryId);
  const { moveToPantry } = useMoveToPantry({
    currentListId: listId,
    present: 'none',
  });
  const markAdded = useReceiptDraftStore(state => state.markAdded);
  const [applying, setApplying] = useState(false);
  const [failures, setFailures] = useState<ReceiptLineFailure[]>([]);

  const addOnItsOwn = async (choice: ReceiptLineChoice) => {
    const outcome = await addItem(choice.itemName, {
      item: choice.itemId
        ? { id: choice.itemId }
        : { inline: { name: choice.itemName } },
      quantity: statedQuantity(choice),
      unit: refByIdOrName(choice.unitId, choice.unitText),
      forceAdd: true,
      purchase: purchaseOf(choice),
    });
    switch (outcome.status) {
      case 'added':
        return null;
      case 'rejected':
        return outcome.reason;
      case 'duplicate':
        // `forceAdd` means the API restocks rather than refusing; an older one may not.
        return t('errors.addItemFailedRetry');
    }
  };

  const moveFromList = async (
    choice: ReceiptLineChoice,
    listLine: ShoppingListItemDisplayFragment,
  ) => {
    if (!pantryId) return t('errors.moveToPantryFailedRetry');
    // The amount the review shows: a move takes no default from the API.
    const { quantity } = choice;
    // A typed unit links only to a line in that unit, so the line's id stands for it.
    const unitId =
      choice.unitId ?? (choice.unitText ? listLine.unit?.id : undefined);
    const outcome = await moveToPantry(listLine, {
      pantryId,
      actualQuantity: quantity,
      actualUnitId: unitId,
      removeFromList: true,
      // Per unit, as the move takes it.
      actualPrice: choice.price === null ? undefined : choice.price / quantity,
    });
    return outcome.status === 'moved' ? null : outcome.reason;
  };

  const apply = async (lines: readonly ReceiptApplyLine[]) => {
    setApplying(true);
    const added: number[] = [];
    const failed: ReceiptLineFailure[] = [];
    // One at a time, so a long receipt never puts dozens of writes in flight at once.
    for (const { index, choice, listLine } of lines) {
      const reason = listLine
        ? await moveFromList(choice, listLine)
        : await addOnItsOwn(choice);
      if (reason === null) added.push(index);
      else failed.push({ index, reason });
    }
    markAdded(added);
    setFailures(failed);
    setApplying(false);
    return { added: added.length, failed: failed.length };
  };

  return { pantryName: pantry?.name ?? null, applying, failures, apply };
}
