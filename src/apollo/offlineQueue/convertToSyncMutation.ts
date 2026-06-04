import type { DocumentNode } from 'graphql';
import {
  SyncPantryItemDocument,
  SyncDeletePantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  SyncShoppingListItemDocument,
  SyncDeleteShoppingListItemDocument,
  SyncMoveShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import type {
  SyncDeletePantryItemInput,
  SyncDeleteShoppingListItemInput,
  SyncMoveShoppingListItemInput,
  SyncShoppingListItemInput,
} from '#/graphql/generated/schemaTypes';
import type { QueuedMutation } from './types';
import { logger } from '#/utils/environment';

/**
 * Two-tier offline replay mapping.
 *
 * A queued mutation is replayed through a dedicated `Sync*` mutation that is
 * idempotent by the client-minted cuid (which rides the replay as `clientId`),
 * so an online success and a queued replay converge on one row. Operations with
 * no clean `Sync*` shape fall through to {@link replayOriginal}, which re-sends
 * the original mutation (the server's direct-create path is itself id-idempotent).
 *
 * The op-name → builder mapping lives in {@link SYNC_REGISTRY} (a data table, not
 * an if-chain) so adding a queued op is a one-line entry, and each builder is an
 * independently testable pure function that constructs a generated `Sync*Input`.
 */
export interface SyncConversion {
  syncMutation: DocumentNode;
  syncVariables: Record<string, unknown>;
}

/**
 * Cache readers a builder uses to backfill a required parent id the queued input
 * may omit (`UpdatePantryItemInput` carries no `pantryId`; shopping update/qty
 * inputs carry only the item id). Injected so the builders stay pure and the
 * cache access lives in the queue manager.
 */
export interface SyncReaders {
  readPantryId: (clientId: string | undefined) => string | undefined;
  readShoppingListId: (clientId: string | undefined) => string | undefined;
}

/**
 * Loose shape of a queued mutation's `input`. It is persisted untyped (the queue
 * stores arbitrary mutation variables), so this documents the fields the builders
 * read across the mapped operations. Quantity/update shopping ops send the unit as
 * flat `unitId` / `unitName` scalars rather than a `unit` object; the shopping
 * builder normalizes both.
 */
interface QueuedInput {
  id?: string;
  itemId?: string;
  version?: number;
  shoppingListId?: string;
  pantryId?: string;
  itemName?: string;
  category?: string;
  notes?: string;
  quantity?: number | string;
  unit?: { unitId?: string; unitName?: string };
  unitId?: string;
  unitName?: string;
  purchased?: boolean;
  afterItemId?: string;
  beforeItemId?: string;
  item?: Record<string, unknown>;
  [key: string]: unknown;
}

type SyncBuilder = (
  mutation: QueuedMutation,
  readers: SyncReaders,
) => SyncConversion;

const getQueuedInput = (mutation: QueuedMutation): QueuedInput =>
  (mutation.variables.input ?? {}) as QueuedInput;

/**
 * The client-minted permanent cuid IS the sync `clientId`. It rides on the
 * mutation input as `id` (create/update/toggle/delete) or `itemId` (qty/move).
 *
 * Returns `undefined` for a malformed queued input with no id. That is
 * deliberate: the client mints permanent cuids, so a missing id surfaces as
 * `undefined` (the server rejects it as a permanent failure) rather than being
 * back-filled with a fabricated `temp-` id. Builders therefore cast it to the
 * generated `Sync*Input`'s required `clientId: ID` — the cast preserves the
 * undefined-flows-through behavior (a compile-time cast doesn't coerce at
 * runtime) while satisfying the schema type.
 */
const getClientId = (
  mutation: QueuedMutation,
  input: QueuedInput,
): string | undefined =>
  input.id ?? input.itemId ?? (mutation.variables.id as string | undefined);

/**
 * PantryItem create/update sync. `SyncPantryItemInput` mirrors
 * `CreatePantryItemInput` with `id` → `clientId` (pantry quantity is a plain
 * Float). `BarcodeCreatePantryItem` creates the same entity from the same input
 * shape, so it syncs through here too.
 *
 * The remaining create-input fields pass straight through (their names align with
 * `SyncPantryItemInput`); the object stays loosely typed because the queued input
 * is untyped persisted data and a strict annotation would force a field-by-field
 * rewrite with per-field casts — risking a dropped field on the critical replay
 * path. `pantryId`, `item`, and `clientId` are set explicitly.
 */
const buildPantryItemSync: SyncBuilder = (mutation, readers) => {
  const input = getQueuedInput(mutation);
  const clientId = getClientId(mutation, input);
  const { id: _omitId, itemName, ...rest } = input;

  // SyncPantryItemInput requires `pantryId`. Create inputs already carry it;
  // `UpdatePantryItemInput` does not — backfill from the cached PantryItem.
  const pantryId =
    (rest.pantryId as string | undefined) ?? readers.readPantryId(clientId);
  if (!pantryId) {
    throw new Error(
      `Cannot sync ${mutation.operationName}: pantryId not found for item ${clientId}`,
    );
  }

  // SyncPantryItemInput has no flat `itemName` — it takes `item: InlineItemInput`
  // ({ name }). `UpdatePantryItem` sends a flat `itemName`; fold it into `item` so
  // a rename syncs. Create inputs already use `item`, so this preserves it.
  const existingItem = rest.item as Record<string, unknown> | undefined;
  const item =
    itemName != null
      ? { ...(existingItem ?? {}), name: itemName }
      : existingItem;

  return {
    syncMutation: SyncPantryItemDocument,
    syncVariables: {
      input: {
        ...rest,
        pantryId,
        ...(item != null && { item }),
        clientId,
      },
    },
  };
};

/** PantryItem delete sync — idempotent by `clientId`. */
const buildDeletePantryItemSync: SyncBuilder = mutation => {
  const input = getQueuedInput(mutation);
  const syncInput: SyncDeletePantryItemInput = {
    clientId: getClientId(mutation, input) as string,
    version: input.version,
  };
  return {
    syncMutation: SyncDeletePantryItemDocument,
    syncVariables: { input: syncInput },
  };
};

/**
 * ShoppingListItem create/update sync. `SyncShoppingListItemFullInput =
 * { clientId, item: SyncShoppingListItemInput }`. `shoppingListId` is required on
 * the item — present on a create input, else read from cache. The specialized
 * single-item creates (barcode, add-from-filtered-pantry, add-from-pantry-item)
 * produce a ShoppingListItem from the same fields, so they sync through here too.
 */
const buildShoppingItemSync: SyncBuilder = (mutation, readers) => {
  const input = getQueuedInput(mutation);
  const clientId = getClientId(mutation, input);

  const shoppingListId =
    input.shoppingListId ?? readers.readShoppingListId(clientId);
  if (!shoppingListId) {
    throw new Error(
      `Cannot sync ${mutation.operationName}: shoppingListId not found for item ${clientId}`,
    );
  }

  // `unit` is a UnitSpecInput object. AddItem sends it as `unit`, but
  // UpdateShoppingListItem(Quantity) sends flat `unitId` / `unitName` — normalize
  // both so an offline unit change isn't dropped on replay.
  const unit =
    input.unit ??
    (input.unitId != null || input.unitName != null
      ? {
          ...(input.unitId != null && { unitId: input.unitId }),
          ...(input.unitName != null && { unitName: input.unitName }),
        }
      : undefined);

  const item: SyncShoppingListItemInput = {
    shoppingListId,
    ...(input.itemName != null && { itemName: input.itemName }),
    ...(input.itemId != null && { itemId: input.itemId }),
    ...(input.category != null && { category: input.category }),
    ...(input.notes != null && { notes: input.notes }),
    ...(unit && { unit: unit as SyncShoppingListItemInput['unit'] }),
    // `quantity` is the FlexibleQuantity scalar (string | number, e.g. "1/3" or
    // 2) — pass it through directly; no unitId needed.
    ...(input.quantity != null && { quantity: input.quantity }),
    ...(input.purchased != null && {
      purchaseTracking: { isPurchased: input.purchased },
    }),
    // Carried by the barcode add (and accepted by SyncShoppingListItemInput) so
    // replaying through sync doesn't drop them vs. the original mutation.
    ...(input.brand != null && {
      brand: input.brand as SyncShoppingListItemInput['brand'],
    }),
    ...(input.netWeight != null && {
      netWeight: input.netWeight as SyncShoppingListItemInput['netWeight'],
    }),
    ...(input.storePrefs != null && {
      storePrefs: input.storePrefs as SyncShoppingListItemInput['storePrefs'],
    }),
    ...(input.pricing != null && {
      pricing: input.pricing as SyncShoppingListItemInput['pricing'],
    }),
    ...(input.version != null && { version: input.version }),
  };

  return {
    syncMutation: SyncShoppingListItemDocument,
    syncVariables: { input: { clientId, item } },
  };
};

/** ShoppingListItem delete sync — idempotent by `clientId`. */
const buildDeleteShoppingItemSync: SyncBuilder = mutation => {
  const input = getQueuedInput(mutation);
  const syncInput: SyncDeleteShoppingListItemInput = {
    clientId: getClientId(mutation, input) as string,
    version: input.version,
  };
  return {
    syncMutation: SyncDeleteShoppingListItemDocument,
    syncVariables: { input: syncInput },
  };
};

/** ShoppingListItem reorder sync — fractional-index move, idempotent by `clientId`. */
const buildMoveShoppingItemSync: SyncBuilder = mutation => {
  const input = getQueuedInput(mutation);
  const syncInput: SyncMoveShoppingListItemInput = {
    clientId: getClientId(mutation, input) as string,
    afterId: input.afterItemId,
    beforeId: input.beforeItemId,
    version: input.version,
  };
  return {
    syncMutation: SyncMoveShoppingListItemDocument,
    syncVariables: { input: syncInput },
  };
};

/**
 * op-name → sync builder. The specialized single-item creates map onto the same
 * `Sync*` builder as their canonical counterparts because they produce the same
 * entity from the same input fields (see the two-tier replay doc).
 */
const SYNC_REGISTRY: Record<string, SyncBuilder> = {
  // PantryItem
  CreatePantryItem: buildPantryItemSync,
  UpdatePantryItem: buildPantryItemSync,
  BarcodeCreatePantryItem: buildPantryItemSync,
  DeletePantryItem: buildDeletePantryItemSync,
  // ShoppingListItem create / update
  AddItemToShoppingList: buildShoppingItemSync,
  UpdateShoppingListItem: buildShoppingItemSync,
  UpdateShoppingListItemQuantity: buildShoppingItemSync,
  ToggleShoppingListItemPurchased: buildShoppingItemSync,
  BarcodeAddItemToShoppingList: buildShoppingItemSync,
  AddItemToShoppingListFromFilteredPantry: buildShoppingItemSync,
  AddItemToShoppingListFromPantryItem: buildShoppingItemSync,
  // ShoppingListItem delete / move
  RemoveItemFromShoppingList: buildDeleteShoppingItemSync,
  MoveShoppingListItem: buildMoveShoppingItemSync,
};

/**
 * Convert a queued mutation to its sync replay. Falls back to replaying the
 * original mutation for operations without a `Sync*` mapping (their server
 * create path is itself id-idempotent, so re-sending is duplicate-safe).
 */
export function convertToSyncMutation(
  mutation: QueuedMutation,
  readers: SyncReaders,
): SyncConversion {
  const build = SYNC_REGISTRY[mutation.operationName];
  if (build) {
    return build(mutation, readers);
  }

  logger.info(
    `ℹ️ Queue: No sync mutation for ${mutation.operationName}, using original mutation`,
  );
  return {
    syncMutation: mutation.mutation,
    syncVariables: mutation.variables,
  };
}
