import type { StockAmountInput } from '#/graphql/generated/schemaTypes';
import {
  boughtAmountOf,
  stockAmountOf,
  type HeldUnit,
} from '#domain/stockAmount';
import type { ReceiptLineChoice } from '../store/receiptDraftStore';

/** The open list line a receipt line ticks off. */
export interface ListLineAmount {
  quantity?: number | null;
  unit: { id: string } | null;
}

/**
 * What a receipt line bought, as stated: the API owns the package arithmetic.
 * - A line in a unit is that amount; a typed unit names the list line's, the
 *   only line it links to.
 * - A count with no unit, 1 included, is that many as its stack counts them,
 *   never one of the item's tracking unit (1 g of cheese).
 * - A bare 1 against a list line in a unit says only that it was bought, so the
 *   list's amount stands.
 *
 * Null for a part of something no unit names, or a typed unit with no line.
 */
export function receiptLineAmount(
  choice: Pick<ReceiptLineChoice, 'quantity' | 'unitId' | 'unitText'>,
  listLine: ListLineAmount | undefined,
  heldUnit: HeldUnit,
): StockAmountInput | null {
  const { quantity, unitId, unitText } = choice;
  if (unitId !== null || unitText !== '') {
    const resolved = unitId ?? listLine?.unit?.id;
    return resolved ? stockAmountOf(quantity, { unitId: resolved }) : null;
  }
  if (!Number.isInteger(quantity)) return null;
  if (listLine?.unit) {
    return quantity === 1
      ? stockAmountOf(listLine.quantity ?? quantity, {
          unitId: listLine.unit.id,
        })
      : stockAmountOf(quantity, { asPackages: true });
  }
  return boughtAmountOf(quantity, { heldUnit });
}
