import { useState } from 'react';
import { useTranslation } from '#/i18n';
import {
  AcquisitionMethod,
  PriceSource,
  type ReceiptRefInput,
  type StockAmountInput,
} from '#/graphql/generated/schemaTypes';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { useMoveToPantry } from '#features/shoppingList/hooks/useMoveToPantry';
import type { ShoppingListItemNode } from '#features/shoppingList/hooks/usePaginatedShoppingItems';
import { refByIdOrName } from '#/utils/refInput';
import {
  boughtAmountOf,
  stockAmountOf,
  type HeldUnit,
} from '#domain/stockAmount';
import { errorService } from '#/services/errorService';
import {
  useReceiptDraftActions,
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
  listLine?: ShoppingListItemNode;
}

// A bare 1 with no unit is left to the API: one, or the item's package size,
// rather than one of its tracking unit (1 mL of milk).
const statedQuantity = (choice: ReceiptLineChoice) =>
  choice.unitId || choice.unitText || choice.quantity !== 1
    ? choice.quantity
    : undefined;

const namesUnit = (choice: ReceiptLineChoice) =>
  choice.unitId !== null || choice.unitText !== '';

// What an add off the list records. A printed count with no unit (2 @) is what
// was bought, as its stack counts it; null for a part of something no unit names.
const intakeOf = (choice: ReceiptLineChoice, heldUnit: HeldUnit) => {
  const quantity = statedQuantity(choice);
  if (quantity === undefined) return {};
  if (namesUnit(choice)) {
    return { quantity, unit: refByIdOrName(choice.unitId, choice.unitText) };
  }
  return Number.isInteger(quantity)
    ? { amount: boughtAmountOf(quantity, { heldUnit }) }
    : null;
};

// The total is the API's authoritative figure; it derives the unit price.
const purchaseOf = (choice: ReceiptLineChoice, receipt: ReceiptRefInput) => ({
  acquisitionMethod: AcquisitionMethod.Purchased,
  receipt,
  priceSource: PriceSource.ReceiptScan,
  ...(choice.price === null ? {} : { totalCost: choice.price }),
});

/**
 * What a move records for a receipt line, as the receipt states it: the API
 * owns the package arithmetic. A line with a unit is that amount. A printed
 * count (2 @) on a line in a unit is that many packages, which the server
 * turns into the line's unit; a bare 1 says only that it was bought, so the
 * list's amount stands. With no unit on either, it is what was bought, as its
 * stack counts it; null for a part of something no unit names.
 */
const lineAmountOf = (
  choice: ReceiptLineChoice,
  line: ShoppingListItemNode,
  heldUnit: HeldUnit,
): StockAmountInput | null => {
  const lineUnit = line.unit;
  if (namesUnit(choice)) {
    // A typed unit links only to a line in that unit, so the line's id stands for it.
    return stockAmountOf(choice.quantity, {
      unitId: choice.unitId ?? lineUnit?.id,
    });
  }
  if (!lineUnit) {
    return Number.isInteger(choice.quantity)
      ? boughtAmountOf(choice.quantity, { heldUnit })
      : null;
  }
  if (choice.quantity !== 1 && Number.isInteger(choice.quantity)) {
    return stockAmountOf(choice.quantity, { asPackages: true });
  }
  return stockAmountOf(line.quantity ?? choice.quantity, {
    unitId: lineUnit.id,
  });
};

/**
 * Adds a receipt's chosen lines to the current pantry. A line on the shopping
 * list is moved from it, which marks it bought; any other is added, with
 * `forceAdd` so an item the pantry already holds is restocked, not refused.
 */
export function useApplyReceipt(listId: string | undefined) {
  const { t } = useTranslation();
  const { pantry } = useCurrentPantry();
  const pantryId = pantry?.id;
  const { addItem, heldUnitOf } = usePantryIntake(pantryId);
  const { moveToPantry } = useMoveToPantry({
    currentListId: listId,
    present: 'none',
  });
  const { markAdded } = useReceiptDraftActions();
  const [applying, setApplying] = useState(false);
  const [failures, setFailures] = useState<ReceiptLineFailure[]>([]);

  const addOnItsOwn = async (
    choice: ReceiptLineChoice,
    receipt: ReceiptRefInput,
  ) => {
    const intake = intakeOf(
      choice,
      choice.itemId ? heldUnitOf(choice.itemId) : null,
    );
    if (!intake) return t('receipts.review.needsUnit');
    const outcome = await addItem(choice.itemName, {
      item: choice.itemId
        ? { id: choice.itemId }
        : { inline: { name: choice.itemName } },
      ...intake,
      forceAdd: true,
      purchase: purchaseOf(choice, receipt),
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
    listLine: ShoppingListItemNode,
    receipt: ReceiptRefInput,
  ) => {
    if (!pantryId) return t('errors.moveToPantryFailedRetry');
    const itemId = choice.itemId ?? listLine.item?.id;
    const amount = lineAmountOf(
      choice,
      listLine,
      itemId ? heldUnitOf(itemId) : null,
    );
    if (!amount) return t('receipts.review.needsUnit');
    const outcome = await moveToPantry(listLine, {
      pantryId,
      amount,
      removeFromList: true,
      receipt,
      // Labels the price paid: with none read, the API records the price typed
      // on the list as a PURCHASE at the receipt's store and day.
      priceSource: PriceSource.ReceiptScan,
      // The line's total as printed; the server derives the unit price.
      ...(choice.price === null ? {} : { totalCost: choice.price }),
    });
    return outcome.status === 'moved' ? null : outcome.reason;
  };

  // A line whose write throws fails alone: the rest still run, and the lines
  // already written are marked added, so a retry never adds them twice.
  const writeLine = (
    { choice, listLine }: ReceiptApplyLine,
    receipt: ReceiptRefInput,
  ): Promise<string | null> =>
    (listLine
      ? moveFromList(choice, listLine, receipt)
      : addOnItsOwn(choice, receipt)
    ).catch((error: unknown) => {
      errorService.reportError(error, { operation: 'Apply receipt line' });
      return t(
        listLine
          ? 'errors.moveToPantryFailedRetry'
          : 'errors.addItemFailedRetry',
      );
    });

  /** `receipt` is what every line was bought on: its day, and its store once known. */
  const apply = async (
    lines: readonly ReceiptApplyLine[],
    receipt: ReceiptRefInput,
  ) => {
    setApplying(true);
    const added: number[] = [];
    const failed: ReceiptLineFailure[] = [];
    // One at a time, so a long receipt never puts dozens of writes in flight at once.
    for (const line of lines) {
      const reason = await writeLine(line, receipt);
      if (reason === null) added.push(line.index);
      else failed.push({ index: line.index, reason });
    }
    markAdded(added);
    setFailures(failed);
    setApplying(false);
    return { addedIndexes: added, failed: failed.length };
  };

  return { pantryName: pantry?.name ?? null, applying, failures, apply };
}
