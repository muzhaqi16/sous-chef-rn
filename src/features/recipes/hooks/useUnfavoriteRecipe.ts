import { RemoveRecipeFromFavoritesDocument } from '#features/recipes/graphql/recipe.generated';
import type { RemoveFavoriteInputs } from '#features/recipes/offline/localWrites';
import { useLocalWrite } from '#/apollo/pendingWrites/useLocalWrite';
import { useTranslation } from '#/i18n';

interface UnfavoriteOptions {
  /** The caller's copy for a failure nothing more specific describes. */
  fallback?: string;
  present?: 'alert' | 'toast';
}

export function useUnfavoriteRecipe() {
  const { t } = useTranslation();
  const removeFavorite = useLocalWrite(RemoveRecipeFromFavoritesDocument, {
    fallback: t('recipes.removeRecipeFailed'),
  });

  /** True when the removal was kept; false when it was refused and reported. */
  const unfavoriteRecipe = async (
    recipeId: string,
    { fallback, present }: UnfavoriteOptions = {},
  ): Promise<boolean> => {
    const inputs: RemoveFavoriteInputs = { recipeId };
    const settled = await removeFavorite.send({ input: { recipeId } }, inputs, {
      settle: {
        fallback: fallback ?? t('recipes.removeRecipeFailed'),
        present,
      },
    });
    return settled.status !== 'failed';
  };

  return { unfavoriteRecipe };
}
