import { useApolloClient, useMutation } from '@apollo/client/react';
import { DeleteRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import type { RemoveRecipeInputs } from '#features/recipes/offline/localWrites';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';

export function useDeleteRecipe() {
  const client = useApolloClient();
  const { t } = useTranslation();
  const [deleteRecipeMutation] = useMutation(DeleteRecipeDocument, {
    context: { localFirst: true },
  });

  /** `true` once the recipe is gone or its removal is queued; `false` when refused. */
  const deleteRecipe = async (id: string): Promise<boolean> => {
    const inputs: RemoveRecipeInputs = { recipeId: id };
    const settled = await pendingWritesOf(client.cache).send(
      DeleteRecipeDocument,
      { input: { id } },
      write =>
        settleMutation(() => deleteRecipeMutation(write), {
          document: DeleteRecipeDocument,
          fallback: t('recipes.deleteRecipeFailed'),
          removal: true,
        }),
      inputs,
    );
    return settled.status !== 'failed';
  };

  return { deleteRecipe };
}
