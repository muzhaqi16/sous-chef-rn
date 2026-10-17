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
 * What a receipt line bought, as stated; the API does the package arithmetic.
 * A typed unit is the list line's, the only one it links to. A unitless count is
 * as its stack counts (never 1 g of cheese); a bare 1 keeps a unit list line's.
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
