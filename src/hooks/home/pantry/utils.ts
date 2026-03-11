/**
 * Shared utilities for pantry management hooks
 */

import type { ApolloCache, Reference } from '@apollo/client';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
  type CacheFieldHelpers,
} from '#/apollo/utils/cacheUpdaters';

// Cache updater utilities for pantry items
export const addToPantryItemsCache = createAddToParentConnectionUpdater(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

export const removeFromPantryItemsCache =
  createRemoveFromParentConnectionUpdater(
    'Pantry',
    'itemsConnection',
    'PantryItem',
  );

/**
 * Batch-add multiple pantry items to the cache in a single cache.modify() call.
 * Use this instead of calling addToPantryItemsCache N times during rapid-fire
 * mutations to avoid N separate watcher notifications and re-renders.
 */
export function batchAddToPantryItemsCache(
  cache: ApolloCache,
  pantryId: string,
  newItems: Array<{ id: string }>,
  options?: { updateStats?: boolean },
): void {
  const parentCacheId = cache.identify({ __typename: 'Pantry', id: pantryId });
  if (!parentCacheId || newItems.length === 0) return;

  cache.modify({
    id: parentCacheId,
    fields: {
      itemsConnection(
        existingConnection: any = {},
        { readField, toReference }: CacheFieldHelpers,
      ) {
        const existingEdges: ReadonlyArray<{ node: Reference }> =
          existingConnection?.edges ?? [];
        const existingIds = new Set(
          existingEdges.map(edge => readField('id', edge.node)),
        );

        const newEdges = newItems
          .filter(item => !existingIds.has(item.id))
          .map(item => ({
            __typename: 'PantryItemEdge' as const,
            node: toReference(item, true),
            cursor: '',
          }))
          .filter(
            (edge): edge is typeof edge & { node: Reference } => !!edge.node,
          );

        if (newEdges.length === 0) return existingConnection;

        return {
          ...existingConnection,
          edges: [...newEdges, ...existingEdges],
          totalCount: (existingConnection?.totalCount ?? 0) + newEdges.length,
        };
      },
      ...(options?.updateStats && {
        stats(existingStats: Reference | { totalItems: number } | null) {
          if (!existingStats || '__ref' in existingStats) return existingStats;
          return {
            ...existingStats,
            totalItems: (existingStats.totalItems || 0) + newItems.length,
          };
        },
      }),
    },
  });
}
