/**
 * What each pantry write changes on the device, as a pending layer. The server's
 * answer writes its own rows; `commit` adds what it cannot state.
 */
import type {
  ApolloCache,
  OperationVariables,
  Reference,
} from '@apollo/client';
import { rowBaseline } from '#apollo/pendingWrites/conflictRead';
import { inputIdOf } from '#apollo/pendingWrites/inputId';
import {
  entityFields,
  type EntityFieldsInputs,
} from '#apollo/pendingWrites/entityFields';
import type { ConflictRead, LocalWrite } from '#apollo/pendingWrites/types';
import { writeEntityFields } from '#apollo/utils/localFirstFields';
import { isHeld } from '#apollo/utils/writeLocalEntity';
import { BatchStatus, ItemCondition } from '#graphql/generated/schemaTypes';
import { appliedPayload } from '#utils/errors/mutationPayload';
import { isRecord } from '#utils/isRecord';
import {
  PantryItemConflict_PantryItemFragmentDoc,
  PantryItemForConflictDocument,
} from './pantryItemConflict.generated';
import {
  addPantryItemLocally,
  addToPantryItemsCache,
  carriesPantryCount,
  dropPantryItem,
  hidePantryItem,
  listAnsweredPantryItem,
  showLocalPantryItem,
  type PantryItemRef,
} from '#entities/pantryItem/items';
import {
  addPantryToHomeCache,
  removeOptimisticPantry,
  writeLocalPantry,
} from '#features/pantry/cache/pantry';
import {
  dateActiveBatches,
  dropBatchesPage,
  typedExpiryKind,
  isBatchesPage,
  writeRestatedBatches,
} from '#entities/pantryItem/restatedStack';
import {
  bumpStock,
  countNewBatch,
  drawInside,
  moveContentsTo,
  rememberConsumeUnit,
  writeHeldStock,
} from '#entities/pantryItem/stock';
import type { LocalPantryItem } from '#entities/pantryItem/writeLocalPantryItem';
import { bindLocalWrite } from '#apollo/pendingWrites/bindLocalWrite';
import {
  AdjustPantryItemQuantityDocument,
  ConvertExpiredToWasteDocument,
  CorrectPantryItemPackageSizeDocument,
  CreatePantryDocument,
  CreatePantryItemDocument,
  CreatePantryItemUsageDocument,
  DeletePantryDocument,
  DeletePantryItemDocument,
  MarkPantryAsDefaultDocument,
  OpenPantryItemBatchDocument,
  RestockPantryItemDocument,
  UpdatePantryDocument,
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
  WastePantryItemBatchDocument,
} from '#features/pantry/graphql/pantry.generated';
import { RecordPantryStockCheckDocument } from '#features/pantry/hooks/useStockCheck.generated';

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
export const answeredStack = (payload: Record<string, unknown>): unknown =>
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

/**
 * A stock check's rows, as found: what each stack holds now, absolute, or null
 * where the answer moves nothing (still have) or only the server can say; with
 * `remainingNetWeight`, what its packages were found to hold, in its own unit.
 */
export type StockCheckInputs = {
  pantryId: string;
  rows: readonly {
    pantryItemId: string;
    /** What a refusal names the row by. */
    itemName: string;
    held: number | null;
    remainingNetWeight?: number;
  }[];
  now: string;
};

/** The server checks only stacks that hold stock, so an emptied one leaves. */
function leaveStockCheck(
  cache: ApolloCache,
  pantryId: string,
  emptied: ReadonlySet<string>,
): void {
  cache.modify({
    id: cache.identify({ __typename: 'Pantry', id: pantryId }),
    fields: {
      stockToConfirm(existing: readonly Reference[], { readField }) {
        return existing.filter(
          row => !emptied.has(readField<string>('id', row) ?? ''),
        );
      },
    },
  });
}

export const recordStockCheck: LocalWrite<StockCheckInputs> = {
  apply(cache, { inputs: { pantryId, rows, now } }) {
    const emptied = new Set<string>();
    for (const { pantryItemId, held, remainingNetWeight } of rows) {
      const stack = stackRef(pantryItemId);
      if (held === null || !isHeld(cache, stack)) continue;
      moveContentsTo(cache, pantryItemId, held);
      writeEntityFields(cache, stack, {
        quantity: held,
        remainingNetWeight,
        updatedAt: now,
      });
      writeHeldStock(cache, pantryItemId, held);
      if (held === 0) emptied.add(pantryItemId);
    }
    if (emptied.size > 0) leaveStockCheck(cache, pantryId, emptied);
  },
};

