import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { AcquisitionMethod } from '#/graphql/generated/schemaTypes';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { refByIdOrName } from '#/utils/refInput';
import {
  useReceiptDraftStore,
  type ReceiptLineChoice,
} from '../store/receiptDraftStore';

export interface ReceiptLineFailure {
  index: number;
  reason: string;
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
 * Adds a receipt's chosen lines to the current pantry. `forceAdd` restocks an
 * item the pantry already holds instead of refusing it as a duplicate.
 */
export function useApplyReceipt() {
  const { t } = useTranslation();
  const { pantry } = useCurrentPantry();
  const { addItem } = usePantryIntake(pantry?.id);
  const markAdded = useReceiptDraftStore(state => state.markAdded);
  const [applying, setApplying] = useState(false);
  const [failures, setFailures] = useState<ReceiptLineFailure[]>([]);

  const apply = async (
    lines: readonly { index: number; choice: ReceiptLineChoice }[],
  ) => {
    setApplying(true);
    const added: number[] = [];
    const failed: ReceiptLineFailure[] = [];
    // One at a time, so a long receipt never puts dozens of writes in flight at once.
    for (const { index, choice } of lines) {
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
          added.push(index);
          break;
        case 'rejected':
          failed.push({ index, reason: outcome.reason });
          break;
        case 'duplicate':
          // `forceAdd` means the API restocks rather than refusing; an older one may not.
          failed.push({ index, reason: t('errors.addItemFailedRetry') });
          break;
      }
    }
    markAdded(added);
    setFailures(failed);
    setApplying(false);
    return { added: added.length, failed: failed.length };
  };

  return { pantryName: pantry?.name ?? null, applying, failures, apply };
}
