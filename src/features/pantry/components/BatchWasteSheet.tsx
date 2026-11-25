import React from 'react';
import { RecordWastePantryItemModal } from '#features/pantry/components/modals/RecordWastePantryItemModal';
import type { WastedBatch } from '#features/pantry/hooks/mutations/useWastePantryItemBatch';
import type { StatedWaste, UsedBatch } from '#features/pantry/types';
import { useOpening } from '#hooks/ui/useOpening';

interface BatchWasteSheetProps {
  pantryItemId: string;
  /** The stack's batches as the host reads them. */
  batches: readonly (WastedBatch & UsedBatch)[];
  /** The batch being thrown out from; null closes the sheet. */
  wastingBatchId: string | null;
  onClose: () => void;
  onConfirm: (batch: WastedBatch, waste: StatedWaste) => Promise<unknown>;
}

/** The waste sheet on one batch: its amount is bounded by what that batch holds. */
export const BatchWasteSheet: React.FC<BatchWasteSheetProps> = ({
  pantryItemId,
  batches,
  wastingBatchId,
  onClose,
  onConfirm,
}) => {
  // Kept while the sheet animates out, so a close never empties it first.
  const opening = useOpening(!!wastingBatchId, wastingBatchId);
  const batch = batches.find(({ id }) => id === opening?.payload) ?? null;

  return (
    <RecordWastePantryItemModal
      visible={!!wastingBatchId}
      pantryItemId={pantryItemId}
      batch={batch}
      onClose={onClose}
      onConfirm={waste =>
        batch ? onConfirm(batch, waste) : Promise.resolve(undefined)
      }
    />
  );
};
