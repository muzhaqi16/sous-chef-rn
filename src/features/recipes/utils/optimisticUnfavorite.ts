import type { ApolloClient, Reference } from '@apollo/client';
import {
  MySavedRecipesDocument,
  RemoveRecipeFromFavoritesDocument,
  type MySavedRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';

// The mutate result settled here. Not generic: nothing here reads the payload.
type UnfavoriteResult = { data?: unknown; error?: unknown };

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
 * Un-saves a recipe optimistically. Snapshots `MySavedRecipes` and the recipe's
 * `savedDetails`, then drops the edge before firing so the removal sticks
 * offline and replays idempotently. A failure reverts and is reported once; a
 * queued removal stands. Returns whether the removal was kept.
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

  const savedRecipesSnapshot = client.cache.readQuery<MySavedRecipesQuery>({
    query: MySavedRecipesDocument,
  });
  let savedDetailsSnapshot: Reference | null = null;

  client.cache.updateQuery<MySavedRecipesQuery>(
    { query: MySavedRecipesDocument },
    existing => {
      if (!existing?.me) return existing;
      return {
        ...existing,
        me: {
          ...existing.me,
          savedRecipesConnection: {
            ...existing.me.savedRecipesConnection,
            edges: existing.me.savedRecipesConnection.edges.filter(
              edge => edge.node.recipe.id !== recipeId,
            ),
            totalCount: Math.max(
              0,
              (existing.me.savedRecipesConnection.totalCount ?? 0) - 1,
            ),
          },
        },
      };
    },
  );
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
    if (savedRecipesSnapshot) {
      client.cache.writeQuery({
        query: MySavedRecipesDocument,
        data: savedRecipesSnapshot,
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
