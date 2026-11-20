import { DeleteRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import type { RemoveRecipeInputs } from '#features/recipes/offline/localWrites';
import { useLocalWrite } from '#/apollo/pendingWrites/useLocalWrite';
import { useTranslation } from '#/i18n';

export function useDeleteRecipe() {
  const { t } = useTranslation();
  const removeRecipe = useLocalWrite(DeleteRecipeDocument, {
    fallback: t('recipes.deleteRecipeFailed'),
    removal: true,
  });

  /** `true` once the recipe is gone or its removal is queued; `false` when refused. */
  const deleteRecipe = async (id: string): Promise<boolean> => {
    const inputs: RemoveRecipeInputs = { recipeId: id };
    const settled = await removeRecipe.send({ input: { id } }, inputs);
    return settled.status !== 'failed';
  };

  return { deleteRecipe };
}
