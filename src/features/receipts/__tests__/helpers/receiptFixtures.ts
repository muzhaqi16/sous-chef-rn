import { inputOf, type MockDataFor } from '#/test-utils/apolloMockProvider';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import type { CreateReceiptCheckInDocument } from '../../hooks/useReceiptCheckIn.generated';
import {
  useReceiptDraftStore,
  type ReceiptDraft,
  type ReceiptLineChoice,
} from '../../store/receiptDraftStore';
import type {
  ParsedReceipt,
  ParsedReceiptLine,
} from '../../utils/parsedReceipt';

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

/** A line as a check-in sends it. */
export interface SentCheckInLine {
  clientId: string;
  pantryItemId?: string | null;
  shoppingListItemId?: string | null;
  item: { id?: string | null; inline?: { id: string; name: string } | null };
}

/** The lines one fired check-in sent. */
export const sentLinesOf = (vars: Record<string, unknown>) =>
  (inputOf(vars) as { lines: SentCheckInLine[] }).lines;

// The names the API holds the fixtures' catalog items under.
const ITEM_NAMES: Partial<Record<string, string>> = {
  'cat-milk': 'Whole milk',
  'cat-bananas': 'Bananas',
};

/**
 * A check-in as the API answers it: each line recorded as the item and under
 * the stack it names, unless `refuses` it, which fails with `failure`.
 */
export const checkInAnswer =
  ({
    refuses = () => false,
    failure = { code: ErrorCode.ValidationFailed, errorId: null },
  }: {
    refuses?: (line: SentCheckInLine) => boolean;
    failure?: { code: ErrorCode; errorId: string | null };
  } = {}) =>
  (
    vars: Record<string, unknown>,
  ): MockDataFor<typeof CreateReceiptCheckInDocument> => ({
    createReceiptCheckIn: {
      __typename: 'CreateReceiptCheckInPayload',
      results: sentLinesOf(vars).map((line, index) => {
        if (refuses(line)) {
          return {
            index,
            clientId: line.clientId,
            success: false,
            failure,
            item: null,
            purchase: null,
            pantryItem: null,
            shoppingListItem: null,
          };
        }
        const itemId = line.item.id ?? line.item.inline?.id ?? 'cat-new';
        const itemName = line.item.inline?.name ?? ITEM_NAMES[itemId];
        return {
          index,
          clientId: line.clientId,
          success: true,
          failure: null,
          item: { id: itemId },
          pantryItem: line.pantryItemId
            ? {
                id: line.pantryItemId,
                ...(itemName ? { itemName } : {}),
                item: { id: itemId },
              }
            : null,
          shoppingListItem: null,
        };
      }),
    },
  });
