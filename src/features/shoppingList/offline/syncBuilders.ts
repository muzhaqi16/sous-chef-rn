import { gql, type ApolloCache } from '@apollo/client';
import {
  SyncShoppingListItemDocument,
  SyncDeleteShoppingListItemDocument,
  SyncMoveShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import type {
  SyncDeleteShoppingListItemInput,
  SyncMoveShoppingListItemInput,
  SyncShoppingListItemFieldsInput,
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
import type { QueuedMutation, ReplayInputs } from '#/apollo/offlineQueue/types';

/**
 * How the offline queue replays a shopping-list write; contract in
 * `#/apollo/offlineQueue/syncBuilder`. Completeness invariant: a field added to
 * the list query must reach the optimistic builder, the create mutation's
 * selection AND this replay input, or the cache read goes incomplete offline.
 */

/** Reads a ShoppingListItem's owning list from cache during queue processing. */
const QUEUE_ITEM_DATA_FRAGMENT = gql`
  fragment QueueItemData on ShoppingListItem {
    id
    shoppingList {
      id
    }
  }
`;

/**
 * Backfills the required @oneOf catalog ref for inputs that carry only the row
 * id. Separate from {@link QUEUE_ITEM_DATA_FRAGMENT} and read with
 * `returnPartialData` so a row cached without its linked `item` still resolves
 * `itemName`.
 */
const QUEUE_ITEM_REF_FRAGMENT = gql`
  fragment QueueItemRefData on ShoppingListItem {
    id
    itemName
    item {
      id
    }
  }
`;

// The sync input requires `shoppingListId`; update/toggle/quantity variables
// carry only the item id.
const readShoppingListId = (
  cache: ApolloCache,
  itemId: string | undefined,
): string | undefined => {
  if (!itemId) return undefined;
  const itemData = cache.readFragment<{
    id: string;
    shoppingList: { id: string };
  }>({
    id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
    fragment: QUEUE_ITEM_DATA_FRAGMENT,
  });
  return itemData?.shoppingList.id;
};

// Prefers the linked catalog item id; falls back to the row's free-text name
// (the server links-or-creates by name, matching the original add).
const readItemRef = (
  cache: ApolloCache,
  itemId: string | undefined,
): SyncShoppingListItemFieldsInput['item'] | undefined => {
  if (!itemId) return undefined;
  const itemData = cache.readFragment<{
    id: string;
    itemName: string | null;
    item: { id: string } | null;
  }>({
    id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
    fragment: QUEUE_ITEM_REF_FRAGMENT,
    returnPartialData: true,
  });
  if (itemData?.item?.id) return { itemId: itemData.item.id };
  if (itemData?.itemName) return { itemName: itemData.itemName };
  return undefined;
};

const isMultiRowBatch = (mutation: QueuedMutation): boolean => {
  const { items } = getQueuedInput(mutation);
  return Array.isArray(items) && items.length > 1;
};

/** A single-row input: the batch-add shape flattened to its one item. */
const flattenedInput = (mutation: QueuedMutation): QueuedInput => {
  const queued = getQueuedInput(mutation);
  return Array.isArray(queued.items) && queued.items.length > 0
    ? { ...queued.items[0], shoppingListId: queued.shoppingListId }
    : queued;
};

// AddItem sends a `unit` UnitSpecInput; UpdateShoppingListItem(Quantity) sends
// flat `unitId`/`unitName` — normalize both or the unit change is lost.
const queuedUnitSpec = (input: QueuedInput): UnitSpec => ({
  ...((input.unit ?? {}) as UnitSpec),
  ...(input.unitId != null && { unitId: input.unitId }),
  ...(input.unitName != null && { unitName: input.unitName }),
});

/**
 * What the replay needs beyond the input: the owning list, the catalog ref and
 * the unit symbol. An id the vocabulary repair retired cannot be re-resolved on
 * replay, a symbol can. Flat `itemId` is never the ref — on
 * UpdateShoppingListItemQuantity it is the ROW id.
 */
const readShoppingItemInputs: ReplayInputReader = (mutation, cache) => {
  if (isMultiRowBatch(mutation)) return {};
  const input = flattenedInput(mutation);
  const clientId = getClientId(mutation);
  const hasItemRef = input.item != null || input.itemName != null;
  const itemRef = hasItemRef ? undefined : readItemRef(cache, clientId);
  const unit = queuedUnitSpec(input);
  return definedInputs({
    shoppingListId: input.shoppingListId
      ? undefined
      : readShoppingListId(cache, clientId),
    refItemId: itemRef && 'itemId' in itemRef ? itemRef.itemId : undefined,
    refItemName:
      itemRef && 'itemName' in itemRef ? itemRef.itemName : undefined,
    unitSymbol: unit.unitSymbol
      ? undefined
      : readUnitSpec(cache, unit)?.unitSymbol,
  });
};

const capturedItemRef = (
  inputs: ReplayInputs,
): SyncShoppingListItemFieldsInput['item'] | undefined => {
  if (inputs.refItemId) return { itemId: inputs.refItemId };
  if (inputs.refItemName) return { itemName: inputs.refItemName };
  return undefined;
};

/**
 * ShoppingListItem create/update sync. `shoppingListId` is required on the item
 * — present on a create input, else captured when queued. The specialized
 * single-item creates route here too: same entity from the same fields.
 */
export const buildShoppingItemSync = withCapturedReads(
  readShoppingItemInputs,
  (mutation, captured, cache) => {
    // One Sync* upsert carries one row. A batch of several replays as itself,
    // idempotent per row: each row's `id` is its primary key.
    if (isMultiRowBatch(mutation)) {
      return {
        syncMutation: mutation.mutation,
        syncVariables: mutation.variables,
      };
    }
    const input = flattenedInput(mutation);
    const clientId = getClientId(mutation);

    const shoppingListId = input.shoppingListId ?? captured.shoppingListId;
    if (!shoppingListId) {
      throw new Error(
        `Cannot sync ${mutation.operationName}: shoppingListId not found for item ${clientId}`,
      );
    }

    const unit = readUnitSpec(
      cache,
      withUnitSymbol(queuedUnitSpec(input), captured.unitSymbol),
    );

    // Update sends a `purchaseTracking` object, the toggle a flat `purchased`.
    const purchaseTracking =
      input.purchaseTracking ??
      (input.purchased != null ? { isPurchased: input.purchased } : undefined);

    // Required @oneOf ItemRefInput: exactly one of itemId/itemName, zero or
    // both rejected pre-resolver.
    const itemRef =
      (input.item as SyncShoppingListItemFieldsInput['item'] | undefined) ??
      (input.itemName != null ? { itemName: input.itemName } : undefined) ??
      capturedItemRef(captured);
    if (!itemRef) {
      throw new Error(
        `Cannot sync ${mutation.operationName}: item ref not found for item ${clientId}`,
      );
    }

    const item: SyncShoppingListItemFieldsInput = {
      shoppingListId,
      item: itemRef,
      ...(input.category != null && { category: input.category }),
      ...(input.notes != null && { notes: input.notes }),
      ...(unit && { unit: unit }),
      // FlexibleQuantity scalar (string | number, e.g. "1/3") — pass through.
      ...(input.quantity != null && { quantity: input.quantity }),
      ...(purchaseTracking != null && {
        purchaseTracking: purchaseTracking,
      }),
      ...(input.priority != null && { priority: input.priority }),
      ...(input.sortOrder != null && { sortOrder: input.sortOrder }),
      // Carried by the barcode add; replay must not drop them.
      ...(input.brand != null && {
        brand: input.brand,
      }),
      ...(input.netWeight != null && {
        netWeight: input.netWeight,
      }),
      ...(input.storePrefs != null && {
        storePrefs: input.storePrefs,
      }),
      ...(input.pricing != null && {
        pricing: input.pricing,
      }),
      ...(input.version != null && { version: input.version }),
    };

    return {
      syncMutation: SyncShoppingListItemDocument,
      syncVariables: { input: { clientId, item } },
    };
  },
);

/** ShoppingListItem delete sync — idempotent by `clientId`. */
export const buildDeleteShoppingItemSync: SyncBuilder = mutation => {
  const syncInput: SyncDeleteShoppingListItemInput = {
    clientId: getClientId(mutation) as string,
  };
  return {
    syncMutation: SyncDeleteShoppingListItemDocument,
    syncVariables: { input: syncInput },
  };
};

/** ShoppingListItem reorder sync — fractional-index move, idempotent by `clientId`. */
export const buildMoveShoppingItemSync: SyncBuilder = mutation => {
  const input = getQueuedInput(mutation);
  const syncInput: SyncMoveShoppingListItemInput = {
    clientId: getClientId(mutation) as string,
    afterId: input.afterItemId,
    beforeId: input.beforeItemId,
  };
  return {
    syncMutation: SyncMoveShoppingListItemDocument,
    syncVariables: { input: syncInput },
  };
};
