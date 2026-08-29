import { type ApolloCache, type Reference } from '@apollo/client';
import {
  MySavedRecipesDocument,
  type MySavedRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';

/**
 * Drop a recipe's saved edge from `MySavedRecipes` and clear
 * `Recipe.savedDetails`.
 *
 * Runs on the server's confirmed removal, never before it — un-saving is
 * online-only, so there is no optimistic pass to reconcile with.
 *
 * Shared because both surfaces that un-save (the recipe detail's metadata hook
 * and the saved-recipes list) had grown their own copy, matching the edge by
 * different fields and disagreeing about when to decrement — so what un-saving
 * did depended on which screen you did it from. Matching on the RECIPE id works
 * from either: the `SavedRecipe` id is absent from an idempotent payload, while
 * the recipe id is always in the caller's own variables.
 *
 * The count follows the edges: a payload for a row already gone must not
 * decrement a count that no longer includes it. Without that guard a second tap
 * during the round trip — nothing disables the control — drives the total below
 * the number of rows.
 */
export function removeSavedRecipeFromCache(
  cache: ApolloCache,
  recipeId: string,
): void {
  cache.updateQuery<MySavedRecipesQuery>(
    { query: MySavedRecipesDocument },
    existing => {
      if (!existing?.me) return existing;
      const connection = existing.me.savedRecipesConnection;
      const edges = connection.edges.filter(
        edge => edge.node.recipe.id !== recipeId,
      );
      if (edges.length === connection.edges.length) return existing;
      return {
        ...existing,
        me: {
          ...existing.me,
          savedRecipesConnection: {
            ...connection,
            edges,
            totalCount: Math.max(0, (connection.totalCount ?? 0) - 1),
          },
        },
      };
    },
  );

  const recipeCacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (!recipeCacheId) return;
  cache.modify<{ savedDetails: Reference | null }>({
    id: recipeCacheId,
    fields: { savedDetails: () => null },
  });
}
