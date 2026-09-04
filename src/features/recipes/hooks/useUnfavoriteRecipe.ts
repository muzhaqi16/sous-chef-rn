import { useApolloClient, useMutation } from '@apollo/client/react';
import { RemoveRecipeFromFavoritesDocument } from '#features/recipes/graphql/recipe.generated';
import { performOptimisticUnfavorite } from '#features/recipes/utils/optimisticUnfavorite';

/**
 * Un-save a recipe. The saved edge is dropped and `Recipe.savedDetails` cleared
 * BEFORE the mutation fires, so the removal sticks fully offline and the queue
 * replays the idempotent unfavorite. A rejection reverts from the snapshot, so
 * there is no `update` callback.
 */
export function useUnfavoriteRecipe(operation: string) {
  const client = useApolloClient();
  const [unfavoriteRecipeMutation] = useMutation(
    RemoveRecipeFromFavoritesDocument,
  );

  /** True when the removal was kept — false means it reverted and was reported. */
  const unfavoriteRecipe = (recipeId: string, reportFailure: () => void) =>
    performOptimisticUnfavorite({
      client,
      recipeId,
      mutate: () =>
        unfavoriteRecipeMutation({
          variables: { input: { recipeId } },
          // Local-first: queue + replay (idempotent) when the API is
          // unreachable instead of surfacing a blocking error.
          context: { localFirst: true },
        }),
      operation,
      reportFailure,
    });

  return { unfavoriteRecipe };
}