type StockDeltaInputs = {
  /** In tracking units; null when only the server can convert the amount. */
  delta: number | null;
  now: string;
};

export type DrawStockInputs = StockDeltaInputs & {
  /** The amount as stated, which may be in what a package holds. */
  stated?: { amount: number; unitId: string } | null;
  /** The unit a use remembers; waste leaves the stack's alone. */
  usedUnitId?: string | null;
  /** A use taken from this batch alone, which moves with its stack. */
  batchId?: string | null;
};

/**
 * A use drawn from one batch, as the server draws it: the batch is opened, and
 * emptied it is depleted. What opening does to its date is the server's.
 */
function drawBatch(
  cache: ApolloCache,
  batchId: string,
  delta: number,
  now: string,
): void {
  const id = cache.identify({ __typename: 'PantryItemBatch', id: batchId });
  if (!id) return;
  const left = (held: number) => Math.max(0, held + delta);
  cache.modify<{
    quantity: number;
    status: BatchStatus;
    depletedAt: string | null;
    isOpened: boolean;
    openedAt: string | null;
  }>({
    id,
    fields: {
      quantity: held => left(held),
      status: (status, { readField }) =>
        left(readField('quantity') ?? 0) === 0 ? BatchStatus.Depleted : status,
      depletedAt: (at, { readField }) =>
        left(readField('quantity') ?? 0) === 0 ? now : at,
      isOpened: () => true,
      openedAt: at => at ?? now,
    },
  });
}

export const drawStock: LocalWrite<DrawStockInputs> = {
  apply(
    cache,
    { variables, inputs: { delta, stated, usedUnitId, batchId, now } },
  ) {
    const stack = stackOf(variables);
    if (!stack) return;
    if (delta !== null) {
      bumpStock(cache, stack.id, delta, now);
      if (batchId) drawBatch(cache, batchId, delta, now);
    } else if (stated) {
      drawInside(cache, stack.id, stated.amount, stated.unitId, now);
    }
    if (usedUnitId) rememberConsumeUnit(cache, stack.id, usedUnitId);
  },
  // The answer states no batch: which ones a use drew on, their dates once
  // opened and their versions are read again, as after a restock.
  commit(cache, { variables }, data) {
    const stack = stackOf(variables);
    if (!stack) return;
    leaveMergedStack(cache, stack.id, appliedPayload(data));
    dropBatchesPage(cache, stack.id);
  },
};

export type WasteBatchInputs = {
  /** The batch's stack, which loses what the batch held. */
  pantryItemId: string;
  /** What the batch held, in the stack's tracking unit. */
  held: number;
  now: string;
};

/** A whole batch thrown out: it is wasted, and its stack holds that much less. */
export const wasteBatch: LocalWrite<WasteBatchInputs> = {
  subject: { key: 'batchId' },
  // It moves its stack, so it stays behind that stack's writes.
  orderedBy: ({ inputs: { pantryItemId } }) => pantryItemId,
  apply(cache, { variables, inputs: { pantryItemId, held, now } }) {
    const input: unknown = variables.input;
    const batchId =
      isRecord(input) && typeof input.batchId === 'string'
        ? input.batchId
        : null;
    const batch = batchId && { __typename: 'PantryItemBatch', id: batchId };
    if (!batch || !isHeld(cache, batch)) return;
    writeEntityFields(cache, batch, {
      status: BatchStatus.Wasted,
      quantity: 0,
      depletedAt: now,
    });
    if (!isHeld(cache, stackRef(pantryItemId))) return;
    bumpStock(cache, pantryItemId, -held, now);
    cache.modify<{ activeBatchCount: number }>({
      id: cache.identify(stackRef(pantryItemId)),
      fields: { activeBatchCount: count => Math.max(0, count - 1) },
    });
  },
  // The answer states the stack, not the batch: the batches are read again.
  commit(cache, { inputs: { pantryItemId } }, data) {
    leaveMergedStack(cache, pantryItemId, appliedPayload(data));
    dropBatchesPage(cache, pantryItemId);
  },
};

export type AddStockInputs = StockDeltaInputs & {
  pantryId?: string;
  contents?: Parameters<typeof bumpStock>[4];
};

