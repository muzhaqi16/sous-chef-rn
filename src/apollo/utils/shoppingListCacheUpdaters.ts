/**
 * Shopping List Cache Updaters
 *
 * Reusable cache update utilities for shopping list items.
 * Used by both mutations and subscriptions to ensure consistent cache updates
 * when items move between purchased/unpurchased states.
 *
 * Apollo stores aliased fields under the actual field name with serialized
 * keyArgs (e.g. `itemsConnection:{"isPurchased":true}`), NOT under the alias
 * name. All cache updates therefore target `itemsConnection` and use
 * `storeFieldName` to distinguish filtered variants.
 */

import { gql, type ApolloCache } from '@apollo/client';
import {
  ShoppingListItemDisplayFragmentDoc,
  type ShoppingListItemDisplayFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import { createOptimisticEntity } from './createOptimisticResponse';
import {
  type ConnectionData,
  createRemoveFromParentConnectionUpdater,
  safeEvict,
  safeEvictMany,
} from './cacheUpdaters';

export interface OptimisticShoppingListItemFields {
  itemName: string;
  quantity?: number | null;
  quantityInput?: string | null;
  unitName?: string | null;
  category?: string | null;
  itemId?: string | null;
  unitId?: string | null;
}

/**
 * Build a complete optimistic `ShoppingListItem` for local-first creates.
 *
 * `id` is the client-minted cuid (the row's real PK), baked straight into the
 * entity so the online create and the queued replay converge on one row. The
 * full display shape is mandatory offline, where no server response arrives to
 * materialize the row (an incomplete shape makes a list cell's `useFragment`
 * report `complete: false` and blank the row). Pass the result to
 * {@link addOptimisticShoppingListItem}.
 *
 * Lives here (a shared apollo util) rather than inside the shoppingList feature
 * so every add surface — including ones in other features (barcode,
 * pantry-detail, filtered-pantry) — can build the same entity without crossing
 * a feature boundary.
 */
export function createOptimisticShoppingListItem(
  id: string,
  fields: OptimisticShoppingListItemFields,
): ShoppingListItemDisplayFragment {
  return createOptimisticEntity<ShoppingListItemDisplayFragment>(
    'ShoppingListItem',
    id,
    {
      itemName: fields.itemName,
      quantity: fields.quantity ?? 1,
      quantityInput: fields.quantityInput ?? null,
      displayFormat: DisplayFormat.Auto,
      unitName: fields.unitName ?? null,
      category: fields.category ?? null,
      notes: null,
      sortOrder: '',
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo',
        isPurchased: false,
      },
      item: fields.itemId
        ? { __typename: 'Item', id: fields.itemId, imageUrl: null, images: [] }
        : null,
      unit: fields.unitId
        ? { __typename: 'Unit', id: fields.unitId, name: '', symbol: '' }
        : null,
    },
  );
}

/**
 * Minimal stats read used by {@link addOptimisticShoppingListItem} to recompute
 * `remainingItems` / `completionRate` after an optimistic add.
 */
const ShoppingListStatsForOptimisticAddFragment = gql`
  fragment _ShoppingListStatsForOptimisticAdd on ShoppingList {
    totalItems
    completedItems
    remainingItems
    completionRate
  }
`;

// =============================================================================
// storeFieldName filter detection
// =============================================================================

/**
 * Check whether an Apollo `storeFieldName` matches a specific filter value.
 *
 * Apollo serializes `keyArgs` into storeFieldName, e.g.:
 *   `itemsConnection:{"filters":{"isPurchased":true}}`
 *
 * This helper avoids brittle `.includes()` string matching by encoding the
 * expected JSON fragment consistently.
 *
 * @example
 * matchesFilter(storeFieldName, 'isPurchased', true)
 * matchesFilter(storeFieldName, 'isPurchased', false)
 */
export function matchesFilter(
  storeFieldName: string,
  key: string,
  value: boolean,
): boolean {
  return storeFieldName.includes(`${key}":${value}`);
}

/** Shorthand: does this storeFieldName target the purchased variant? */
export function isPurchasedVariant(storeFieldName: string): boolean {
  return matchesFilter(storeFieldName, 'isPurchased', true);
}

/** Shorthand: does this storeFieldName target the unpurchased variant? */
export function isUnpurchasedVariant(storeFieldName: string): boolean {
  return matchesFilter(storeFieldName, 'isPurchased', false);
}

/**
 * Remove item from ShoppingList.itemsConnection (all variants).
 * Correct for deletion — runs on every storeFieldName variant.
 */
