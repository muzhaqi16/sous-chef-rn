import {
  useReceiptDraftStore,
  type ReceiptDraft,
  type ReceiptLineChoice,
} from '../../store/receiptDraftStore';
import type {
  ParsedReceipt,
  ParsedReceiptLine,
} from '../../utils/structureReceipt';

/** A line chosen as one of a catalog item, in no unit, at no price. */
export const lineChoice = (
  overrides: Partial<ReceiptLineChoice> = {},
): ReceiptLineChoice => ({
  itemId: 'cat-milk',
  itemName: 'Whole milk',
  quantity: 1,
  unitId: null,
  unitText: '',
  price: null,
  ...overrides,
});

/** A receipt whose lines are indexed in the order given. */
export const parsedReceipt = (
  lines: readonly Omit<ParsedReceiptLine, 'index'>[],
  merchant?: string,
): ParsedReceipt => ({
  ...(merchant ? { merchant } : {}),
  lines: lines.map((line, index) => ({ ...line, index })),
});

/** Saves a draft as a finished scan does. */
export const seedDraft = (draft: Partial<ReceiptDraft> = {}) =>
  useReceiptDraftStore.setState({
    draft: {
      pages: ['RECEIPT'],
      scannedAt: '2026-10-01T10:00:00.000Z',
      ...draft,
    },
  });
