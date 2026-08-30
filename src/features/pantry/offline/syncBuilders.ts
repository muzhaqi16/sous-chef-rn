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

// How the offline queue replays a pantry write; contract in
// `#/apollo/offlineQueue/syncBuilder`.

/**
 * `UpdatePantryItemInput` carries no `pantryId` but `SyncPantryItemInput`
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
 * `CreatePantryItemInput` with `id` → `clientId`; remaining fields pass straight
 * through by name, loosely typed because the queued input is untyped persisted
 * data and a strict annotation would need per-field casts on the replay path.
 */
const buildPantryItemSync: SyncBuilder = (mutation, cache) => {
  const input = getQueuedInput(mutation);
  const clientId = getClientId(mutation, input);
  const { id: _omitId, itemName, ...rest } = input;

  // Create inputs carry `pantryId`; `UpdatePantryItemInput` does not.
  const pantryId =
    (rest.pantryId as string | undefined) ?? readPantryId(cache, clientId);
  if (!pantryId) {
    throw new Error(
      `Cannot sync ${mutation.operationName}: pantryId not found for item ${clientId}`,
    );
  }

  // `SyncPantryItemInput` takes `item: InlineItemInput`, not a flat `itemName`:
  // fold `UpdatePantryItem`'s flat name in so a rename syncs.
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
 * `UpdatePantryItemQuantityInput` does not align with `SyncPantryItemInput`: the
 * id rides as `pantryItemId`, the quantity is the raw string from the quantity
 * box, and the unit is a flat `unitId`. Map each explicitly.
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

  // The queued mutation carries whatever was typed, which may be `1 1/4`.
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
 * `BarcodeCreatePantryItem` shares the create builder — same entity, same fields.
 * The granular deltas (adjust / restock / consume / waste / …) have NO entry: they
 * queue via their own `context.localFirst` and replay as the original mutation,
 * made at-most-once by a client-minted `input.idempotencyKey`.
 */
export const PANTRY_SYNC_BUILDERS: SyncBuilderTable = {
  CreatePantryItem: buildPantryItemSync,
  UpdatePantryItem: buildPantryItemSync,
  UpdatePantryItemQuantity: buildPantryItemQuantitySync,
  BarcodeCreatePantryItem: buildPantryItemSync,
  DeletePantryItem: buildDeletePantryItemSync,
};
