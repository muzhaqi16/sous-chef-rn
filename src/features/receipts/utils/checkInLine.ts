import type {
  PantryItemSourceInput,
  ReceiptCheckInLineInput,
} from '#/graphql/generated/schemaTypes';
import type { HeldUnit } from '#domain/stockAmount';
import { toCents } from './money';
import type {
  CheckInLineIds,
  ReceiptLineChoice,
} from '../store/receiptDraftStore';
import type { ReceiptCandidate } from '../hooks/useReceiptMatches';
import type { ReceiptReviewLine } from './receiptReviewLines';
import { receiptLineAmount, type ListLineAmount } from './receiptLineAmount';

/** What a line still lacks before the API can record it. */
export type CheckInLineNeed = 'item' | 'unit' | 'price';

export type CheckInLine =
  | { input: ReceiptCheckInLineInput }
  | { needs: CheckInLineNeed };

interface CheckInLineSource {
  line: Pick<ReceiptReviewLine, 'index' | 'printed' | 'discount'>;
  choice: ReceiptLineChoice;
  ids: CheckInLineIds;
  /** The open list line it ticks off. */
  listLine?: ListLineAmount & { id: string };
  heldUnit: HeldUnit;
  /** What the API proposed for the line, which the user kept or changed. */
  proposed?: Pick<ReceiptCandidate, 'itemId' | 'method'>;
}

// A typed name is created, or matched, under the line's minted item id.
const itemOf = (
  choice: ReceiptLineChoice,
  { newItemId }: CheckInLineIds,
): PantryItemSourceInput | null => {
  if (choice.itemId) return { id: choice.itemId };
  const name = choice.itemName.trim();
  return name ? { inline: { id: newItemId, name } } : null;
};

/**
 * The check-in's input for one confirmed line, or what it still needs. The
 * total is what was paid after the line's discounts, which it states apart, so
 * the API records the original price; a line its discount made free is paid 0.
 */
export function checkInLineOf({
  line,
  choice,
  ids,
  listLine,
  heldUnit,
  proposed,
}: CheckInLineSource): CheckInLine {
  const item = itemOf(choice, ids);
  if (!item) return { needs: 'item' };
  const amount = receiptLineAmount(choice, listLine, heldUnit);
  if (!amount) return { needs: 'unit' };
  const discount =
    line.discount !== undefined && toCents(line.discount) > 0
      ? line.discount
      : undefined;
  const { price } = choice;
  if (price === null || (toCents(price) <= 0 && discount === undefined)) {
    return { needs: 'price' };
  }
  return {
    input: {
      clientId: String(line.index),
      purchaseId: ids.purchaseId,
      // A line that stocks nothing names no stack.
      ...(choice.notStocked
        ? { stock: false }
        : { pantryItemId: ids.pantryItemId }),
      item,
      amount,
      totalPaid: price,
      ...(discount === undefined ? {} : { discount }),
      ...(listLine ? { shoppingListItemId: listLine.id } : {}),
      rawText: line.printed,
      resolvedBy: proposed?.method ?? null,
      edited: proposed?.itemId !== choice.itemId,
    },
  };
}
