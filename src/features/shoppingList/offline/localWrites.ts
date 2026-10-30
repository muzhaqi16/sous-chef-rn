/**
 * What each shopping-list write changes on the device, as a pending layer. The
 * server's answer writes its own rows; `commit` adds what it cannot state.
 */
import type { OperationVariables } from '@apollo/client';
import type { LocalWrite } from '#/apollo/pendingWrites/types';
import { writeEntityFields } from '#/apollo/utils/localFirstFields';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import {
  addNewItemToShoppingListCache,
  dropShoppingListRows,
  hideShoppingListRows,
  moveAnsweredShoppingListItem,
  moveShoppingListItemToPurchased,
  moveShoppingListItemToUnpurchased,
  sortShoppingListRows,
} from '#features/shoppingList/cache/connections';
import {
  addLocalShoppingListItem,
  carriesListTotals,
  type LocalShoppingListItem,
} from '#features/shoppingList/cache/items';
import {
  readIsPurchased,
  writePurchaseInfo,
} from '#features/shoppingList/cache/purchase';

export type AddRowsInputs = {
  listId: string;
  rows: LocalShoppingListItem[];
  now: string;
};

/**
 * The rows an answer kept, a folded line's being the row it folded into. A
 * refused line reached only the layer, so it has nothing to take back.
 */
function keptRows(data: unknown): { id: string }[] {
  const payload: unknown = appliedPayload(data);
  const results: unknown = isRecord(payload) ? payload.results : undefined;
  if (!Array.isArray(results)) return [];
  return results.flatMap((result: unknown) => {
    if (!isRecord(result) || result.success === false) return [];
    const { item } = result;
    return isRecord(item) && typeof item.id === 'string'
      ? [{ id: item.id }]
      : [];
  });
}

export const addRows: LocalWrite<AddRowsInputs> = {
  apply(cache, { inputs: { listId, rows, now } }) {
    rows.forEach(row => addLocalShoppingListItem(cache, listId, row, now));
  },
  // The answer states the list's totals, so an edge is all it leaves to write.
  commit(cache, { inputs: { listId } }, data) {
    keptRows(data).forEach(row =>
      addNewItemToShoppingListCache(cache, listId, row, false),
    );
  },
};

export type UpdateRowInputs = {
  /** What the row shows meanwhile, in its own field names. */
  fields?: Readonly<Record<string, unknown>>;
  purchase?: { listId: string; isPurchased: boolean; now: string };
};

export type RemoveRowsInputs = { listId: string };

export type ReorderRowInputs = {
  listId: string;
  sortOrder: string;
  now: string;
};

/**
 * The row a write names. Read from its variables, which the queue moves onto
 * the surviving row when the server merges one.
 */
function rowOf(variables: OperationVariables) {
  const input: unknown = variables.input;
  return isRecord(input) && typeof input.id === 'string'
    ? { __typename: 'ShoppingListItem', id: input.id }
    : null;
}

function rowIdsOf(variables: OperationVariables): string[] {
  const row = rowOf(variables);
  if (row) return [row.id];
  const input: unknown = variables.input;
  const ids: unknown = isRecord(input) ? input.ids : undefined;
  return Array.isArray(ids)
    ? ids.filter((id: unknown) => typeof id === 'string')
    : [];
}

export const updateRow: LocalWrite<UpdateRowInputs> = {
  apply(cache, { variables, inputs: { fields, purchase } }) {
    const row = rowOf(variables);
    if (!row || !isHeld(cache, row)) return;
    if (fields) writeEntityFields(cache, row, fields);
    if (purchase && readIsPurchased(cache, row.id) !== purchase.isPurchased) {
      const { listId, isPurchased, now } = purchase;
      writePurchaseInfo(cache, row.id, { isPurchased }, { updatedAt: now });
      const move = isPurchased
        ? moveShoppingListItemToPurchased
        : moveShoppingListItemToUnpurchased;
      move(cache, listId, row);
    }
  },
  commit(cache, { variables, inputs: { purchase } }) {
    const row = rowOf(variables);
    if (!row || !purchase) return;
    const { listId, isPurchased } = purchase;
    moveAnsweredShoppingListItem(cache, listId, row.id, isPurchased);
  },
};

export const removeRows: LocalWrite<RemoveRowsInputs> = {
  apply(cache, { variables, inputs: { listId } }) {
    hideShoppingListRows(cache, listId, rowIdsOf(variables));
  },
  // The answer names each row, which puts it back in the server's data. One
  // that found the row already gone states no totals, so they move here.
  commit(cache, { variables, inputs: { listId } }, data) {
    const ids = rowIdsOf(variables);
    const payload: unknown = appliedPayload(data);
    const list = isRecord(payload) ? payload.shoppingList : undefined;
    if (!carriesListTotals(list, listId)) {
      hideShoppingListRows(cache, listId, ids);
    }
    dropShoppingListRows(cache, listId, ids);
  },
};

export const reorderRow: LocalWrite<ReorderRowInputs> = {
  apply(cache, { variables, inputs: { listId, sortOrder, now } }) {
    const row = rowOf(variables);
    if (!row || !isHeld(cache, row)) return;
    cache.modify({
      id: cache.identify(row),
      fields: { sortOrder: () => sortOrder, updatedAt: () => now },
    });
    sortShoppingListRows(cache, listId);
  },
  // The answer writes the row, and its order may not be the one worked out here.
  commit(cache, { inputs: { listId } }) {
    sortShoppingListRows(cache, listId);
  },
};
