/**
 * What each pantry write changes on the device, as a pending layer. The server's
 * answer writes its own rows; `commit` adds what it cannot state.
 */
import type { ApolloCache, OperationVariables } from '@apollo/client';
import type { LocalWrite } from '#/apollo/pendingWrites/types';
import { writeEntityFields } from '#/apollo/utils/localFirstFields';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import { ItemCondition } from '#/graphql/generated/schemaTypes';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import {
  addPantryItemLocally,
  addToPantryItemsCache,
  carriesPantryCount,
  dropPantryItem,
  hidePantryItem,
  listAnsweredPantryItem,
  showLocalPantryItem,
  type PantryItemRef,
} from '#features/pantry/cache/items';
import {
  addPantryToHomeCache,
  removeOptimisticPantry,
  writeLocalPantry,
} from '#features/pantry/cache/pantry';
import {
  dropBatchesPage,
  isBatchesPage,
  writeRestatedBatches,
} from '#features/pantry/cache/restatedStack';
import {
  bumpStock,
  countNewBatch,
  writeHeldStock,
} from '#features/pantry/cache/stock';
import type { LocalPantryItem } from '#features/pantry/cache/writeLocalPantryItem';

const stackRef = (id: string): PantryItemRef => ({
  __typename: 'PantryItem',
  id,
});

const idOf = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.id === 'string' ? value.id : undefined;

/**
 * The stack a write names. Read from its variables, which the queue moves onto
 * the survivor when the server merges a stack.
 */
function stackOf(variables: OperationVariables): PantryItemRef | null {
  const input: unknown = variables.input;
  if (!isRecord(input)) return null;
  const id = idOf({ id: input.pantryItemId ?? input.id });
  return id ? stackRef(id) : null;
}

/** The stack a delta landed on: the payload's own, else its ledger row's. */
const answeredStack = (payload: Record<string, unknown>): unknown =>
  isRecord(payload.pantryItem)
    ? payload.pantryItem
    : isRecord(payload.pantryItemUsage)
    ? payload.pantryItemUsage.pantryItem
    : undefined;

/**
 * A delta queued against a stack the server has since merged lands on the
 * survivor, which the answer names (USM-3): the merged row goes, and the
 * survivor is listed.
 */
function leaveMergedStack(
  cache: ApolloCache,
  queuedId: string,
  payload: unknown,
): void {
  if (!isRecord(payload)) return;
  const servedId = idOf(answeredStack(payload));
  const pantryId = idOf(payload.pantry);
  if (!servedId || servedId === queuedId || !pantryId) return;
  const countsSettled = carriesPantryCount(payload.pantry, pantryId);
  dropPantryItem(cache, pantryId, queuedId, { countsSettled });
  addPantryItemLocally(cache, pantryId, stackRef(servedId), { countsSettled });
}

export type CreateItemInputs = { row: LocalPantryItem; now: string };

export const createItem: LocalWrite<CreateItemInputs> = {
  apply(cache, { variables, inputs: { row, now } }) {
    const stack = stackOf(variables);
    if (stack) showLocalPantryItem(cache, stack, row, now);
  },
  commit(cache, { variables, inputs: { row } }, data) {
    const stack = stackOf(variables);
    if (!stack) return;
    listAnsweredPantryItem(cache, row.pantryId, stack.id, appliedPayload(data));
  },
};

export type SetStockInputs = {
  /** What the stack holds; absent when only the server can convert the figure. */
  held?: number;
  /** How that amount shows, when it was given in a unit the stack shows in. */
  shown?: Parameters<typeof writeHeldStock>[3];
  remainingNetWeight?: number;
  now: string;
};

export const setStock: LocalWrite<SetStockInputs> = {
  apply(
    cache,
    { variables, inputs: { held, shown, remainingNetWeight, now } },
  ) {
    const stack = stackOf(variables);
    if (!stack || held === undefined || !isHeld(cache, stack)) return;
    writeEntityFields(cache, stack, {
      quantity: held,
      remainingNetWeight,
      updatedAt: now,
    });
    writeHeldStock(cache, stack.id, held, shown);
  },
};

export type DrawStockInputs = {
  /** In tracking units; null when only the server can convert the amount. */
  delta: number | null;
  now: string;
};

export const drawStock: LocalWrite<DrawStockInputs> = {
  apply(cache, { variables, inputs: { delta, now } }) {
    const stack = stackOf(variables);
    if (stack && delta !== null) bumpStock(cache, stack.id, delta, now);
  },
  commit(cache, { variables }, data) {
    const stack = stackOf(variables);
    if (stack) leaveMergedStack(cache, stack.id, appliedPayload(data));
  },
};

