/**
 * The local-first lifecycle of one shopping list line: the optimistic entity, the
 * revert, and the reconcile that adopts the server id.
 */

import { gql, type ApolloCache } from '@apollo/client';
import {
  ShoppingListItemDisplayFragmentDoc,
  type ShoppingListItemDisplayFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { errorService } from '#/services/errorService';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { addNewItemToShoppingListCache } from './connections';

export interface OptimisticShoppingListItemFields {
  /**
   * Required, not optional: the offline queue reads it back to build a
   * toggle/quantity/update replay, and a row written without it fails permanently.
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
 * Build a complete optimistic `ShoppingListItem` for local-first creates. `id` is
 * the client-minted cuid (the row's PK), so the online create and the queued replay
 * converge on one row. The full display shape is mandatory offline — an incomplete
 * one makes a cell's `useFragment` report `complete: false` and blank the row.
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
      // Built whole rather than through `writePurchaseInfo`, which patches an
      // existing record. A just-created line has no prior purchase to preserve.
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo',
        isPurchased: false,
        // Present rather than omitted: the row reads it, and one absent field
        // makes the whole list read incomplete.
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

/** What a caller may change about a line's purchase record. */

export function reconcileShoppingItemCreateUpdate(
  cache: ApolloCache,
  listId: string,
  serverItem: { id: string },
  clientId: string | null | undefined,
): void {
  adoptServerShoppingListItemId(cache, serverItem.id, clientId);
  addNewItemToShoppingListCache(cache, listId, serverItem, false);
}

// Structural slices the builder below reads, kept loose so every
// add-to-shopping-list mutation document satisfies the shape.
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
 * The mutation `update` shared by every add-to-shopping-list entry point: guard the
 * payload, take the single created/merged row, adopt the server id, reconcile into
 * the list. List id from `listId`, else `variables.input.shoppingListId`.
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
 * Local-first optimistic add: writes the FULL display entity, the connection edge
 * and recomputed stats PERMANENTLY before the create fires, so it survives a
 * fully-offline create (the queue replays `SyncShoppingListItem(clientId = id)`).
 * `item.id` MUST be the client-minted cuid sent as `input.id`, or the replay dupes.
 */
export function addOptimisticShoppingListItem(
  cache: ApolloCache,
  listId: string,
  item: ShoppingListItemDisplayFragment,
): void {
  // 1. Full entity, so the bare-ref edge resolves with display fields offline.
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

  // 2. Snapshot completedItems BEFORE the add — a new row is unpurchased, so it
  //    is unchanged, and remaining/completion derive from it.
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
 * Reverse {@link addOptimisticShoppingListItem} on a rejected create. Evicting the
 * entity alone is NOT enough: the optimistic add also bumped `totalItems` /
 * `remainingItems` / `completionRate`, and the self-healing `itemsConnection` read
 * repairs only its own `totalCount`. That read drops the dangling edge.
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
 * Reconcile a local-first item create once the mutation resolves: `'rejected'`
 * discards the optimistic row, `'created'` / `'queued'` keep it — a queued create
 * replays later, keyed by the same `id`. Returns which happened, so the caller can
 * drive its own success / error UX.
 */
export function reconcileShoppingCreate(
  cache: ApolloCache,
  listId: string,
  optimisticId: string,
  result: { data?: unknown; error?: unknown } | null | undefined,
): 'kept' | 'reverted' {
  const outcome = classifyCreateResult(result);
  // The batch can resolve successfully while its single item fails
  // (`results[0].success === false` — a per-item validation error reported inside
  // the batch rather than as a top-level error member). Revert that too.
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
 * Catalog merge: when the server resolves the create to an EXISTING row, evict the
 * stale client cuid so its dangling edge is dropped by the self-healing read and
 * the server row stands. `clientId` comes off the mutation's own `variables`, never
 * a shared ref. A no-op when the server echoed the same id.
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
