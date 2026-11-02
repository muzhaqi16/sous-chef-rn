/**
 * The id is minted here as `newRecipeId`, so a queued replay converges on one
 * row. Only the SERVER forks (it alone sets `forkedFromId` and carries external
 * sources), so the device shows a copy until then.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { ForkRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import {
  UseRecipeFormWrites_RecipeFragmentDoc,
  type UseRecipeFormWrites_RecipeFragment,
} from './useRecipeFormWrites.generated';
import type { CreateRecipeInputs } from '#features/recipes/offline/localWrites';
import type { RecipeCreatedBy } from '#features/recipes/utils/recipeCacheWriters';
import { forkRecipe as buildFork } from '#features/recipes/utils/forkRecipe';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { useUser } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { MAX_RECIPE_INGREDIENTS } from '#domain/recipeIngredientsPaging';

export function useForkRecipe() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const user = useUser();
  const [forkMutation, { loading: forking }] = useMutation(ForkRecipeDocument, {
    context: { localFirst: true },
  });

  // Returns the forked recipe's id (for navigation) or null on failure.
  const forkRecipe = async (recipeId: string): Promise<string | null> => {
    const source =
      client.cache.readFragment<UseRecipeFormWrites_RecipeFragment>({
        id: client.cache.identify({ __typename: 'Recipe', id: recipeId }),
        fragment: UseRecipeFormWrites_RecipeFragmentDoc,
        fragmentName: 'useRecipeFormWrites_recipe',
        optimistic: true,
      });
    if (!source) {
      toastService.error(t('recipes.forkSourceNotLoaded'));
      return null;
    }
    // The device's copy is written as a whole recipe. `hasNextPage` marks a
    // source over the ingredient limit: its copy would show, and later save, a
    // short list.
    if (source.ingredientsConnection.pageInfo.hasNextPage) {
      toastService.error(
        t('recipes.ingredientsOverLimit', { count: MAX_RECIPE_INGREDIENTS }),
      );
      return null;
    }

    const id = generateEntityId();
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
    const inputs: CreateRecipeInputs = {
      id,
      recipe: copy,
      createdBy,
      ingredientIds: copy.ingredients.map(() => generateEntityId()),
    };

    const settled = await pendingWritesOf(client.cache).send(
      ForkRecipeDocument,
      { input: { id: recipeId, newRecipeId: id } },
      write =>
        settleMutation(() => forkMutation(write), {
          document: ForkRecipeDocument,
          fallback: t('recipes.forkFailed'),
        }),
      inputs,
    );

    // Online success or queued offline — the fork is in My Recipes either way.
    return settled.status === 'failed' ? null : id;
  };

  return { forkRecipe, forking };
}
