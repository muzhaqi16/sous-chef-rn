import {
  UnitType,
  type StockAmountInput,
} from '#/graphql/generated/schemaTypes';
import {
  boughtAmountOf,
  stockAmountOf,
  type HeldUnit,
} from '#domain/stockAmount';
import type { ReceiptLineChoice } from '../store/receiptDraftStore';

/** The open list line a receipt line ticks off. */
export interface ListLineAmount {
  quantity?: number | null;
  unit: { id: string; type: UnitType } | null;
}

/**
 * What a receipt line bought: the amount to send, `fromList` when the receipt
 * printed only a count and the list line supplied the amount, or what the user
 * is still asked.
 */
export type ReceiptLineAmount =
  | { amount: StockAmountInput; fromList: boolean }
  | { needs: 'unit' | 'amount' };

/**
 * What a receipt line bought, as stated; the API does the package arithmetic.
 * A typed unit is the list line's, the only one it links to. A unitless count is
 * as its stack counts (never 1 g of cheese). Against a list line in a unit, one
 * bought is what the list asked for, and a count equal to the list's is in its
 * unit. Any other count is packages: the API sizes a weighed line's, but a
 * counted line's could be cartons or eggs, so it is asked.
 */
export function receiptLineAmount(
  choice: Pick<ReceiptLineChoice, 'quantity' | 'unitId' | 'unitText'>,
  listLine: ListLineAmount | undefined,
  heldUnit: HeldUnit,
): ReceiptLineAmount {
  const { quantity, unitId, unitText } = choice;
  if (unitId !== null || unitText !== '') {
    const resolved = unitId ?? listLine?.unit?.id;
    return resolved
      ? {
          amount: stockAmountOf(quantity, { unitId: resolved }),
          fromList: false,
        }
      : { needs: 'unit' };
  }
  if (!Number.isInteger(quantity)) return { needs: 'unit' };
  const unit = listLine?.unit;
  if (!unit) {
    return { amount: boughtAmountOf(quantity, { heldUnit }), fromList: false };
  }
  const asked = listLine.quantity ?? 1;
  const counted = unit.type === UnitType.Count;
  if (quantity === 1 || (counted && quantity === asked)) {
    return {
      amount: stockAmountOf(quantity === 1 ? asked : quantity, {
        unitId: unit.id,
      }),
      fromList: true,
    };
  }
  return counted
    ? { needs: 'amount' }
    : {
        amount: stockAmountOf(quantity, { asPackages: true }),
        fromList: false,
      };
}
