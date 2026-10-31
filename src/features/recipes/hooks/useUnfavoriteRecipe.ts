import { useApolloClient, useMutation } from '@apollo/client/react';
import { RemoveRecipeFromFavoritesDocument } from '#features/recipes/graphql/recipe.generated';
import type { RemoveFavoriteInputs } from '#features/recipes/offline/localWrites';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';

interface UnfavoriteOptions {
  /** The caller's copy for a failure nothing more specific describes. */
  fallback?: string;
  present?: 'alert' | 'toast';
}

export function useUnfavoriteRecipe() {
  const client = useApolloClient();
  const { t } = useTranslation();
  const [unfavoriteRecipeMutation] = useMutation(
    RemoveRecipeFromFavoritesDocument,
    { context: { localFirst: true } },
  );

  /** True when the removal was kept; false when it was refused and reported. */
  const unfavoriteRecipe = async (
    recipeId: string,
    { fallback, present }: UnfavoriteOptions = {},
  ): Promise<boolean> => {
    const inputs: RemoveFavoriteInputs = { recipeId };
    const settled = await pendingWritesOf(client.cache).send(
      RemoveRecipeFromFavoritesDocument,
      { input: { recipeId } },
      write =>
        settleMutation(() => unfavoriteRecipeMutation(write), {
          document: RemoveRecipeFromFavoritesDocument,
          fallback: fallback ?? t('recipes.removeRecipeFailed'),
          present,
        }),
      inputs,
    );
    return settled.status !== 'failed';
  };

  return { unfavoriteRecipe };
}
