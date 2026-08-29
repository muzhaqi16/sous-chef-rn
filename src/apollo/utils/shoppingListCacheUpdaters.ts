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

import { gql, isReference, type ApolloCache } from '@apollo/client';
import {
  ShoppingListItemDisplayFragmentDoc,
  type ShoppingListItemDisplayFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import { ShoppingListCacheUpdaters_ListDetailFragmentDoc } from './shoppingListCacheUpdaters.generated';
import { NEUTRAL_SHOPPING_LIST_DETAIL } from './shoppingListDetailNeutral.generated';
import { createOptimisticEntity } from './createOptimisticResponse';
import { classifyCreateResult } from './classifyCreateResult';
import { errorService } from '#/services/errorService';
import {
  type AddToConnectionOptions,
  type ConnectionData,
  createAddToQueryConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  safeEvict,
  safeEvictMany,
} from './cacheUpdaters';
import { logger } from '#/utils/environment';

export interface OptimisticShoppingListItemFields {
  /**
   * The list this row belongs to. Required, not optional: it is what the
   * offline queue reads back to build a toggle/quantity/update replay, and a
   * row written without it makes that replay fail permanently — so the type
   * forces every caller to supply it rather than letting one forget.
   */
  shoppingListId: string;
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
      shoppingList: {
        __typename: 'ShoppingList',
        id: fields.shoppingListId,
      },
      itemName: fields.itemName,
      quantity: fields.quantity ?? 1,
      quantityInput: fields.quantityInput ?? null,
      displayFormat: DisplayFormat.Auto,
      unitName: fields.unitName ?? null,
      category: fields.category ?? null,
      notes: null,
      sortOrder: '',
      // Builds the record whole rather than going through `writePurchaseInfo`,
      // which patches an existing one. A line that was just created has no
      // prior purchase to preserve and no flag to flip.
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo',
        isPurchased: false,
        // A line that was just created has not been purchased, so it cannot
        // have reached the pantry. Present rather than omitted because the row
        // reads it, and one absent field makes the whole list read incomplete.
        movedToPantryAt: null,
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
/** What a caller may change about a line's purchase record. */
export interface PurchaseInfoPatch {
  isPurchased?: boolean;
  movedToPantryAt?: string | null;
}

/**
 * The stamp a cached line already carries, or null.
 *
 * The counterpart to the writer above, here for the same reason: a caller
 * deciding whether to stamp a line has to know whether it is already stamped,
 * and reaching into the record from outside this module is how the two drift.
 */
export function readMovedToPantryAt(
  cache: ApolloCache,
  itemId: string,
): string | null {
  const cacheId = cache.identify({
    __typename: 'ShoppingListItem',
    id: itemId,
  });
  if (!cacheId) return null;
  return (
    cache.readFragment<{ purchaseInfo?: { movedToPantryAt?: string | null } }>({
      id: cacheId,
      fragment: gql`
        fragment _MovedToPantryAt on ShoppingListItem {
          purchaseInfo {
            movedToPantryAt
          }
        }
      `,
      fragmentName: '_MovedToPantryAt',
    })?.purchaseInfo?.movedToPantryAt ?? null
  );
}

/**
 * The only writer of `ShoppingListItem.purchaseInfo`.
 *
 * The record has two properties no call site should have to remember.
 *
 * Its type policy CLEARS every field a write omits whenever `isPurchased`
 * changes — deliberately, because inheriting a previous purchase's amounts
 * beside a new flag once showed a collaborator's name and price on someone
 * else's purchase. A write that asserts a flag it does not own can therefore
 * destroy the record: asserting `isPurchased: true` over a cached `false`
 * cleared the quantity, price, date and purchaser.
 *
 * And `movedToPantryAt` is derived from the flag: the server clears the stamp
 * on exactly the transition that ends a purchase cycle, so a local write that
 * flips the flag must clear it too. Otherwise a re-purchased line keeps a stamp
 * saying it is already stocked, and its row withholds the move-to-pantry action
 * for a line the bulk move will act on.
 *
 * Both rules live here so a sixth writer cannot drift from them. Callers say
 * what they are changing; they do not restate the rules.
 */
export function writePurchaseInfo(
  cache: ApolloCache,
  itemId: string,
  patch: PurchaseInfoPatch,
  options: { updatedAt?: string } = {},
): void {
  const cacheId = cache.identify({
    __typename: 'ShoppingListItem',
    id: itemId,
  });
  if (!cacheId) return;

  cache.modify<{
    purchaseInfo: {
      isPurchased?: boolean;
      movedToPantryAt?: string | null;
    };
    updatedAt: string;
  }>({
    id: cacheId,
    fields: {
      purchaseInfo(existing) {
        // A value object with no key fields is never stored as a reference, but
        // the modifier's type admits one and spreading it would write `__ref`
        // over the record. Same guard the type policy uses.
        if (isReference(existing)) return existing;

        const wasPurchased = existing?.isPurchased ?? false;
        // Only a caller that names the flag may change it. Everything else
        // leaves it exactly as cached, which is what keeps the type policy on
        // its non-clearing path.
        const nextPurchased = patch.isPurchased ?? wasPurchased;
        const flipped = nextPurchased !== wasPurchased;

        let stamp: string | null;
        if (flipped) {
          stamp = null;
        } else if (patch.movedToPantryAt !== undefined) {
          stamp = patch.movedToPantryAt;
        } else {
          stamp = existing?.movedToPantryAt ?? null;
        }

        return {
          ...existing,
          isPurchased: nextPurchased,
          movedToPantryAt: stamp,
        };
      },
      ...(options.updatedAt === undefined
        ? {}
        : { updatedAt: () => options.updatedAt }),
    },
  });
}

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

    // readField sees pre-modify values, so all three stat modifiers below derive
    // the new completedItems from the same baseline regardless of run order.
    const nextCompleted = (current: number) =>
      movingToPurchased ? current + 1 : Math.max(0, current - 1);

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
          return nextCompleted(existing);
        },
        // Keep the derived stats in sync with the new completedItems so the
        // progress header doesn't go stale until the next refetch.
        remainingItems(_existing: number, { readField }) {
          const total = readField<number>('totalItems') ?? 0;
          const completed = readField<number>('completedItems') ?? 0;
          return Math.max(0, total - nextCompleted(completed));
        },
        completionRate(_existing: number, { readField }) {
          const total = readField<number>('totalItems') ?? 0;
          const completed = readField<number>('completedItems') ?? 0;
          return total > 0 ? nextCompleted(completed) / total : 0;
        },
      },
    });
  } catch (error) {
    logger.warn(
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
 *
 * Pass `bumpTotalItems: false` when running after a local-first
 * {@link addOptimisticShoppingListItem} already counted the item — see
 * {@link reconcileShoppingItemCreateUpdate}.
 */
export function addNewItemToShoppingListCache(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
  bumpTotalItems = true,
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
        ...(bumpTotalItems && {
          totalItems(existing: number = 0) {
            return existing + 1;
          },
        }),
      },
    });
  } catch (error) {
    logger.warn('Failed to update cache for new shopping list item:', error);
  }
}

