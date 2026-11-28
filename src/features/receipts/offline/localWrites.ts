/**
 * What a receipt check-in changes on the device, as a pending layer. The
 * server's answer writes each line's rows and the totals; `commit` lists them.
 */
import type { LocalWrite } from '#apollo/pendingWrites/types';
import { appliedPayload } from '#utils/errors/mutationPayload';
import { isRecord } from '#utils/isRecord';
import {
  listNewUsualStore,
  type NewUsualStore,
} from '#entities/store/usualStores';
import {
  listAnsweredPantryItem,
  showLocalPantryItem,
  type PantryItemRef,
} from '#entities/pantryItem/items';
import type { LocalPantryItem } from '#entities/pantryItem/writeLocalPantryItem';
import {
  stampItemBoughtOnList,
  stampItemKeptOnListAfterMoveToPantry,
} from '#entities/shoppingList/moveToPantry';
import { readIsPurchased } from '#entities/shoppingList/purchase';
import { refuseReceiptCheckIn, resultsOf } from './receiptCheckIn';
import { bindLocalWrite } from '#apollo/pendingWrites/bindLocalWrite';
import { CreateReceiptCheckInDocument } from '#features/receipts/hooks/useReceiptCheckIn.generated';

/** What one line shows until the server answers. */
export type LocalCheckInLine = {
  /** The stack it mints, with the row that shows; absent for a line kept out. */
  stack?: {
    id: string;
    row: LocalPantryItem;
    /** Shown on an earlier line's row, as the server joins them. */
    joined?: boolean;
  };
  /** The open list line it ticks. */
  listLineId?: string;
};

export type CheckInInputs = {
  pantryId: string;
  listId?: string;
  lines: LocalCheckInLine[];
  now: string;
  /** The store it adds to the household's, known once the store exists. */
  newStore?: NewUsualStore;
};

export const checkIn: LocalWrite<CheckInInputs> = {
  // It adds its store to the usual ones, so taking that store off waits for it.
  orderedBy({ variables }) {
    const input: unknown = variables.input;
    return isRecord(input) && typeof input.storeId === 'string'
      ? input.storeId
      : undefined;
  },
  apply(cache, { inputs: { listId, lines, now, newStore } }) {
    if (newStore) listNewUsualStore(cache, newStore, now);
    for (const { stack, listLineId } of lines) {
      if (stack && !stack.joined) {
        const ref: PantryItemRef = { __typename: 'PantryItem', id: stack.id };
        showLocalPantryItem(cache, ref, stack.row, now);
      }
      if (!listId || !listLineId) continue;
      const wasPurchased = readIsPurchased(cache, listLineId);
      if (stack) {
        stampItemKeptOnListAfterMoveToPantry(
          cache,
          listId,
          listLineId,
          wasPurchased,
          now,
        );
      } else {
        stampItemBoughtOnList(cache, listId, listLineId, wasPurchased);
      }
    }
  },
  // A line the server refused had only its layer, and one it merged into a held
  // stack answers that stack's id, so the minted row was never the server's.
  // The answer states no usual stores, so the new one is listed here.
  commit(cache, { inputs: { pantryId, lines, now, newStore } }, data) {
    const payload: unknown = appliedPayload(data);
    if (!isRecord(payload)) return;
    if (newStore) listNewUsualStore(cache, newStore, now);
    for (const { index, success, pantryItem } of resultsOf(data)) {
      const stack = lines[index]?.stack;
      if (!success || !stack) continue;
      listAnsweredPantryItem(cache, pantryId, stack.id, {
        pantryItem,
        pantry: payload.pantry,
      });
    }
  },
  refused(cache, { variables }) {
    refuseReceiptCheckIn(cache, variables);
  },
  recoverable: false,
};

// Each document this feature sends as a local write, bound to its write.
export const createReceiptCheckInWrite = bindLocalWrite(
  CreateReceiptCheckInDocument,
  {
    ...checkIn,
    subject: { key: 'lines', rowKey: 'pantryItemId', mints: true },
  },
);
