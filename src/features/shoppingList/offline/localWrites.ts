/**
 * What each shopping-list write changes on the device, as a pending layer. The
 * server's answer writes its own rows; `commit` adds what it cannot state.
 */
import type { ApolloCache, OperationVariables } from '@apollo/client';
import type { LocalWrite } from '#/apollo/pendingWrites/types';
import { writeEntityFields } from '#/apollo/utils/localFirstFields';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import {
  listAnsweredPantryItem,
  showLocalPantryItem,
} from '#features/pantry/cache/items';
import type { LocalPantryItem } from '#features/pantry/cache/writeLocalPantryItem';
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
  hideShoppingList,
  linkCreatedShoppingList,
  removeShoppingListFromCache,
  writeLocalShoppingList,
} from '#features/shoppingList/cache/list';
import {
  removeItemFromShoppingListForMoveToPantry,
  stampItemKeptOnListAfterMoveToPantry,
} from '#features/shoppingList/cache/moveToPantry';
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
  const results: unknown = isRecord(payload)
    ? payload.results ?? payload.itemResults
    : undefined;
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

/**
 * Answered rows leave the server's data. An answer that found a row already
 * gone states no totals, so they move here.
 */
function settleRemovedRows(
  cache: ApolloCache,
  listId: string,
  ids: readonly string[],
  payload: unknown,
): void {
  const list = isRecord(payload) ? payload.shoppingList : undefined;
  if (!carriesListTotals(list, listId)) {
    hideShoppingListRows(cache, listId, ids);
  }
  dropShoppingListRows(cache, listId, ids);
}

export const removeRows: LocalWrite<RemoveRowsInputs> = {
  apply(cache, { variables, inputs: { listId } }) {
    hideShoppingListRows(cache, listId, rowIdsOf(variables));
  },
  // The answer names each row, which puts it back in the server's data.
  commit(cache, { variables, inputs: { listId } }, data) {
    settleRemovedRows(cache, listId, rowIdsOf(variables), appliedPayload(data));
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

export type CreateListInputs = {
  list: {
    id: string;
    name: string;
    isDefault?: boolean | null;
    homeId?: string | null;
  };
  /** No auth identity means no ownership row, so the list waits for its answer. */
  owner: {
    id: string;
    email?: string | null;
    displayName?: string | null;
  } | null;
  /** The lines the create carries. */
  rows: LocalShoppingListItem[];
  now: string;
};

export const createList: LocalWrite<CreateListInputs> = {
  apply(cache, { inputs: { list, owner, rows, now } }) {
    if (!owner) return;
    writeLocalShoppingList(cache, list.id, list, owner, now);
    rows.forEach(row => addLocalShoppingListItem(cache, list.id, row, now));
  },
  // The server picks the home of a list that names none.
  commit(cache, { inputs: { list } }, data) {
    const payload: unknown = appliedPayload(data);
    const created = isRecord(payload) ? payload.shoppingList : undefined;
    const answered = isRecord(created) ? created.homeId : undefined;
    linkCreatedShoppingList(cache, {
      __typename: 'ShoppingList',
      id: list.id,
      homeId: typeof answered === 'string' ? answered : list.homeId ?? null,
    });
    keptRows(data).forEach(row =>
      addNewItemToShoppingListCache(cache, list.id, row, false),
    );
  },
};

export type MoveToPantryInputs = {
  row: LocalPantryItem;
  /** The list on screen; the line stays as it is without one. */
  listId?: string;
  now: string;
};

function movedLineOf(variables: OperationVariables) {
  const input: unknown = variables.input;
  if (!isRecord(input)) return null;
  const { pantryItemId, shoppingListItemId, removeFromList } = input;
  return typeof pantryItemId === 'string' &&
    typeof shoppingListItemId === 'string'
    ? { pantryItemId, lineId: shoppingListItemId, removeFromList }
    : null;
}

export const moveToPantry: LocalWrite<MoveToPantryInputs> = {
  apply(cache, { variables, inputs: { row, listId, now } }) {
    const moved = movedLineOf(variables);
    if (!moved) return;
    const { pantryItemId, lineId, removeFromList } = moved;
    showLocalPantryItem(
      cache,
      { __typename: 'PantryItem', id: pantryItemId },
      row,
      now,
    );
    if (!listId) return;
    // The removal and the stamp take the variant the line is in.
    const wasPurchased = readIsPurchased(cache, lineId);
    if (removeFromList) {
      removeItemFromShoppingListForMoveToPantry(
        cache,
        listId,
        lineId,
        wasPurchased,
        { evictEntity: false },
      );
    } else {
      stampItemKeptOnListAfterMoveToPantry(
        cache,
        listId,
        lineId,
        wasPurchased,
        now,
      );
    }
  },
  commit(cache, { variables, inputs: { row, listId } }, data) {
    const moved = movedLineOf(variables);
    if (!moved) return;
    const { pantryItemId, lineId, removeFromList } = moved;
    const payload: unknown = appliedPayload(data);
    listAnsweredPantryItem(cache, row.pantryId, pantryItemId, payload);
    if (!listId) return;
    if (removeFromList) {
      settleRemovedRows(cache, listId, [lineId], payload);
    } else {
      moveAnsweredShoppingListItem(cache, listId, lineId, true);
    }
  },
};

export const removeList: LocalWrite = {
  apply(cache, { variables }) {
    const list = rowOf(variables);
    if (list) hideShoppingList(cache, list.id);
  },
  commit(cache, { variables }) {
    const list = rowOf(variables);
    if (list) removeShoppingListFromCache(cache, list.id);
  },
};
