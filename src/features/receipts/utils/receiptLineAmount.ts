import {
  UnitType,
  type StockAmountInput,
} from '#graphql/generated/schemaTypes';
import type { HeldUnit } from '#domain/stockAmount';
import { resolveIntakeDraft, type IntakeFacts } from '#domain/intakeDraft';
import type { ReceiptLineChoice } from '../store/receiptDraftStore';

/** The open list line a receipt line ticks off. */
export interface ListLineAmount {
  quantity?: number | null;
  unit: { id: string; type: UnitType } | null;
}

/**
 * What a receipt line bought: the amount to send, `fromList` when the receipt
 * printed only a count and the list line supplied the amount, or what the user
 * is still asked: `amount` is how much a count against the list line bought.
 */
export type ReceiptLineAmount =
  | { amount: StockAmountInput; fromList: boolean }
  | { needs: 'unit' | 'amount' | 'quantity' | 'sizeUnit' };

/**
 * What a receipt line bought, as stated; the API does the package arithmetic.
 * A stated size wins over the list; a typed unit is the list line's; a unitless
 * count is as its stack counts (never 1 g of cheese). Against a list line in a
 * unit, one bought, or a count equal to the list's, is in that unit; any other
 * count is packages, which a counted line asks about (cartons or eggs?).
 */
export function receiptLineAmount(
  choice: Pick<
    ReceiptLineChoice,
    'quantity' | 'unitId' | 'unitText' | 'packageSize'
  >,
  listLine: ListLineAmount | undefined,
  heldUnit: HeldUnit,
): ReceiptLineAmount {
  const { quantity, unitId, unitText, packageSize } = choice;
  const stated = (facts: IntakeFacts, fromList = false): ReceiptLineAmount => {
    const { amount, unresolved } = resolveIntakeDraft({
      purchased: facts,
      heldUnit,
    });
    if (amount) return { amount, fromList };
    return { needs: unresolved.includes('unit') ? 'unit' : 'quantity' };
  };
  if (packageSize) {
    if (!packageSize.unitId) return { needs: 'sizeUnit' };
    if (unitId === null && unitText !== '') return { needs: 'unit' };
    return stated({
      quantity,
      unitId,
      intent: 'packages',
      packageSize: {
        netWeight: packageSize.quantity,
        netWeightUnitId: packageSize.unitId,
      },
    });
  }
  if (unitId !== null || unitText !== '') {
    const resolved = unitId ?? listLine?.unit?.id;
    return resolved
      ? stated({ quantity, unitId: resolved, intent: 'measured' })
      : { needs: 'unit' };
  }
  if (!Number.isInteger(quantity)) return { needs: 'unit' };
  const unit = listLine?.unit;
  if (!unit) return stated({ quantity });
  const asked = listLine.quantity ?? 1;
  const counted = unit.type === UnitType.Count;
  if (quantity === 1 || (counted && quantity === asked)) {
    return stated(
      {
        quantity: quantity === 1 ? asked : quantity,
        unitId: unit.id,
        intent: 'measured',
      },
      true,
    );
  }
  return counted
    ? { needs: 'amount' }
    : stated({ quantity, intent: 'packages' });
}