export const removeFromShoppingListItemsConnection =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'itemsConnection',
    'ShoppingListItem',
  );

/**
 * Clear ALL items of a given purchase status from cache in a single atomic operation.
 * Used by "Clear All" buttons for instant UI feedback.
 *
 * @param cache - Apollo cache instance
 * @param listId - Shopping list ID
 * @param itemIds - Array of item IDs being cleared
 * @param isPurchased - Whether clearing purchased (true) or unpurchased (false) items
 */
function clearItemsFromCache(
  cache: ApolloCache,
  listId: string,
  itemIds: string[],
  isPurchased: boolean,
): void {
  const parentCacheId = cache.identify({
    __typename: 'ShoppingList',
    id: listId,
  });

  if (!parentCacheId) return;

  cache.modify({
    id: parentCacheId,
    fields: {
      itemsConnection(
        existing: ConnectionData | undefined,
        { storeFieldName },
      ) {
        if (
          !matchesFilter(storeFieldName, 'isPurchased', isPurchased) ||
          !existing
        )
          return existing;
        return {
          ...existing,
          edges: [],
          totalCount: 0,
        };
      },
      ...(isPurchased && {
        completedItems() {
          return 0;
        },
      }),
      totalItems(existing: number = 0) {
        return Math.max(0, existing - itemIds.length);
      },
    },
  });

  // Evict all deleted items from cache
  safeEvictMany(
    cache,
    itemIds.map(id => ({ typename: 'ShoppingListItem', id })),
  );
}

/** Clear ALL purchased items from cache. */
export function clearAllPurchasedItemsFromCache(
  cache: ApolloCache,
  listId: string,
  itemIds: string[],
): void {
  clearItemsFromCache(cache, listId, itemIds, true);
}

/** Clear ALL unpurchased items from cache. */
export function clearAllUnpurchasedItemsFromCache(
  cache: ApolloCache,
  listId: string,
  itemIds: string[],
): void {
  clearItemsFromCache(cache, listId, itemIds, false);
}

/**
 * Helper to update itemsConnection filtered variants when purchase status changes
 */
function updateItemsConnectionForPurchaseStatusChange(
  cache: ApolloCache,
  listId: string,
  itemId: string,
  movingToPurchased: boolean,
): void {
  try {
    const parentCacheId = cache.identify({
      __typename: 'ShoppingList',
      id: listId,
    });

    if (!parentCacheId) return;

    cache.modify({
      id: parentCacheId,
      fields: {
        itemsConnection(
          existing: ConnectionData | undefined,
          { readField, storeFieldName, toReference },
        ) {
          // Detect which filtered variant this is by checking storeFieldName
          const isUnpurchasedConnection = isUnpurchasedVariant(storeFieldName);
          const isPurchasedConnection = isPurchasedVariant(storeFieldName);

          if (!existing?.edges) return existing;

          const removeItemEdges = () => ({
            ...existing,
            edges: existing.edges!.filter(
              edge => readField<string>('id', edge?.node) !== itemId,
            ),
            totalCount: Math.max(0, (existing.totalCount || 0) - 1),
          });

          const addItemEdge = () => {
            const alreadyExists = existing.edges!.some(
              edge => readField<string>('id', edge?.node) === itemId,
            );
            if (alreadyExists) return existing;
            const node = toReference({
              __typename: 'ShoppingListItem',
              id: itemId,
            });
            if (!node) return existing;
            const newEdge = {
              __typename: 'ShoppingListItemEdge',
              cursor: itemId,
              node,
            };
            return {
              ...existing,
              edges: [newEdge, ...existing.edges!],
              totalCount: (existing.totalCount || 0) + 1,
            };
          };

          if (movingToPurchased) {
            // Moving to purchased: remove from unpurchased, add to purchased
            if (isUnpurchasedConnection) return removeItemEdges();
            if (isPurchasedConnection) return addItemEdge();
          } else {
            // Moving to unpurchased: remove from purchased, add to unpurchased
            if (isPurchasedConnection) return removeItemEdges();
            if (isUnpurchasedConnection) return addItemEdge();
          }

          return existing;
        },
        completedItems(existing: number = 0) {
          return movingToPurchased ? existing + 1 : Math.max(0, existing - 1);
        },
      },
    });
  } catch (error) {
    console.warn(
      'Failed to update itemsConnection for purchase status change:',
      error,
    );
  }
}

