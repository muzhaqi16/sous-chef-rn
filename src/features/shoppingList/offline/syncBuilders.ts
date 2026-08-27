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
 * How the offline queue replays a shopping-list write. The contract, and why
 * replay is split two ways at all, is in `#/apollo/offlineQueue/syncBuilder`.
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
 * Reads a ShoppingListItem's catalog reference from cache during queue
 * processing. `SyncShoppingListItemFieldsInput.item` is a required @oneOf ref, but
 * toggle/quantity/plain-update inputs carry only the row id — the replay
 * backfills the ref from the cached row. Kept separate from
 * {@link QUEUE_ITEM_DATA_FRAGMENT} and read with `returnPartialData` so a row
 * cached without the linked `item` entity still resolves its `itemName`.
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

/**
 * The sync input requires `shoppingListId`, but update/toggle/quantity mutation
 * variables only carry the item id.
 */
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

/**
 * The @oneOf catalog ref the sync input requires, which toggle/quantity/plain-
 * update variables do not carry. Prefers the linked catalog item id; falls back
 * to the row's free-text name (the server links-or-creates by name, matching
 * the original add).
 */
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
 * ShoppingListItem create/update sync. `SyncShoppingListItemInput =
 * { clientId, item: SyncShoppingListItemFieldsInput }`. `shoppingListId` is required on
 * the item — present on a create input, else read from cache. The specialized
 * single-item creates (barcode, add-from-filtered-pantry, add-from-pantry-item)
 * produce a ShoppingListItem from the same fields, so they sync through here too.
 */
const buildShoppingItemSync: SyncBuilder = (mutation, cache) => {
  const queued = getQueuedInput(mutation);
  // The single-add ops now send the batch AddItemsToShoppingListInput
  // ({ shoppingListId, items: [item] }); flatten the one item so the per-field
  // reads below resolve for both the batch-add ops and the flat
  // update/quantity/toggle inputs (which have no `items`).
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

  // UpdateShoppingListItem sends a `purchaseTracking` object; the toggle sends a
  // flat `purchased` boolean — normalize both so neither is dropped on replay.
  const purchaseTracking =
    input.purchaseTracking ??
    (input.purchased != null ? { isPurchased: input.purchased } : undefined);

  // `item` is a required @oneOf ItemRefInput (exactly one of itemId/itemName —
  // zero or both is rejected before any resolver runs). The add ops carry it
  // nested on the queued item; UpdateShoppingListItem carries a flat `itemName`
  // only when the user renamed; toggle/quantity/plain updates carry no ref at
  // all, so backfill it from the cached row. Flat `itemId` is deliberately NOT
  // used: on UpdateShoppingListItemQuantity it is the shopping-list ROW id, not
  // a catalog item id.
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
    // `quantity` is the FlexibleQuantity scalar (string | number, e.g. "1/3" or
    // 2) — pass it through directly; no unitId needed.
    ...(input.quantity != null && { quantity: input.quantity }),
    ...(purchaseTracking != null && {
      purchaseTracking:
        purchaseTracking as SyncShoppingListItemFieldsInput['purchaseTracking'],
    }),
    // priority / sortOrder ride on UpdateShoppingListItem — preserve on replay.
    ...(input.priority != null && { priority: input.priority }),
    ...(input.sortOrder != null && { sortOrder: input.sortOrder }),
    // Carried by the barcode add (and accepted by SyncShoppingListItemFieldsInput) so
    // replaying through sync doesn't drop them vs. the original mutation.
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

/**
 * The specialized single-item creates map onto the same builder as their
 * canonical counterparts because they produce the same entity from the same
 * input fields.
 */
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
