/**
 * Withdrawing a line to the pantry, and restoring it when that fails. Unlike the
 * generic remover these touch ONLY the matching purchased/unpurchased variant, so
 * the other tab's `totalCount` is left alone.
 */

import { gql, type ApolloCache } from '@apollo/client';
import { type ConnectionData, safeEvict } from '#/apollo/utils/cacheUpdaters';
import { logger } from '#/utils/environment';
import { matchesFilter } from './connections';

/**
 * What {@link restoreItemToShoppingListAfterMoveToPantry} needs at withdrawal time:
 * which list, and which filtered variant of its connection.
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
 * Remove one item when moving it to the pantry. Unlike the generic remover this
 * touches ONLY the matching purchased/unpurchased variant, so the other tab's
 * `totalCount` is not decremented, and it updates `completedItems`/`totalItems`.
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

    // The edge write first, recording whether it changed anything; the counters
    // follow from that. This helper runs TWICE for one online move (eager unlink,
    // then the update callback) and `edges.filter` is idempotent while `-1` is not.
    // Two passes because `cache.modify` visits fields in the STORE's order.
    let removed = false;

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

          const edges = existing.edges.filter(
            edge => readField<string>('id', edge?.node) !== itemId,
          );
          if (edges.length === existing.edges.length) return existing;

          removed = true;
          return {
            ...existing,
            edges,
            totalCount: Math.max(0, (existing.totalCount || 0) - 1),
          };
        },
      },
    });

    if (removed) {
      cache.modify({
        id: parentCacheId,
        fields: {
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
    }

    // Evicting is for the CONFIRMED move. The eager (pre-fire) call keeps the
    // entity, because a permanently-refused replay must put the row back and there
    // is no snapshot to rebuild it from.
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
 * Put a shopping row back after a move to the pantry is permanently refused —
 * without it the item is in neither list. Reads the list id and purchase state from
 * the still-cached entity rather than arguments: the withdrawal runs long after the
 * call site is gone. A no-op when the entity is gone.
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

    // Same two-pass shape as the remove: the counters follow the edge insert
    // rather than assuming it, since this runs from the withdrawal AND the revert.
    let restored = false;

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

          restored = true;
          return {
            ...existing,
            edges: [
              ...existing.edges,
              { __typename: 'ShoppingListItemEdge', cursor: itemId, node },
            ],
            totalCount: (existing.totalCount || 0) + 1,
          };
        },
      },
    });

    if (restored) {
      cache.modify({
        id: parentCacheId,
        fields: {
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
    }
  } catch (error) {
    logger.warn(
      'Failed to restore item to ShoppingList after refused move to pantry:',
      error,
    );
  }
}

/**
 * Display shape of the optimistic `ShoppingList`, mirroring what the overview query
 * `GetShoppingListsLite` selects per node so it reads complete from cache offline.
 */