export type AddStockInputs = DrawStockInputs & { pantryId?: string };

export const addStock: LocalWrite<AddStockInputs> = {
  apply(cache, { variables, inputs: { delta, now } }) {
    const stack = stackOf(variables);
    if (!stack) return;
    if (delta !== null) bumpStock(cache, stack.id, delta, now);
    countNewBatch(cache, stack.id);
  },
  commit(cache, { variables, inputs: { pantryId } }, data) {
    const stack = stackOf(variables);
    const payload: unknown = appliedPayload(data);
    if (!stack || !isRecord(payload)) return;
    leaveMergedStack(cache, stack.id, payload);
    dropBatchesPage(cache, stack.id);
    // Lists a stack the pantry's reads have not brought, such as an emptied one.
    const servedId = idOf(answeredStack(payload));
    if (pantryId && servedId) {
      addToPantryItemsCache(cache, pantryId, stackRef(servedId));
    }
  },
};

export type DiscardExpiredInputs = {
  /** A batchless stack goes whole; a batched one on the server's recompute. */
  whole: boolean;
  now: string;
};

export const discardExpired: LocalWrite<DiscardExpiredInputs> = {
  apply(cache, { variables, inputs: { whole, now } }) {
    const stack = stackOf(variables);
    if (!stack || !whole || !isHeld(cache, stack)) return;
    writeEntityFields(cache, stack, {
      quantity: 0,
      condition: ItemCondition.Spoiled,
      updatedAt: now,
    });
    writeHeldStock(cache, stack.id, 0);
  },
  commit(cache, { variables }, data) {
    const stack = stackOf(variables);
    const payload: unknown = appliedPayload(data);
    if (!stack || !isRecord(payload)) return;
    leaveMergedStack(cache, stack.id, payload);
    if (isBatchesPage(payload.batchesConnection)) {
      writeRestatedBatches(cache, stack.id, payload.batchesConnection);
    }
  },
};

export type RemoveItemInputs = { pantryId: string };

export const removeItem: LocalWrite<RemoveItemInputs> = {
  apply(cache, { variables, inputs: { pantryId } }) {
    const stack = stackOf(variables);
    if (stack) hidePantryItem(cache, pantryId, stack.id);
  },
  // The answer names the row, which puts it back in the server's data.
  commit(cache, { variables, inputs: { pantryId } }, data) {
    const stack = stackOf(variables);
    if (!stack) return;
    const payload: unknown = appliedPayload(data);
    dropPantryItem(cache, pantryId, stack.id, {
      countsSettled:
        isRecord(payload) && carriesPantryCount(payload.pantry, pantryId),
    });
  },
};

export type CreatePantryInputs = {
  pantry: {
    id: string;
    homeId: string;
    name: string;
    description?: string | null;
    isDefault?: boolean | null;
  };
  today: string;
};

export const createPantry: LocalWrite<CreatePantryInputs> = {
  apply(cache, { inputs: { pantry, today } }) {
    const row = { __typename: 'Pantry', id: pantry.id };
    if (!isHeld(cache, row)) {
      writeLocalPantry(cache, pantry.id, pantry, today);
    }
    addPantryToHomeCache(cache, pantry.homeId, {
      __typename: 'Pantry',
      id: pantry.id,
    });
  },
  // The server's answer names the home, and its row is what is listed.
  commit(cache, { inputs: { pantry } }, data) {
    const payload: unknown = appliedPayload(data);
    const answered = isRecord(payload) ? payload.pantry : undefined;
    const homeId = isRecord(answered) ? answered.homeId : undefined;
    addPantryToHomeCache(
      cache,
      typeof homeId === 'string' ? homeId : pantry.homeId,
      { __typename: 'Pantry', id: pantry.id },
    );
  },
};

export type RemovePantryInputs = { homeId?: string | null };

const pantryIdOf = (variables: OperationVariables): string | undefined =>
  idOf(variables.input);

export const removePantry: LocalWrite<RemovePantryInputs> = {
  apply(cache, { variables, inputs: { homeId } }) {
    const id = pantryIdOf(variables);
    if (homeId && id) {
      removeOptimisticPantry(cache, homeId, id, { evictEntity: false });
    }
  },
  commit(cache, { variables, inputs: { homeId } }) {
    const id = pantryIdOf(variables);
    if (homeId && id) removeOptimisticPantry(cache, homeId, id);
  },
};
