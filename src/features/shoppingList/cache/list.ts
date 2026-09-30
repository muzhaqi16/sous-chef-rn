/**
 * The `ShoppingList` entity itself: the local list, its place in the overview
 * query's cache, and the reconcile that adopts the server id.
 */

import type { ApolloCache } from '@apollo/client';
import {
  List_EmptyItemsVariantFragmentDoc,
  List_RowFragmentDoc,
} from './list.generated';
import {
  NEUTRAL_LOCAL_SHOPPING_LIST,
  NEUTRAL_LOCAL_SHOPPING_LIST_BY_TYPE,
} from './shoppingListRowNeutral.generated';
import {
  type AddToConnectionOptions,
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  safeEvict,
  skipOtherHomeVariants,
} from '#/apollo/utils/cacheUpdaters';
import { isHeld, writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import { isRecord } from '#/utils/isRecord';
import { matchesFilter } from './connections';

/** What a list's row holds, as far as the cache knows it. */
export type ShoppingListSnapshot = Record<string, unknown> & {
  __typename: 'ShoppingList';
  id: string;
  homeId: string | null;
};

// The connection write identifies the row by `__typename`.
const addToShoppingListsQueryCache = createAddToQueryConnectionUpdater<{
  __typename: 'ShoppingList';
  id: string;
}>('shoppingLists', 'ShoppingList');

/**
 * A created list is never a template, so the `filters: { isTemplate: true }` variant
 * must not take it: that variant selects `templateName`, which an optimistic list
 * lacks, and one edge missing it makes the whole picker query read incomplete.
 */
const isTemplateListVariant = (storeFieldName: string) =>
  matchesFilter(storeFieldName, 'isTemplate', true);

/**
 * Adds a list to `Query.shoppingLists`: every cached variant except the
 * templates-only one and those scoped to another home.
 */
export const addShoppingListToQueryCache = (
  cache: ApolloCache,
  list: { __typename: 'ShoppingList'; id: string; homeId: string | null },
  options: AddToConnectionOptions = {},
): boolean => {
  const isOtherHome = skipOtherHomeVariants(list.homeId);
  return addToShoppingListsQueryCache(cache, list, {
    ...options,
    skipStoreField: storeFieldName =>
      isTemplateListVariant(storeFieldName) || isOtherHome(storeFieldName),
  });
};

const removeShoppingListFromQueryCache = createRemoveFromQueryConnectionUpdater(
  'shoppingLists',
  'ShoppingList',
);

/**
 * Write a list row — held data kept, the rest neutral — with both filtered
 * `itemsConnection` variants seeded empty, and link it into the overview. The
 * variants are what make it usable offline: a `cache.modify` never creates one.
 */
function writeListRow(cache: ApolloCache, row: ShoppingListSnapshot): void {
  writeLocalEntity(cache, {
    fragment: List_RowFragmentDoc,
    fragmentName: 'list_row',
    neutral: NEUTRAL_LOCAL_SHOPPING_LIST,
    neutralByType: NEUTRAL_LOCAL_SHOPPING_LIST_BY_TYPE,
    known: row,
  });
  for (const isPurchased of [false, true]) {
    cache.writeFragment({
      id: cache.identify({ __typename: 'ShoppingList', id: row.id }),
      fragment: List_EmptyItemsVariantFragmentDoc,
      variables: { isPurchased },
      data: {
        __typename: 'ShoppingList',
        id: row.id,
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
  addShoppingListToQueryCache(cache, row);
}

/**
 * Write the list a create makes, complete for every screen that reads one.
 * `id` is the client-minted cuid sent as `input.id`, so create and replay
 * converge on one row. The owner and the linked home are what the cache holds;
 * an owner it lacks comes from the auth identity, a home it lacks is left out.
 */
export function writeLocalShoppingList(
  cache: ApolloCache,
  id: string,
  input: { name: string; isDefault?: boolean | null; homeId?: string | null },
  owner: { id: string; email?: string | null; displayName?: string | null },
): void {
  const user = { __typename: 'User', id: owner.id };
  const homeId = input.homeId ?? null;
  const home = homeId ? { __typename: 'Home', id: homeId } : null;
  writeListRow(cache, {
    __typename: 'ShoppingList',
    id,
    // The server owns the version; its response carries the real one.
    version: 1,
    updatedAt: new Date().toISOString(),
    name: input.name,
    isDefault: input.isDefault ?? false,
    totalItems: 0,
    completedItems: 0,
    remainingItems: 0,
    completionRate: 0,
    homeId,
    home: home && isHeld(cache, home) ? home : null,
    ownerships: [
      {
        __typename: 'ShoppingListOwnership',
        // A placeholder: the server makes its own ownership row, and the first
        // write-through replaces this array.
        id: `${id}:owner`,
        userId: owner.id,
        user: isHeld(cache, user)
          ? user
          : {
              ...user,
              email: owner.email ?? null,
              displayName: owner.displayName ?? null,
              profile: null,
            },
      },
    ],
  });
}

/**
 * Remove a list entirely: `Query.shoppingLists` has no dangling-edge read filter
 * (unlike `itemsConnection`), so the edge is filtered and `totalCount` decremented
 * explicitly before the entity is evicted. Also the local-first list delete.
 */
export function removeShoppingListFromCache(
  cache: ApolloCache,
  listId: string,
): void {
  removeShoppingListFromQueryCache(cache, listId, { evictItem: false });
  safeEvict(cache, 'ShoppingList', listId);
}

/** Reverse {@link writeLocalShoppingList} when the create is rejected. */
export function revertOptimisticShoppingList(
  cache: ApolloCache,
  listId: string,
): void {
  removeShoppingListFromCache(cache, listId);
}

/**
 * Snapshot a list's row before a local-first delete, so a refusal can restore
 * it with {@link restoreShoppingList}. Null when the cache has no such list.
 */
export function readShoppingListSnapshot(
  cache: ApolloCache,
  listId: string,
): ShoppingListSnapshot | null {
  const row: unknown = cache.readFragment({
    id: cache.identify({ __typename: 'ShoppingList', id: listId }),
    fragment: List_RowFragmentDoc,
    fragmentName: 'list_row',
    returnPartialData: true,
  });
  if (!isRecord(row)) return null;
  const homeId = typeof row.homeId === 'string' ? row.homeId : null;
  return { ...row, __typename: 'ShoppingList', id: listId, homeId };
}

/** Put back a list whose delete the server refused. */
export function restoreShoppingList(
  cache: ApolloCache,
  snapshot: ShoppingListSnapshot,
): void {
  writeListRow(cache, snapshot);
}