/**
 * Reconcile a local-first item create's server response from the mutation's
 * `update` callback: adopt the server id (evicting the optimistic cuid on a
 * catalog-merge) and re-wire the edge without re-counting — the optimistic add
 * already bumped `totalItems`. Pass `clientId` from the mutation's own
 * `variables` (never a shared ref) so it stays correct when adds overlap.
 */
export function reconcileShoppingItemCreateUpdate(
  cache: ApolloCache,
  listId: string,
  serverItem: { id: string },
  clientId: string | null | undefined,
): void {
  adoptServerShoppingListItemId(cache, serverItem.id, clientId);
  addNewItemToShoppingListCache(cache, listId, serverItem, false);
}

// Structural slices of the add-items mutation result/variables the builder
// below reads. Kept loose so every add-to-shopping-list mutation document
// (plain, from-pantry-item, from-filtered-pantry) satisfies the shape.
interface AddItemsReconcilePayloadLike {
  __typename?: string;
  results?: readonly ({ item?: { id: string } | null } | null)[] | null;
}

interface AddItemsReconcileDataLike {
  addItemsToShoppingList?: AddItemsReconcilePayloadLike | null;
}

interface AddItemsReconcileVariablesLike {
  input: {
    items?: readonly ({ id?: string | null } | null)[] | null;
    shoppingListId?: string | null;
  };
}

interface BuildAddItemsReconcileUpdateOptions {
  /** Target list id; when omitted, read from `variables.input.shoppingListId`. */
  listId?: string | null;
  /**
   * When set, run the reconcile inside a try/catch reporting this failure
   * message and optional refetch fallback. Omit to apply the reconcile directly.
   */
  wrap?: { message: string; refetch?: () => void };
}

