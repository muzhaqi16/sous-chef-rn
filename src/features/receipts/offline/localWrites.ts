/**
 * What a receipt check-in changes on the device, as a pending layer. The
 * server's answer writes each line's rows and the totals; `commit` lists them.
 */
import type { LocalWrite } from '#/apollo/pendingWrites/types';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import {
  listAnsweredPantryItem,
  showLocalPantryItem,
  type PantryItemRef,
} from '#features/pantry/cache/items';
import type { LocalPantryItem } from '#features/pantry/cache/writeLocalPantryItem';
import {
  stampItemBoughtOnList,
  stampItemKeptOnListAfterMoveToPantry,
} from '#features/shoppingList/cache/moveToPantry';
import { readIsPurchased } from '#features/shoppingList/cache/purchase';
import { refuseReceiptCheckIn, resultsOf } from './receiptCheckIn';

/** What one line shows until the server answers. */
export type LocalCheckInLine = {
  /** The stack it mints, with the row that shows; absent for a line kept out. */
  stack?: { id: string; row: LocalPantryItem };
  /** The open list line it ticks. */
  listLineId?: string;
};

export type CheckInInputs = {
  pantryId: string;
  listId?: string;
  lines: LocalCheckInLine[];
  now: string;
};

export const checkIn: LocalWrite<CheckInInputs> = {
  apply(cache, { inputs: { listId, lines, now } }) {
    for (const { stack, listLineId } of lines) {
      if (stack) {
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
  commit(cache, { inputs: { pantryId, lines } }, data) {
    const payload: unknown = appliedPayload(data);
    if (!isRecord(payload)) return;
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
};
