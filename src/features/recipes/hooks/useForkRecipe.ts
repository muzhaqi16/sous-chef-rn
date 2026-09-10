/**
 * Local-first: the id is minted here and sent as `newRecipeId`, which the server
 * passes into its own create, so a queued replay converges on one row. The
 * SERVER still forks — only it can set `forkedFromId` and carry an ingredient's
 * external sources — so the device shows a copy until the real row lands.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { ForkRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import {
  RecipeForm_RecipeFragmentDoc,
  type RecipeForm_RecipeFragment,
} from '#features/recipes/screens/RecipeForm/RecipeForm.generated';
import {
  revertOptimisticRecipe,
  upsertMyRecipesEdge,
  writeOptimisticRecipe,
  type RecipeCreatedBy,
} from '#features/recipes/utils/recipeCacheWriters';
import { forkRecipe as buildFork } from '#features/recipes/utils/forkRecipe';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { useUser } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';

export function useForkRecipe() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const user = useUser();
  const [forkMutation, { loading: forking }] = useMutation(ForkRecipeDocument, {
    update: (cache, { data }) => {
      if (data?.forkRecipe?.__typename === 'ForkRecipePayload') {
        // Upsert: the pre-fire write already inserted the edge under this same
        // id, so the server row upgrades it in place.
        upsertMyRecipesEdge(cache, data.forkRecipe.recipe);
      }
    },
  });

  // Returns the forked recipe's id (for navigation) or null on failure.
  const forkRecipe = async (recipeId: string): Promise<string | null> => {
    const source = client.cache.readFragment<RecipeForm_RecipeFragment>({
      id: client.cache.identify({ __typename: 'Recipe', id: recipeId }),
      fragment: RecipeForm_RecipeFragmentDoc,
      fragmentName: 'RecipeForm_recipe',
    });
    if (!source) {
      toastService.error(t('recipes.forkSourceNotLoaded'));
      return null;
    }

    const id = generateEntityId();
    // Built before the try: a value block inside one bails the whole function
    // out of the React Compiler.
    const copy = buildFork(
      {
        ...source,
        ingredients: source.ingredientsConnection.edges.map(edge => edge.node),
      },
      { name: t('recipes.forkCopyName', { name: source.name }) },
    );
    const createdBy: RecipeCreatedBy = user
      ? {
          __typename: 'User',
          id: user.id,
          email: user.email,
          displayName: user.displayName ?? null,
        }
      : null;
    try {
      writeOptimisticRecipe(client.cache, id, copy, createdBy);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Fork Recipe (optimistic)',
      });
    }

    let result;
    try {
      result = await forkMutation({
        variables: { input: { id: recipeId, newRecipeId: id } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Fork Recipe error:',
      });
    }

    // Online success or queued offline — the fork is in My Recipes either way.
    if (result && classifyCreateResult(result) !== 'rejected') return id;

    try {
      revertOptimisticRecipe(client.cache, id);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Revert rejected Recipe fork',
      });
    }
    if (result) alertIfRejected(result, t('recipes.forkFailed'));
    return null;
  };

  return { forkRecipe, forking };
}
