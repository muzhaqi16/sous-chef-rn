import type { ApolloClient, Reference } from '@apollo/client';
import {
  MySavedRecipesDocument,
  type MySavedRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { errorService } from '#/services/errorService';

// The mutate result this helper classifies. Not generic: nothing here depends
// on the mutation's shape — classifyCreateResult reads the outcome structurally.
type UnfavoriteResult = { data?: unknown; error?: unknown };

interface OptimisticUnfavoriteArgs {
  client: ApolloClient;
  /** Recipe id whose saved edge is dropped and whose `savedDetails` is cleared. */
  recipeId: string;
  /** Fires the RemoveRecipeFromFavorites mutation (local-first, idempotent). */
  mutate: () => Promise<UnfavoriteResult>;
  /** `errorService` operation label for the throw path. */
  operation: string;
  /** Reports the failure to the user (alert or toast). Fires once, on rejection or throw. */
  reportFailure: () => void;
}

/**
 * Un-saves a recipe optimistically and consistently across call sites.
 *
 * Snapshots the `MySavedRecipes` query and the recipe's `savedDetails`, drops the
 * saved edge (and decrements `totalCount`) before firing the mutation so the removal
 * sticks even fully offline — the queued mutation replays idempotently. A resolved
 * rejection (`*Error` union member / transport error) or a throw reverts from the
 * snapshot and reports once; `'queued'` (offline / API down) keeps the removal.
 *
 * @returns `true` when the removal is kept (`'created'`/`'queued'`), `false` when reverted.
 */
export async function performOptimisticUnfavorite({
  client,
  recipeId,
  mutate,
  operation,
  reportFailure,
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

  const result = await executeMutation(mutate, (error: unknown) => {
    revert();
    errorService.reportError(error, { operation });
    reportFailure();
  });
  if (!result) return false; // threw -> already reverted in the fallback above

  // A resolved rejection (error union member / transport error) reverts;
  // 'queued' (offline / API down) keeps the optimistic removal — it replays.
  if (classifyCreateResult(result) === 'rejected') {
    revert();
    reportFailure();
    return false;
  }

  return true;
}
