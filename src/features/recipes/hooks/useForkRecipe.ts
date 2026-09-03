/**
 * Forks a recipe into an editable copy. Online-only — the server mints the
 * fork's id, so there is nothing to key an offline replay on. Returns that id
 * for navigation and adds the recipe to the MyRecipes connection.
 */

import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { ForkRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { upsertMyRecipesEdge } from '#features/recipes/utils/recipeCacheWriters';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { errorService } from '#/services/errorService';

export function useForkRecipe() {
  const { t } = useTranslation();
  const [forkMutation, { loading: forking }] = useMutation(ForkRecipeDocument, {
    update: (cache, { data }) => {
      if (data?.forkRecipe?.__typename === 'ForkRecipePayload') {
        upsertMyRecipesEdge(cache, data.forkRecipe.recipe);
      }
    },
  });

  // Returns the forked recipe's id (for navigation) or null on failure.
  const forkRecipe = async (recipeId: string): Promise<string | null> => {
    let result;
    try {
      result = await forkMutation({ variables: { input: { id: recipeId } } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Fork Recipe error:',
      });
    }
    if (!result) return null;
    if (alertIfRejected(result, t('recipes.forkFailed'))) {
      return null;
    }
    const payload = result.data?.forkRecipe;
    return payload?.__typename === 'ForkRecipePayload'
      ? payload.recipe.id
      : null;
  };

  return { forkRecipe, forking };
}
