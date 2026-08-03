/**
 * useForkRecipe — fork a recipe into an editable copy the user owns.
 *
 * Online-only: the server mints the forked recipe's id (no client id to key an
 * offline replay on), so a forked copy can't be queued. The created recipe is
 * added to the MyRecipes overview connection; the fork's id is returned so the
 * caller can navigate to the new editable recipe.
 */

import { useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { ForkRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { upsertMyRecipesEdge } from '#features/recipes/screens/RecipeForm/recipeCacheWriters';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { executeMutation } from '#/utils/compilerSafeWrappers';

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
    const result = await executeMutation(
      () => forkMutation({ variables: { input: { id: recipeId } } }),
      'Fork Recipe error:',
    );
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