/**
 * Builds the mutation `update` callback shared by every add-to-shopping-list
 * entry point: guard the `AddItemsToShoppingListPayload`, take the single
 * created/merged row, adopt the server id over the client id, and reconcile it
 * into the target list's cache. The list id comes from `listId` when supplied,
 * otherwise from the mutation's own `variables.input.shoppingListId`.
 */
export function buildAddItemsReconcileUpdate({
  listId,
  wrap,
}: BuildAddItemsReconcileUpdateOptions) {
  return (
    cache: ApolloCache,
    { data }: { data?: AddItemsReconcileDataLike | null },
    { variables }: { variables?: AddItemsReconcileVariablesLike },
  ): void => {
    const payload = data?.addItemsToShoppingList;
    const targetListId = listId ?? variables?.input.shoppingListId;
    if (
      payload?.__typename !== 'AddItemsToShoppingListPayload' ||
      !targetListId ||
      !variables
    ) {
      return;
    }
    // Single add via the batch mutation — the created/merged row is the one
    // entry in `results`. Null when that item failed.
    const item = payload.results?.[0]?.item;
    if (!item) return;
    const clientId = variables.input.items?.[0]?.id;
    const run = () =>
      reconcileShoppingItemCreateUpdate(cache, targetListId, item, clientId);
    if (wrap) {
      try {
        run();
      } catch (cacheError) {
        errorService.reportError(cacheError, { operation: wrap.message });
        wrap.refetch?.();
      }
    } else {
      run();
    }
  };
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
 * Reconcile a local-first shopping-list create after its mutation resolves.
 *
 * Every shopping add surface writes the item to the cache before firing and
 * shares one keep/revert rule: a `'rejected'` result (a real error, or a
 * non-success payload such as ConflictError/ValidationError) discards the
 * optimistic item; `'created'` / `'queued'` keep it — a queued create replays
 * later, keyed by the same `id`. Centralizing the payload key, success typename,
 * and the stat-aware revert here keeps them in one place so they can't drift
 * across the many add sites. Returns whether the optimistic item was kept or
 * reverted so the caller can drive its own success / error UX.
 */
export function reconcileShoppingCreate(
  cache: ApolloCache,
  listId: string,
  optimisticId: string,
  result: { data?: unknown; error?: unknown } | null | undefined,
): 'kept' | 'reverted' {
  const outcome = classifyCreateResult(result);
  // Each add fires the batch mutation with a single item. The batch can resolve
  // successfully while that one item fails (`results[0].success === false`, e.g.
  // a per-item validation error reported inside the batch rather than as a
  // top-level error member). Revert the optimistic row in that case too.
  const payload = (
    result as
      | {
          data?: {
            addItemsToShoppingList?: {
              __typename?: string;
              results?: Array<{ success: boolean }>;
            };
          };
        }
      | null
      | undefined
  )?.data?.addItemsToShoppingList;
  const itemFailed =
    payload?.__typename === 'AddItemsToShoppingListPayload' &&
    payload.results?.[0]?.success === false;
  if (outcome === 'rejected' || itemFailed) {
    try {
      revertOptimisticShoppingListItem(cache, listId, optimisticId);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Revert rejected Shopping List Item',
      });
    }
    return 'reverted';
  }
  return 'kept';
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
 * The row's own record of where it belongs, read at withdrawal time by
 * {@link restoreItemToShoppingListAfterMoveToPantry}. Selects only what the
 * restore needs — which list, and which filtered variant of its connection.
 */
const RESTORE_MOVED_ITEM_FRAGMENT = gql`
  fragment RestoreMovedShoppingListItem on ShoppingListItem {
    id
    purchaseInfo {
      isPurchased
    }
    shoppingList {
      id
    }
  }
`;

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
  options: { evictEntity?: boolean } = {},
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

    // Evicting is for the CONFIRMED move: once the server has the row, the
    // local entity is dead weight. The eager (pre-fire) call keeps it, because
    // a permanently-refused replay has to put the row back and there is no
    // snapshot to rebuild it from — see
    // {@link restoreItemToShoppingListAfterMoveToPantry}.
    if (options.evictEntity !== false) {
      safeEvict(cache, 'ShoppingListItem', itemId);
    }
  } catch (error) {
    logger.warn(
      'Failed to remove item from ShoppingList for move to pantry:',
      error,
    );
  }
}

