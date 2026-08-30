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
  getClientId,
  getQueuedInput,
  type QueuedInput,
  type SyncBuilder,
  type SyncBuilderTable,
} from '#/apollo/offlineQueue/syncBuilder';

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
  return itemData?.shoppingList?.id;
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

/**
 * ShoppingListItem create/update sync. `shoppingListId` is required on the item
 * — present on a create input, else read from cache. The specialized single-item
 * creates route here too: same entity from the same fields.
 */
const buildShoppingItemSync: SyncBuilder = (mutation, cache) => {
  const queued = getQueuedInput(mutation);
  // Single-add ops send the batch AddItemsToShoppingListInput; flatten its one
  // item so the reads below resolve for batch-add and flat update/quantity/
  // toggle inputs alike.
  const input: QueuedInput =
    Array.isArray(queued.items) && queued.items.length > 0
      ? { ...queued.items[0], shoppingListId: queued.shoppingListId }
      : queued;
  const clientId = getClientId(mutation, input);

  const shoppingListId =
    input.shoppingListId ?? readShoppingListId(cache, clientId);
  if (!shoppingListId) {
    throw new Error(
      `Cannot sync ${mutation.operationName}: shoppingListId not found for item ${clientId}`,
    );
  }

  // AddItem sends a `unit` UnitSpecInput; UpdateShoppingListItem(Quantity) sends
  // flat `unitId`/`unitName` — normalize both or the unit change is lost.
  const unit =
    input.unit ??
    (input.unitId != null || input.unitName != null
      ? {
          ...(input.unitId != null && { unitId: input.unitId }),
          ...(input.unitName != null && { unitName: input.unitName }),
        }
      : undefined);

  // Update sends a `purchaseTracking` object, the toggle a flat `purchased`.
  const purchaseTracking =
    input.purchaseTracking ??
    (input.purchased != null ? { isPurchased: input.purchased } : undefined);

  // Required @oneOf ItemRefInput: exactly one of itemId/itemName, zero or both
  // rejected pre-resolver. Flat `itemId` is deliberately NOT read — on
  // UpdateShoppingListItemQuantity it is the ROW id, not a catalog item id.
  const itemRef =
    (input.item as SyncShoppingListItemFieldsInput['item'] | undefined) ??
    (input.itemName != null ? { itemName: input.itemName } : undefined) ??
    readItemRef(cache, clientId);
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
    ...(unit && { unit: unit as SyncShoppingListItemFieldsInput['unit'] }),
    // FlexibleQuantity scalar (string | number, e.g. "1/3") — pass through.
    ...(input.quantity != null && { quantity: input.quantity }),
    ...(purchaseTracking != null && {
      purchaseTracking:
        purchaseTracking as SyncShoppingListItemFieldsInput['purchaseTracking'],
    }),
    ...(input.priority != null && { priority: input.priority }),
    ...(input.sortOrder != null && { sortOrder: input.sortOrder }),
    // Carried by the barcode add; replay must not drop them.
    ...(input.brand != null && {
      brand: input.brand as SyncShoppingListItemFieldsInput['brand'],
    }),
    ...(input.netWeight != null && {
      netWeight:
        input.netWeight as SyncShoppingListItemFieldsInput['netWeight'],
    }),
    ...(input.storePrefs != null && {
      storePrefs:
        input.storePrefs as SyncShoppingListItemFieldsInput['storePrefs'],
    }),
    ...(input.pricing != null && {
      pricing: input.pricing as SyncShoppingListItemFieldsInput['pricing'],
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

export const SHOPPING_LIST_SYNC_BUILDERS: SyncBuilderTable = {
  // create / update
  AddItemToShoppingList: buildShoppingItemSync,
  UpdateShoppingListItem: buildShoppingItemSync,
  UpdateShoppingListItemQuantity: buildShoppingItemSync,
  ToggleShoppingListItemPurchased: buildShoppingItemSync,
  BarcodeAddItemToShoppingList: buildShoppingItemSync,
  AddItemToShoppingListFromFilteredPantry: buildShoppingItemSync,
  AddItemToShoppingListFromPantryItem: buildShoppingItemSync,
  // delete / move
  RemoveItemFromShoppingList: buildDeleteShoppingItemSync,
  MoveShoppingListItem: buildMoveShoppingItemSync,
};
