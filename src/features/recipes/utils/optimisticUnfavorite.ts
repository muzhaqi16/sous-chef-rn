import type { ApolloClient, Reference } from '@apollo/client';
import type { ModifierDetails } from '@apollo/client/cache';
import { RemoveRecipeFromFavoritesDocument } from '#features/recipes/graphql/recipe.generated';
import { readViewerId } from '#features/recipes/cache/favorites';
import type { ConnectionData } from '#/apollo/utils/cacheUpdaters';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';

// The mutate result settled here. Not generic: nothing here reads the payload.
type UnfavoriteResult = { data?: unknown; error?: unknown };

/** The saved list as the cache stores it: `null` where the server said so. */
type StoredList = ConnectionData | null | undefined;

interface OptimisticUnfavoriteArgs {
  client: ApolloClient;
  /** Recipe id whose saved edge is dropped and whose `savedDetails` is cleared. */
  recipeId: string;
  /** Fires the RemoveRecipeFromFavorites mutation (local-first, idempotent). */
  mutate: () => Promise<UnfavoriteResult>;
  /** The caller's copy for a failure nothing more specific describes. */
  fallback: string;
  /** Shows the failure; an alert when absent. */
  present?: (failure: SettledFailure) => void;
}

/**
 * Un-saves a recipe optimistically. Snapshots the viewer's saved list and the
 * recipe's `savedDetails`, then drops the edge before firing so the removal
 * sticks offline and replays idempotently. A failure reverts and is reported
 * once; a queued removal stands. Returns whether the removal was kept.
 */
export async function performOptimisticUnfavorite({
  client,
  recipeId,
  mutate,
  fallback,
  present,
}: OptimisticUnfavoriteArgs): Promise<boolean> {
  const recipeCacheId = client.cache.identify({
    __typename: 'Recipe',
    id: recipeId,
  });

  const viewerId = readViewerId(client.cache);
  const viewerCacheId = viewerId
    ? client.cache.identify({ __typename: 'User', id: viewerId })
    : undefined;
  // Every cached variant of the list as it was, keyed by its store field.
  const listSnapshots = new Map<string, StoredList>();
  let savedDetailsSnapshot: Reference | null = null;

  if (viewerCacheId) {
    // A held total falls by one whether or not the recipe's edge is in a loaded
    // page: the server's count does. One never held stays absent, or the next
    // query selecting it would read a made-up count as a cache hit.
    client.cache.modify({
      id: viewerCacheId,
      fields: {
        savedRecipesConnection: (
          existing: StoredList,
          { readField, storeFieldName }: ModifierDetails,
        ) => {
          listSnapshots.set(storeFieldName, existing);
          if (!existing) return existing;
          const { totalCount } = existing;
          return {
            ...existing,
            edges: (existing.edges ?? []).filter(
              edge => readField('recipeId', edge.node) !== recipeId,
            ),
            ...(typeof totalCount === 'number' && {
              totalCount: Math.max(0, totalCount - 1),
            }),
          };
        },
      },
    });
  }
  if (recipeCacheId) {
    client.cache.modify<{ savedDetails: Reference | null }>({
      id: recipeCacheId,
      fields: {
        savedDetails(existing) {
          savedDetailsSnapshot = existing;
          return null;
        },
      },
    });
  }

  const revert = () => {
    if (viewerCacheId) {
      client.cache.modify({
        id: viewerCacheId,
        fields: {
          savedRecipesConnection: (
            existing: StoredList,
            { storeFieldName }: ModifierDetails,
          ) =>
            listSnapshots.has(storeFieldName)
              ? listSnapshots.get(storeFieldName)
              : existing,
        },
      });
    }
    if (recipeCacheId) {
      client.cache.modify<{ savedDetails: Reference | null }>({
        id: recipeCacheId,
        fields: { savedDetails: () => savedDetailsSnapshot },
      });
    }
  };

  const settled = await settleMutation(mutate, {
    document: RemoveRecipeFromFavoritesDocument,
    fallback,
    onFailed: revert,
    present: present ? 'none' : 'alert',
  });
  if (settled.failure && present) present(settled.failure);

  return settled.status !== 'failed';
}