/**
 * Put a shopping row back after a move to the pantry was permanently refused.
 *
 * The mirror of {@link removeItemFromShoppingListForMoveToPantry}'s non-evicting
 * form. The row is unlinked from its list connection before the mutation fires,
 * so the move is visible with no network; if the queue then gives up on the
 * write, the pantry side is withdrawn by the generic evict and this restores the
 * shopping side. Without it the item would be in neither list — observed on
 * device on a move that timed out, retried, and came back NotFound.
 *
 * Reads the list id and purchase state from the still-cached entity rather than
 * taking them as arguments: the withdrawal runs long after the call site is
 * gone, and the entity is the only surviving record of where the row belongs.
 * A no-op when the entity is gone (already evicted, or never written).
 */
export function restoreItemToShoppingListAfterMoveToPantry(
  cache: ApolloCache,
  itemId: string,
): void {
  try {
    const itemCacheId = cache.identify({
      __typename: 'ShoppingListItem',
      id: itemId,
    });
    if (!itemCacheId) return;

    const row = cache.readFragment<{
      id: string;
      purchaseInfo: { isPurchased: boolean } | null;
      shoppingList: { id: string } | null;
    }>({
      id: itemCacheId,
      fragment: RESTORE_MOVED_ITEM_FRAGMENT,
    });

    const listId = row?.shoppingList?.id;
    if (!row || !listId) return;

    const wasPurchased = Boolean(row.purchaseInfo?.isPurchased);
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
          if (
            !matchesFilter(storeFieldName, 'isPurchased', wasPurchased) ||
            !existing?.edges
          )
            return existing;

          // Idempotent: a withdrawal that runs twice must not duplicate the row.
          const alreadyThere = existing.edges.some(
            edge => readField<string>('id', edge?.node) === itemId,
          );
          if (alreadyThere) return existing;

          const node = toReference({
            __typename: 'ShoppingListItem',
            id: itemId,
          });
          if (!node) return existing;

          return {
            ...existing,
            edges: [
              ...existing.edges,
              { __typename: 'ShoppingListItemEdge', cursor: itemId, node },
            ],
            totalCount: (existing.totalCount || 0) + 1,
          };
        },
        ...(wasPurchased && {
          completedItems(existing: number = 0) {
            return existing + 1;
          },
        }),
        totalItems(existing: number = 0) {
          return existing + 1;
        },
      },
    });
  } catch (error) {
    logger.warn(
      'Failed to restore item to ShoppingList after refused move to pantry:',
      error,
    );
  }
}

// =============================================================================
// Shopping list local-first create (the list itself, not its items)
// =============================================================================

/**
 * Display shape of the optimistic `ShoppingList` entity written by
 * {@link addOptimisticShoppingList}. Mirrors what the lists-overview query
 * (`GetShoppingListsLite`) selects per node, so the overview reads complete
 * from cache while fully offline.
 */
export type OptimisticShoppingList = {
  __typename: 'ShoppingList';
  id: string;
  version: number;
  updatedAt: string;
  name: string;
  isDefault: boolean;
  totalItems: number;
  completedItems: number;
  remainingItems: number;
  completionRate: number;
  homeId: string | null;
  home: { __typename: 'Home'; id: string; name: string } | null;
  ownerships: Array<{
    __typename: 'ShoppingListOwnership';
    id: string;
    userId: string;
    user: OptimisticShoppingListUser;
  }>;
};

type OptimisticShoppingListUser = {
  __typename: 'User';
  id: string;
  // Nullable per the schema: `User.email` only resolves for the caller's own
  // record. The optimistic row is always the creator's, so it is populated
  // here, but the cache shape has to match what the server write-through
  // carries or the entity would be overwritten with a type mismatch.
  email: string | null;
  profile: {
    __typename: 'UserProfile';
    id: string;
    displayName: string | null;
    avatar: string | null;
  } | null;
};

/** Entity write shape for {@link addOptimisticShoppingList}. */
const OptimisticShoppingListFragment = gql`
  fragment _OptimisticShoppingList on ShoppingList {
    id
    name
    isDefault
    totalItems
    completedItems
    remainingItems
    completionRate
    homeId
    version
    updatedAt
    home {
      id
      name
    }
    ownerships {
      id
      userId
      user {
        id
        email
        profile {
          id
          displayName
          avatar
        }
      }
    }
  }
`;

/** Owner display data read from the cache's canonical `User` entity. */
const OptimisticListOwnerUserFragment = gql`
  fragment _OptimisticListOwnerUser on User {
    id
    email
    profile {
      id
      displayName
      avatar
    }
  }
`;

/** Linked-home name read for the overview card's home chip. */
const OptimisticListHomeFragment = gql`
  fragment _OptimisticListHome on Home {
    id
    name
  }
`;

