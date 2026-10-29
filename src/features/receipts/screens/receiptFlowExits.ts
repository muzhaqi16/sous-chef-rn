import { createActionsContext } from '#hooks/utils/createActionsContext';

/**
 * Where the scan and review screens go next. Absent, they go where the
 * receipts stack does; a flow that borrows them, as onboarding does, supplies
 * its own.
 */
export interface ReceiptFlowExits {
  toReview: () => void;
  close: () => void;
  /** The review added this many items to the pantry. */
  added: (count: number) => void;
  /** The review is done with nothing left to add. */
  finished: () => void;
}

export const {
  Provider: ReceiptFlowExitsProvider,
  useOptionalActions: useReceiptFlowExits,
} = createActionsContext<ReceiptFlowExits>('ReceiptFlowExits');
