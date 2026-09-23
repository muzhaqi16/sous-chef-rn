import { gql, type ApolloCache } from '@apollo/client';
import {
  SyncPantryItemDocument,
  SyncDeletePantryItemDocument,
  UpdatePantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import type {
  SyncDeletePantryItemInput,
  SyncPantryItemInput,
} from '#/graphql/generated/schemaTypes';
import {
  definedInputs,
  getClientId,
  getQueuedInput,
  readUnitSpec,
  withCapturedReads,
  withUnitSymbol,
  type QueuedInput,
  type ReplayInputReader,
  type SyncBuilder,
  type UnitSpec,
} from '#/apollo/offlineQueue/syncBuilder';
import { parseStoredQuantityText } from '#/utils/formatQuantity';
import { toDateKey } from '#/utils/dateUtils';

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

/** The queued pantry id and unit symbol, for an input that lacks them. */
const readPantryItemInputs =
  (unitOf: (input: QueuedInput) => UnitSpec): ReplayInputReader =>
  (mutation, cache) => {
    const input = getQueuedInput(mutation);
    const unit = unitOf(input);
    return definedInputs({
      pantryId: input.pantryId
        ? undefined
        : readPantryId(cache, getClientId(mutation)),
      unitSymbol: unit.unitSymbol
        ? undefined
        : readUnitSpec(cache, unit)?.unitSymbol,
    });
  };

// A create sends `unit: { unitId }`; an edit already sends `{ unitSymbol }`.
const itemUnitOf = (input: QueuedInput): UnitSpec => input.unit ?? {};
const quantityUnitOf = (input: QueuedInput): UnitSpec => ({
  unitId: input.unitId,
});

/**
 * PantryItem create/update sync. `SyncPantryItemInput` mirrors
 * `CreatePantryItemInput` with `id` → `clientId`; remaining fields pass straight
 * through by name, loosely typed because the queued input is untyped persisted
 * data and a strict annotation would need per-field casts on the replay path.
 */
export const buildPantryItemSync = withCapturedReads(
  readPantryItemInputs(itemUnitOf),
  (mutation, captured, cache) => {
    const input = getQueuedInput(mutation);
    const clientId = getClientId(mutation);
    const { id: _omitId, itemName, ...rest } = input;

    // Only `UpdatePantryItemInput` carries `itemName`. The sync upsert's update
    // branch ignores `item`, so a rename replays as the original (`version: Int!`),
    // through the current document: the queue persists the AST it was sent with,
    // which an older build wrote without the `$today` that `stats` requires.
    if (itemName != null) {
      return {
        syncMutation: UpdatePantryItemDocument,
        syncVariables: { today: toDateKey(new Date()), ...mutation.variables },
        requiresVersion: true,
      };
    }

    // Create inputs carry `pantryId`; `UpdatePantryItemInput` does not.
    const pantryId = rest.pantryId ?? captured.pantryId;
    if (!pantryId) {
      throw new Error(
        `Cannot sync ${mutation.operationName}: pantryId not found for item ${clientId}`,
      );
    }

    // The symbol is the half of the unit a retired id needs.
    const unit = readUnitSpec(
      cache,
      withUnitSymbol(itemUnitOf(input), captured.unitSymbol),
    );

    // Only a create carries its `pantryId`. A stack for the same item and unit
    // added while it sat queued absorbs it rather than refusing it.
    const isCreate = rest.pantryId != null && rest.version == null;

    return {
      syncMutation: SyncPantryItemDocument,
      syncVariables: {
        input: {
          ...rest,
          pantryId,
          ...(unit && { unit }),
          ...(isCreate && { forceAdd: true }),
          clientId,
        },
      },
    };
  },
);

/**
 * `UpdatePantryItemQuantityInput` does not align with `SyncPantryItemInput`: the
 * id rides as `pantryItemId`, the quantity is the raw string from the quantity
 * box, and the unit is a flat `unitId`. Map each explicitly.
 */
export const buildPantryItemQuantitySync = withCapturedReads(
  readPantryItemInputs(quantityUnitOf),
  (mutation, captured, cache) => {
    const input = getQueuedInput(mutation);
    const clientId = getClientId(mutation);

    const pantryId = input.pantryId ?? captured.pantryId;
    if (!pantryId) {
      throw new Error(
        `Cannot sync ${mutation.operationName}: pantryId not found for item ${clientId}`,
      );
    }

    // The queued text is the API text the hook sent, which may be `1 1/4`.
    const quantity =
      typeof input.quantity === 'string'
        ? parseStoredQuantityText(input.quantity)
        : input.quantity;

    const unit = readUnitSpec(
      cache,
      withUnitSymbol(quantityUnitOf(input), captured.unitSymbol),
    );

    const syncInput: SyncPantryItemInput = {
      clientId: clientId as string,
      pantryId,
      ...(quantity != null && Number.isFinite(quantity) && { quantity }),
      ...(unit && { unit }),
      ...(input.version != null && { version: input.version }),
    };
    return {
      syncMutation: SyncPantryItemDocument,
      syncVariables: { input: syncInput },
    };
  },
);

/** PantryItem delete sync — idempotent by `clientId`. */
export const buildDeletePantryItemSync: SyncBuilder = mutation => {
  const syncInput: SyncDeletePantryItemInput = {
    clientId: getClientId(mutation) as string,
  };
  return {
    syncMutation: SyncDeletePantryItemDocument,
    syncVariables: { input: syncInput },
  };
};