/**
 * One filtered `itemsConnection` variant, addressed by the same
 * `filters: { isPurchased }` keyArgs the items screen queries with.
 */
const ShoppingListEmptyItemsVariantFragment = gql`
  fragment _ShoppingListEmptyItemsVariant on ShoppingList {
    itemsConnection(filters: { isPurchased: $isPurchased }) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
      }
    }
  }
`;

const addToShoppingListsQueryCache = createAddToQueryConnectionUpdater(
  'shoppingLists',
  'ShoppingList',
);

/**
 * A list arriving through any create path is never a template, so the
 * `filters: { isTemplate: true }` variant GetShoppingListTemplates reads is the
 * one place it must not land. Beyond showing a plain list in the template
 * picker, that variant selects `templateName` — a field an optimistic list
 * doesn't carry — and one edge missing it makes the whole query read
 * incomplete, blanking the picker until the next network response.
 */
const isTemplateListVariant = (storeFieldName: string) =>
  matchesFilter(storeFieldName, 'isTemplate', true);

/**
 * Adds a list to `Query.shoppingLists` (every cached filter variant except the
 * templates-only one).
 */
export const addShoppingListToQueryCache = (
  cache: ApolloCache,
  list: { id: string },
  options: AddToConnectionOptions = {},
): boolean =>
  addToShoppingListsQueryCache(cache, list, {
    ...options,
    skipStoreField: isTemplateListVariant,
  });

const removeShoppingListFromQueryCache = createRemoveFromQueryConnectionUpdater(
  'shoppingLists',
  'ShoppingList',
);

/**
 * Build a complete optimistic `ShoppingList` for a local-first create.
 *
 * `id` is the client-minted cuid sent as `input.id` — the row's permanent PK —
 * so the online create and the queued offline replay converge on one row.
 * Owner display data (avatar, display name) comes from the cache's canonical
 * `User` entity; when that copy is incomplete, falls back to the auth-store
 * identity with a `null` profile rather than risk clobbering cached profile
 * fields with stubs — the post-replay refetch heals the gap. The home chip is
 * resolved the same way and degrades to `null` when the `Home` entity isn't
 * cached.
 */
export function buildOptimisticShoppingList(
  cache: ApolloCache,
  id: string,
  input: { name: string; isDefault?: boolean | null; homeId?: string | null },
  owner: { id: string; email?: string | null },
): OptimisticShoppingList {
  const userCacheId = cache.identify({ __typename: 'User', id: owner.id });
  const cachedUser = userCacheId
    ? cache.readFragment<OptimisticShoppingListUser>({
        id: userCacheId,
        fragment: OptimisticListOwnerUserFragment,
        fragmentName: '_OptimisticListOwnerUser',
      })
    : null;
  const user: OptimisticShoppingListUser = cachedUser ?? {
    __typename: 'User',
    id: owner.id,
    email: owner.email ?? null,
    profile: null,
  };

  const homeId = input.homeId ?? null;
  const homeCacheId = homeId
    ? cache.identify({ __typename: 'Home', id: homeId })
    : undefined;
  const home = homeCacheId
    ? cache.readFragment<{ __typename: 'Home'; id: string; name: string }>({
        id: homeCacheId,
        fragment: OptimisticListHomeFragment,
        fragmentName: '_OptimisticListHome',
      })
    : null;

  return createOptimisticEntity<OptimisticShoppingList>('ShoppingList', id, {
    name: input.name,
    isDefault: input.isDefault ?? false,
    totalItems: 0,
    completedItems: 0,
    remainingItems: 0,
    completionRate: 0,
    homeId,
    home,
    ownerships: [
      {
        __typename: 'ShoppingListOwnership',
        // Client-only placeholder row: the server creates its own ownership
        // row, and the first write-through replaces this array (the orphaned
        // entity is gc'd later).
        id: `${id}:owner`,
        userId: owner.id,
        user,
      },
    ],
  });
}

/**
 * Local-first optimistic add: write a new ShoppingList to the cache
 * PERMANENTLY (full entity + overview connection edge + empty filtered
 * `itemsConnection` variants) BEFORE the create mutation fires, so it survives
 * a fully-offline / API-down create. The queue replays the original
 * `CreateShoppingList` keyed by `input.id`; a duplicate replay surfaces as a
 * ConflictError, which the queue drops — the first attempt's row stands.
 *
 * Seeding both `filters: { isPurchased }` variants empty is what makes the
 * fresh list immediately usable offline: the items screen reads complete from
 * cache, and local-first item adds have an existing variant for their
 * `cache.modify` edge writes (a modifier never creates a missing variant).
 *
 * Caveat: `isDefault: true` doesn't clear the flag on other cached lists; the
 * server resolves the single-default rule on replay and the next refetch
 * reconciles the flags.
 */
