import { useState } from 'react';
import { useTranslation } from '#/i18n';
import {
  AcquisitionMethod,
  NetWeightKind,
  PriceSource,
  UnitType,
  type ReceiptRefInput,
} from '#/graphql/generated/schemaTypes';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { useMoveToPantry } from '#features/shoppingList/hooks/useMoveToPantry';
import type { ShoppingListItemNode } from '#features/shoppingList/hooks/usePaginatedShoppingItems';
import { refByIdOrName } from '#/utils/refInput';
import { errorService } from '#/services/errorService';
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
  listLine?: ShoppingListItemNode;
}

// A bare 1 with no unit is left to the API: one, or the item's package size,
// rather than one of its tracking unit (1 mL of milk).
const statedQuantity = (choice: ReceiptLineChoice) =>
  choice.unitId || choice.unitText || choice.quantity !== 1
    ? choice.quantity
    : undefined;

// The total is the API's authoritative figure. A rate goes with it only for a
// stated amount: the receipt's price history is recorded from the rate, and a
// rate for an amount the API defaults would price the wrong quantity.
const purchaseOf = (choice: ReceiptLineChoice, receipt: ReceiptRefInput) => {
  const quantity = statedQuantity(choice);
  return {
    acquisitionMethod: AcquisitionMethod.Purchased,
    receipt,
    priceSource: PriceSource.ReceiptScan,
    ...(choice.price === null
      ? {}
      : {
          totalCost: choice.price,
          ...(quantity === undefined
            ? {}
            : { costPerUnit: choice.price / quantity }),
        }),
  };
};

/** One counted pack in the line's unit: the line's package size, else its item's. */
const packSizeIn = (
  line: ShoppingListItemNode,
  unitId: string,
): number | undefined => {
  if (line.netWeight && line.netWeightUnit?.id === unitId) {
    return line.netWeight;
  }
  const { item } = line;
  return item?.netWeight &&
    item.netWeightKind === NetWeightKind.Package &&
    item.displayUnit?.id === unitId
    ? item.netWeight
    : undefined;
};

/**
 * What a move records for a receipt line, as the API takes it: a move has no
 * default, and a count of packs on a weighed stack opens a second stack. A line
 * stating a unit moves its own amount. One without counts what was bought: in a
 * COUNT unit (pieces, jars) that count; in a weighed line (500 g) that many of
 * its package size; with no size known, or a bare 1, the list's amount, never
 * 2 of a gram.
 */
const moveAmount = (
  choice: ReceiptLineChoice,
  line: ShoppingListItemNode,
): { quantity: number; unitId: string | undefined } => {
  const lineUnit = line.unit;
  if (choice.unitId !== null || choice.unitText !== '' || !lineUnit) {
    // A typed unit links only to a line in that unit, so the line's id stands for it.
    return { quantity: choice.quantity, unitId: choice.unitId ?? lineUnit?.id };
  }
  const listAmount = {
    quantity: line.quantity ?? choice.quantity,
    unitId: lineUnit.id,
  };
  if (choice.quantity === 1) return listAmount;
  if (lineUnit.type === UnitType.Count) {
    return { quantity: choice.quantity, unitId: lineUnit.id };
  }
  const pack = packSizeIn(line, lineUnit.id);
  return pack === undefined
    ? listAmount
    : { quantity: choice.quantity * pack, unitId: lineUnit.id };
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
  const { addItem } = usePantryIntake(pantryId);
  const { moveToPantry } = useMoveToPantry({
    currentListId: listId,
    present: 'none',
  });
  const markAdded = useReceiptDraftStore(state => state.markAdded);
  const [applying, setApplying] = useState(false);
  const [failures, setFailures] = useState<ReceiptLineFailure[]>([]);

  const addOnItsOwn = async (
    choice: ReceiptLineChoice,
    receipt: ReceiptRefInput,
  ) => {
    const outcome = await addItem(choice.itemName, {
      item: choice.itemId
        ? { id: choice.itemId }
        : { inline: { name: choice.itemName } },
      quantity: statedQuantity(choice),
      unit: refByIdOrName(choice.unitId, choice.unitText),
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
    const { quantity, unitId } = moveAmount(choice, listLine);
    const outcome = await moveToPantry(listLine, {
      pantryId,
      actualQuantity: quantity,
      actualUnitId: unitId,
      removeFromList: true,
      receipt,
      // Labels only `actualPrice`: with none read, the API records the price
      // typed on the list as a PURCHASE at the receipt's store and day.
      priceSource: PriceSource.ReceiptScan,
      // Per unit, as the move takes it.
      ...(choice.price === null
        ? {}
        : { actualPrice: choice.price / quantity }),
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