/**
 * Move a shopping list item to purchased state.
 * Updates itemsConnection filtered variants via storeFieldName detection.
 */
export function moveShoppingListItemToPurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, true);
}

/**
 * Move a shopping list item to unpurchased state.
 * Updates itemsConnection filtered variants via storeFieldName detection.
 */
export function moveShoppingListItemToUnpurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, false);
}

/**
 * Add a new item to shopping list cache.
 *
 * Uses storeFieldName detection to correctly update filtered itemsConnection variants:
 * - isPurchased:true variant → REMOVE the item (handles re-add of previously purchased item)
 * - All other variants (unfiltered, isPurchased:false) → ADD the item
 */
export function addNewItemToShoppingListCache(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  try {
    const parentCacheId = cache.identify({
      __typename: 'ShoppingList',
      id: listId,
    });
    if (!parentCacheId) return;

    cache.modify({
      id: parentCacheId,
      fields: {
        itemsConnection(
          existing: ConnectionData | undefined,
          { readField, storeFieldName, toReference },
        ) {
          if (!existing?.edges) return existing;

          if (isPurchasedVariant(storeFieldName)) {
            // REMOVE from purchased variant (handles re-add of previously purchased item)
            const hadItem = existing.edges.some(
              edge => readField<string>('id', edge?.node) === item.id,
            );
            if (!hadItem) return existing;
            return {
              ...existing,
              edges: existing.edges.filter(
                edge => readField<string>('id', edge?.node) !== item.id,
              ),
              totalCount: Math.max(0, (existing.totalCount || 0) - 1),
            };
          }

          // ADD to unfiltered and unpurchased variants
          const alreadyExists = existing.edges.some(
            edge => readField<string>('id', edge?.node) === item.id,
          );
          if (alreadyExists) return existing;

          const node = toReference(
            { __typename: 'ShoppingListItem', id: item.id },
            true,
          );
          if (!node) return existing;
          const newEdge = {
            __typename: 'ShoppingListItemEdge',
            cursor: item.id,
            node,
          };
          return {
            ...existing,
            edges: [newEdge, ...existing.edges],
            totalCount: (existing.totalCount || 0) + 1,
          };
        },
        totalItems(existing: number = 0) {
          return existing + 1;
        },
      },
    });
  } catch (error) {
    console.warn('Failed to update cache for new shopping list item:', error);
  }
}

/**
 * Local-first optimistic add: write a new ShoppingListItem to the cache
 * PERMANENTLY (full entity + connection edge + recomputed list stats) BEFORE the
 * create mutation fires, so it survives a fully-offline / API-down create (the
 * queue replays via `SyncShoppingListItem(clientId = id)`).
 *
 * Unlike {@link addNewItemToShoppingListCache} — which only wires a bare-ref
 * edge and relies on the mutation *response* to materialize the entity — this
 * `writeFragment`s the full display entity first. That step is mandatory
 * offline, where no response ever arrives to fill the entity's fields (without
 * it the row renders blank).
 *
 * `item.id` MUST be the client-minted cuid sent as `input.id`, so the online
 * create and the queued replay converge on the same row (no duplicate).
 */
export function addOptimisticShoppingListItem(
  cache: ApolloCache,
  listId: string,
  item: ShoppingListItemDisplayFragment,
): void {
  // 1. Write the full entity so the (bare-ref) edge resolves with display
  //    fields even fully offline.
  cache.writeFragment({
    id: cache.identify(item),
    fragment: ShoppingListItemDisplayFragmentDoc,
    fragmentName: 'ShoppingListItemDisplayFragment',
    data: item,
  });

  const parentCacheId = cache.identify({
    __typename: 'ShoppingList',
    id: listId,
  });

  // 2. Snapshot completedItems BEFORE the add (new items are unpurchased, so
  //    completedItems is unchanged; remaining/completion derive from it).
  const stats = parentCacheId
    ? cache.readFragment<{ completedItems: number }>({
        id: parentCacheId,
        fragment: ShoppingListStatsForOptimisticAddFragment,
        fragmentName: '_ShoppingListStatsForOptimisticAdd',
      })
    : null;
  const completed = stats?.completedItems ?? 0;

  // 3. Add the edge + bump totalItems.
  addNewItemToShoppingListCache(cache, listId, item);

  // 4. Recompute remaining / completion from the now-bumped total.
  if (!parentCacheId) return;
  cache.modify({
    id: parentCacheId,
    fields: {
      remainingItems(_existing: number, { readField }) {
        const total = readField<number>('totalItems') ?? 0;
        return Math.max(0, total - completed);
      },
      completionRate(_existing: number, { readField }) {
        const total = readField<number>('totalItems') ?? 0;
        return total > 0 ? completed / total : 0;
      },
    },
  });
}

