import { gql, type ApolloCache } from '@apollo/client';
import {
  SyncPantryItemDocument,
  SyncDeletePantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import type {
  SyncDeletePantryItemInput,
  SyncPantryItemInput,
} from '#/graphql/generated/schemaTypes';
import {
  getClientId,
  getQueuedInput,
  type SyncBuilder,
  type SyncBuilderTable,
} from '#/apollo/offlineQueue/syncBuilder';
import { parseFractionalInput } from '#/utils/fractionUtils';

/**
 * How the offline queue replays a pantry write. The contract, and why replay is
 * split two ways at all, is in `#/apollo/offlineQueue/syncBuilder`.
 */

/**
 * Reads a PantryItem's `pantryId` from cache during queue processing.
 * `UpdatePantryItemInput` carries no `pantryId`, but `SyncPantryItemInput`
 * requires it, so the update→sync replay backfills it from the cached entity.
 */
const QUEUE_PANTRY_ITEM_FRAGMENT = gql`
  fragment QueuePantryItemData on PantryItem {
    id
    pantryId
  }
`;

const readPantryId = (
  cache: ApolloCache,
  itemId: string | undefined,
): string | undefined => {
  if (!itemId) return undefined;
  const itemData = cache.readFragment<{ id: string; pantryId: string }>({
    id: cache.identify({ __typename: 'PantryItem', id: itemId }),
    fragment: QUEUE_PANTRY_ITEM_FRAGMENT,
  });
  return itemData?.pantryId ?? undefined;
};

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
const buildPantryItemSync: SyncBuilder = (mutation, cache) => {
  const input = getQueuedInput(mutation);
  const clientId = getClientId(mutation, input);
  const { id: _omitId, itemName, ...rest } = input;

  // SyncPantryItemInput requires `pantryId`. Create inputs already carry it;
  // `UpdatePantryItemInput` does not — backfill from the cached PantryItem.
  const pantryId =
    (rest.pantryId as string | undefined) ?? readPantryId(cache, clientId);
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

/**
 * Pantry quantity sync. `UpdatePantryItemQuantityInput` doesn't align with
 * `SyncPantryItemInput`: the item id rides as `pantryItemId` (not `id`), the
 * quantity is a string (the raw quantity-box value), and the unit is a flat
 * `unitId`. Map each explicitly; `pantryId` is backfilled from the cached
 * PantryItem like the other pantry syncs.
 */
const buildPantryItemQuantitySync: SyncBuilder = (mutation, cache) => {
  const input = getQueuedInput(mutation);
  const clientId = input.pantryItemId ?? getClientId(mutation, input);

  const pantryId = input.pantryId ?? readPantryId(cache, clientId);
  if (!pantryId) {
    throw new Error(
      `Cannot sync ${mutation.operationName}: pantryId not found for item ${clientId}`,
    );
  }

  // Fraction-aware: the queued mutation carries whatever the person typed into
  // a quantity field, which may be `1 1/4`.
  const quantity =
    typeof input.quantity === 'string'
      ? parseFractionalInput(input.quantity) ?? NaN
      : input.quantity;

  const syncInput: SyncPantryItemInput = {
    clientId: clientId as string,
    pantryId,
    ...(quantity != null && Number.isFinite(quantity) && { quantity }),
    ...(input.unitId != null && { unit: { unitId: input.unitId } }),
    ...(input.version != null && { version: input.version }),
  };
  return {
    syncMutation: SyncPantryItemDocument,
    syncVariables: { input: syncInput },
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
 * The specialized single-item create maps onto the same builder as its
 * canonical counterpart because it produces the same entity from the same
 * input fields.
 *
 * The granular deltas (adjust / restock / consume / open-batch / waste /
 * convert-expired) have NO entry: they replay as the original canonical
 * mutation, made at-most-once by a client-minted `input.idempotencyKey` (the
 * server returns ConflictError(code: IDEMPOTENT_REPLAY) on a replay). They
 * queue via their explicit `context.localFirst`, not through this table.
 */
export const PANTRY_SYNC_BUILDERS: SyncBuilderTable = {
  CreatePantryItem: buildPantryItemSync,
  UpdatePantryItem: buildPantryItemSync,
  UpdatePantryItemQuantity: buildPantryItemQuantitySync,
  BarcodeCreatePantryItem: buildPantryItemSync,
  DeletePantryItem: buildDeletePantryItemSync,
};