export function addOptimisticShoppingList(
  cache: ApolloCache,
  list: OptimisticShoppingList,
): void {
  // 1. Full entity write — mandatory offline, where no response ever arrives
  //    to materialize the row.
  cache.writeFragment({
    id: cache.identify(list),
    fragment: OptimisticShoppingListFragment,
    fragmentName: '_OptimisticShoppingList',
    data: list,
  });

  // 2. Seed both filtered itemsConnection variants as authoritatively empty.
  for (const isPurchased of [false, true]) {
    cache.writeFragment({
      id: cache.identify(list),
      fragment: ShoppingListEmptyItemsVariantFragment,
      fragmentName: '_ShoppingListEmptyItemsVariant',
      variables: { isPurchased },
      data: {
        itemsConnection: {
          __typename: 'ShoppingListItemConnection',
          totalCount: 0,
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
          edges: [],
        },
      },
    });
  }

  // 3. Detail-shape the same entity so opening the list offline renders from
  //    cache instead of a wire read the server cannot answer yet.
  cache.writeFragment({
    id: cache.identify(list),
    fragment: ShoppingListCacheUpdaters_ListDetailFragmentDoc,
    fragmentName: 'shoppingListCacheUpdaters_listDetail',
    data: {
      // Neutral base derived from the SDL (see
      // scripts/generate-optimistic-fillers.mjs) so a field added to the
      // fragment cannot be forgotten here — that omission is invisible until
      // the detail screen blanks offline. A brand-new list is neutral in every
      // one of these: no template, no recurrence, no reminder, nothing spent,
      // no collaborators, and nothing to move to a pantry until it has items.
      ...NEUTRAL_SHOPPING_LIST_DETAIL,
      id: list.id,
    },
  });

  // 4. Edge into the lists overview (every cached filter variant).
  addShoppingListToQueryCache(cache, list);
}

/**
 * Remove a list from the cache entirely: the overview connection edge is
 * filtered + `totalCount` decremented explicitly (`Query.shoppingLists` has no
 * dangling-edge read filter, unlike `itemsConnection`'s self-healing read),
 * then the entity is evicted. Used both to revert a rejected optimistic create
 * and as the local-first removal for a list delete.
 */
export function removeShoppingListFromCache(
  cache: ApolloCache,
  listId: string,
): void {
  removeShoppingListFromQueryCache(cache, listId, { evictItem: false });
  safeEvict(cache, 'ShoppingList', listId);
}

/** Reverse {@link addOptimisticShoppingList} when the create is rejected. */
export function revertOptimisticShoppingList(
  cache: ApolloCache,
  listId: string,
): void {
  removeShoppingListFromCache(cache, listId);
}

/**
 * Snapshot a list's display shape before a local-first delete, so a server
 * rejection can restore it via {@link addOptimisticShoppingList} (items
 * repopulate on the next visit's refetch). Null when the cache copy is
 * incomplete — the caller then relies on the next overview refetch instead.
 */
export function readShoppingListSnapshot(
  cache: ApolloCache,
  listId: string,
): OptimisticShoppingList | null {
  const cacheId = cache.identify({ __typename: 'ShoppingList', id: listId });
  if (!cacheId) return null;
  return cache.readFragment<OptimisticShoppingList>({
    id: cacheId,
    fragment: OptimisticShoppingListFragment,
    fragmentName: '_OptimisticShoppingList',
  });
}

/**
 * Reconcile a local-first list create after its mutation resolves. Same
 * keep/revert rule as {@link reconcileShoppingCreate}: a `'rejected'` result
 * (a surfaced error, or a non-success payload such as
 * ConflictError/ValidationError) discards the optimistic list; `'created'` /
 * `'queued'` keep it — a queued create replays later, keyed by the same `id`.
 */
export function reconcileShoppingListCreate(
  cache: ApolloCache,
  optimisticId: string,
  result: { data?: unknown; error?: unknown } | null | undefined,
): 'kept' | 'reverted' {
  const outcome = classifyCreateResult(result);
  if (outcome === 'rejected') {
    try {
      revertOptimisticShoppingList(cache, optimisticId);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Revert rejected Shopping List',
      });
    }
    return 'reverted';
  }
  return 'kept';
}