export const addStock: LocalWrite<AddStockInputs> = {
  apply(cache, { variables, inputs: { delta, now, contents } }) {
    const stack = stackOf(variables);
    if (!stack) return;
    if (delta !== null) bumpStock(cache, stack.id, delta, now, contents);
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

export const removePantry: LocalWrite<RemovePantryInputs> = {
  apply(cache, { variables, inputs: { homeId } }) {
    const id = inputIdOf(variables);
    if (homeId && id) {
      removeOptimisticPantry(cache, homeId, id, { evictEntity: false });
    }
  },
  commit(cache, { variables, inputs: { homeId } }) {
    const id = inputIdOf(variables);
    if (homeId && id) removeOptimisticPantry(cache, homeId, id);
  },
};

const pantryRowConflict: ConflictRead<EntityFieldsInputs> = {
  typename: 'PantryItem',
  query: PantryItemForConflictDocument,
  fragment: PantryItemConflict_PantryItemFragmentDoc,
  changed: ({ fields }) => fields,
};

/** The date an update sets: undefined when it leaves the date alone. */
function expiryOf(variables: OperationVariables): string | null | undefined {
  const input: unknown = variables.input;
  if (!isRecord(input) || !('expiresOn' in input)) return undefined;
  return typeof input.expiresOn === 'string' ? input.expiresOn : null;
}

// A date edit moves every active batch's date with the stack's, and the answer
// restates the batches.
export const updatePantryRow: LocalWrite<EntityFieldsInputs> = {
  ...entityFields,
  keyed: true,
  conflict: pantryRowConflict,
  capture: (cache, variables) => ({
    baseline: rowBaseline(cache, pantryRowConflict, variables),
  }),
  apply(cache, write) {
    entityFields.apply(cache, write);
    const stack = stackOf(write.variables);
    const expiresOn = expiryOf(write.variables);
    if (!stack || expiresOn === undefined) return;
    writeEntityFields(cache, stack, { expiryKind: typedExpiryKind(expiresOn) });
    if (dateActiveBatches(cache, stack.id, expiresOn)) {
      writeEntityFields(cache, stack, { earliestBatchExpiresOn: expiresOn });
    }
  },
  commit(cache, { variables }, data) {
    const stack = stackOf(variables);
    const payload: unknown = appliedPayload(data);
    if (!stack || !isRecord(payload)) return;
    if (isBatchesPage(payload.batchesConnection)) {
      writeRestatedBatches(cache, stack.id, payload.batchesConnection);
    }
  },
};

// Each document this feature sends as a local write, bound to its write.
export const createPantryItemWrite = bindLocalWrite(
  CreatePantryItemDocument,
  createItem,
);
export const updatePantryItemWrite = bindLocalWrite(
  UpdatePantryItemDocument,
  updatePantryRow,
);
export const updatePantryItemQuantityWrite = bindLocalWrite(
  UpdatePantryItemQuantityDocument,
  { ...setStock, subject: { key: 'pantryItemId' } },
);
export const adjustPantryItemQuantityWrite = bindLocalWrite(
  AdjustPantryItemQuantityDocument,
  setStock,
);
export const recordPantryStockCheckWrite = bindLocalWrite(
  RecordPantryStockCheckDocument,
  {
    ...recordStockCheck,
    subject: { key: 'entries', rowKey: 'pantryItemId' },
  },
);
export const deletePantryItemWrite = bindLocalWrite(
  DeletePantryItemDocument,
  removeItem,
);
export const createPantryItemUsageWrite = bindLocalWrite(
  CreatePantryItemUsageDocument,
  { ...drawStock, subject: { key: 'pantryItemId' } },
);
export const restockPantryItemWrite = bindLocalWrite(
  RestockPantryItemDocument,
  addStock,
);
export const convertExpiredToWasteWrite = bindLocalWrite(
  ConvertExpiredToWasteDocument,
  { ...discardExpired, subject: { key: 'pantryItemId' } },
);
export const openPantryItemBatchWrite = bindLocalWrite(
  OpenPantryItemBatchDocument,
  { ...entityFields, subject: { key: 'batchId' } },
);
export const wastePantryItemBatchWrite = bindLocalWrite(
  WastePantryItemBatchDocument,
  wasteBatch,
);
export const correctPantryItemPackageSizeWrite = bindLocalWrite(
  CorrectPantryItemPackageSizeDocument,
  entityFields,
);
export const createPantryWrite = bindLocalWrite(
  CreatePantryDocument,
  createPantry,
);
export const updatePantryWrite = bindLocalWrite(
  UpdatePantryDocument,
  entityFields,
);
export const deletePantryWrite = bindLocalWrite(
  DeletePantryDocument,
  removePantry,
);
export const markPantryAsDefaultWrite = bindLocalWrite(
  MarkPantryAsDefaultDocument,
  entityFields,
);