/**
 * Reverse {@link addOptimisticShoppingListItem} when a local-first create is
 * rejected by the server (e.g. `ValidationError` / `ConflictError`).
 *
 * Evicting the entity alone is NOT a full revert: `addOptimisticShoppingListItem`
 * also bumped the `ShoppingList.totalItems` / `remainingItems` / `completionRate`
 * scalars, and the self-healing `itemsConnection` read only repairs the
 * connection's own `totalCount` — not those sibling scalars. So an evict-only
 * revert leaves the list header showing an inflated count until the next stats
 * refetch. This reverses the scalar bump too (the item was unpurchased, so
 * `completedItems` is unchanged). The dangling connection edge is dropped by the
 * self-healing read.
 */
export function revertOptimisticShoppingListItem(
  cache: ApolloCache,
  listId: string,
  clientId: string,
): void {
  safeEvict(cache, 'ShoppingListItem', clientId);

  const parentCacheId = cache.identify({
    __typename: 'ShoppingList',
    id: listId,
  });
  if (!parentCacheId) return;

  const stats = cache.readFragment<{
    totalItems: number;
    completedItems: number;
  }>({
    id: parentCacheId,
    fragment: ShoppingListStatsForOptimisticAddFragment,
    fragmentName: '_ShoppingListStatsForOptimisticAdd',
  });
  const newTotal = Math.max(0, (stats?.totalItems ?? 0) - 1);
  const completed = stats?.completedItems ?? 0;

  cache.modify({
    id: parentCacheId,
    fields: {
      totalItems: () => newTotal,
      remainingItems: () => Math.max(0, newTotal - completed),
      completionRate: () => (newTotal > 0 ? completed / newTotal : 0),
    },
  });
}

/**
 * Catalog-merge reconciliation: when the server merges a client-created item
 * into an existing catalog row, the returned id differs from the client cuid we
 * wrote optimistically. Evict the stale cuid entity so its (now-dangling)
 * connection edge is dropped by the self-healing read and the server row stands.
 *
 * `clientId` is read off the mutation's own `variables` at the call site (never a
 * shared ref), so this stays correct when adds overlap. A no-op when the server
 * echoed the same id (no merge).
 */
export function adoptServerShoppingListItemId(
  cache: ApolloCache,
  serverId: string,
  clientId: string | null | undefined,
): void {
  if (clientId && serverId !== clientId) {
    safeEvict(cache, 'ShoppingListItem', clientId);
  }
}

/**
 * Remove a single item from ShoppingList cache when moving to pantry.
 *
 * Unlike the generic `createRemoveFromParentConnectionUpdater`, this only
 * modifies the correct filtered variant (purchased or unpurchased) based on
 * the item's purchase status, preventing incorrect totalCount decrements
 * on the other tab.
 *
 * Also updates `completedItems` and `totalItems` counters on the ShoppingList.
 */
export function removeItemFromShoppingListForMoveToPantry(
  cache: ApolloCache,
  listId: string,
  itemId: string,
  wasPurchased: boolean,
): void {
  try {
    const parentCacheId = cache.identify({
      __typename: 'ShoppingList',
      id: listId,
    });

    if (!parentCacheId) return;

    cache.modify({
      id: parentCacheId,
      fields: {
        itemsConnection(
          existing: ConnectionData | undefined,
          { readField, storeFieldName },
        ) {
          if (
            !matchesFilter(storeFieldName, 'isPurchased', wasPurchased) ||
            !existing?.edges
          )
            return existing;

          return {
            ...existing,
            edges: existing.edges.filter(
              edge => readField<string>('id', edge?.node) !== itemId,
            ),
            totalCount: Math.max(0, (existing.totalCount || 0) - 1),
          };
        },
        ...(wasPurchased && {
          completedItems(existing: number = 0) {
            return Math.max(0, existing - 1);
          },
        }),
        totalItems(existing: number = 0) {
          return Math.max(0, existing - 1);
        },
      },
    });

    // Evict the item entity from cache
    safeEvict(cache, 'ShoppingListItem', itemId);
  } catch (error) {
    console.warn(
      'Failed to remove item from ShoppingList for move to pantry:',
      error,
    );
  }
}
