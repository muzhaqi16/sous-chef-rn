/**
 * The `ShoppingList` entity itself: the optimistic list, its place in the overview
 * query's cache, and the reconcile that adopts the server id.
 */

import { gql, type ApolloCache } from '@apollo/client';
import { List_ListDetailFragmentDoc } from './list.generated';
import { NEUTRAL_SHOPPING_LIST_DETAIL } from './shoppingListDetailNeutral.generated';
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { errorService } from '#/services/errorService';
import {
  type AddToConnectionOptions,
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  safeEvict,
} from '#/apollo/utils/cacheUpdaters';
import { matchesFilter } from './connections';

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
  // Nullable per the schema: `User.email` resolves only for the caller's own
  // record. Populated here (the row is always the creator's), but the shape must
  // match what the server write-through carries or the entity type-mismatches.
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
 * A created list is never a template, so the `filters: { isTemplate: true }` variant
 * must not take it: that variant selects `templateName`, which an optimistic list
 * lacks, and one edge missing it makes the whole picker query read incomplete.
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
 * Build a complete optimistic `ShoppingList`. `id` is the client-minted cuid sent as
 * `input.id`, so create and replay converge on one row. Owner data comes from the
 * cached `User`; an incomplete copy falls back to the auth identity with a `null`
 * profile rather than clobbering cached fields. The home chip degrades to null.
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
 * Local-first optimistic add of the LIST: full entity, both empty filtered
 * `itemsConnection` variants and the overview edge, written PERMANENTLY before the
 * create fires. Seeding the variants is what makes it usable offline — a
 * `cache.modify` modifier never creates a missing variant. `isDefault` is server-resolved.
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
    fragment: List_ListDetailFragmentDoc,
    fragmentName: 'list_listDetail',
    data: {
      // Neutral base derived from the SDL (scripts/generate-optimistic-fillers.mjs)
      // so a field added to the fragment cannot be forgotten here — that omission
      // is invisible until the detail screen blanks offline.
      ...NEUTRAL_SHOPPING_LIST_DETAIL,
      id: list.id,
    },
  });

  // 4. Edge into the lists overview (every cached filter variant).
  addShoppingListToQueryCache(cache, list);
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

/** Reverse {@link addOptimisticShoppingList} when the create is rejected. */
export function revertOptimisticShoppingList(
  cache: ApolloCache,
  listId: string,
): void {
  removeShoppingListFromCache(cache, listId);
}

/**
 * Snapshot a list's display shape before a local-first delete so a rejection can
 * restore it via {@link addOptimisticShoppingList}. Null when the cache copy is
 * incomplete — the caller then relies on the next overview refetch.
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
 * Reconcile a local-first list create: the keep/revert rule of
 * {@link reconcileShoppingCreate} — `'rejected'` discards, `'created'`/`'queued'`
 * keep, a queued create replaying later keyed by the same `id`.
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
