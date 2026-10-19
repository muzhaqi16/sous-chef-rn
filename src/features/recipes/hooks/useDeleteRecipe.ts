import { useApolloClient, useMutation } from '@apollo/client/react';
import { DeleteRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { removeMyRecipesEdge } from '#features/recipes/utils/recipeCacheWriters';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';

/**
 * Delete a recipe local-first: the row leaves the list BEFORE the mutation
 * fires, so the deletion is visible immediately and survives an offline queue
 * (a duplicate replay answers `converged`, a success with no recipe).
 */
export function useDeleteRecipe() {
  const client = useApolloClient();
  const { t } = useTranslation();
  const [deleteRecipeMutation] = useMutation(DeleteRecipeDocument, {
    context: { localFirst: true },
  });

  /** `true` once the recipe is gone or its removal is queued; `false` when refused. */
  const deleteRecipe = async (id: string): Promise<boolean> => {
    try {
      removeMyRecipesEdge(client.cache, id);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Delete Recipe (optimistic)',
      });
    }

    const settled = await settleMutation(
      () =>
        deleteRecipeMutation({
          variables: { input: { id } },
        }),
      {
        document: DeleteRecipeDocument,
        fallback: t('recipes.deleteRecipeFailed'),
        removal: true,
      },
    );
    return settled.status !== 'failed';
  };

  return { deleteRecipe };
}
