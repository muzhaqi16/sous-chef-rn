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
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
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
      const payload = appliedPayload(data);
      // Upsert: the pre-fire write already inserted the edge under this same
      // id, so the server row upgrades it in place.
      if (payload) upsertMyRecipesEdge(cache, payload.recipe);
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

    const revertCopy = () => {
      try {
        revertOptimisticRecipe(client.cache, id);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Recipe fork',
        });
      }
    };

    const settled = await settleMutation(
      () =>
        forkMutation({
          variables: { input: { id: recipeId, newRecipeId: id } },
          context: { localFirst: true },
        }),
      {
        document: ForkRecipeDocument,
        fallback: t('recipes.forkFailed'),
        onFailed: revertCopy,
      },
    );

    // Online success or queued offline — the fork is in My Recipes either way.
    return settled.status === 'failed' ? null : id;
  };

  return { forkRecipe, forking };
}
