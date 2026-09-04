/**
 * The item connection and its filtered variants. Apollo stores an ALIASED field
 * under its real name with serialized keyArgs
 * (`itemsConnection:{"isPurchased":true}`), not under the alias — so every update
 * targets `itemsConnection` and tells variants apart by `storeFieldName`.
 */

import { type ApolloCache } from '@apollo/client';
import {
  type ConnectionData,
  createRemoveFromParentConnectionUpdater,
  safeEvictMany,
} from '#/apollo/utils/cacheUpdaters';
import { logger } from '#/utils/environment';

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

/** Remove an item from EVERY `ShoppingList.itemsConnection` variant — deletion. */
export const removeFromShoppingListItemsConnection =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'itemsConnection',
    'ShoppingListItem',
  );

/** Clear every item of one purchase status from the cache in a single write. */
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
            if (isUnpurchasedConnection) return removeItemEdges();
            if (isPurchasedConnection) return addItemEdge();
          } else {
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

/** Move a row to purchased, rewiring the filtered `itemsConnection` variants. */
export function moveShoppingListItemToPurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, true);
}

/** Move a row to unpurchased, rewiring the filtered `itemsConnection` variants. */
export function moveShoppingListItemToUnpurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, false);
}

/**
 * Add an item to a shopping list's cache. The `isPurchased:true` variant REMOVES
 * the row (re-adding a purchased item); every other variant adds it. Pass
 * `bumpTotalItems: false` when a local-first
 * {@link addOptimisticShoppingListItem} has already counted it.
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
            // Re-adding a purchased row: drop it from the purchased variant.
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
 * Reconcile a local-first create from the mutation's `update`: adopt the server id
 * and re-wire the edge WITHOUT re-counting — the optimistic add already bumped
 * `totalItems`. `clientId` comes from the mutation's own `variables`, never a
 * shared ref, so overlapping adds stay correct.
 */
