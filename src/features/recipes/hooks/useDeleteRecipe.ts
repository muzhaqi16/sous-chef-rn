import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  DeleteRecipeDocument,
  MyRecipesDocument,
  type MyRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';

/**
 * Delete a recipe local-first: the row leaves the list BEFORE the mutation
 * fires, so the deletion is visible immediately and survives an offline queue
 * (a duplicate replay surfaces as NotFound, which counts as deleted).
 */
export function useDeleteRecipe() {
  const client = useApolloClient();
  const { t } = useTranslation();
  const [deleteRecipeMutation] = useMutation(DeleteRecipeDocument);

  const removeRecipeEdge = (id: string) => {
    client.cache.updateQuery<MyRecipesQuery>(
      { query: MyRecipesDocument },
      existing => {
        if (!existing?.recipes) return existing;
        const present = existing.recipes.edges.some(
          edge => edge.node.id === id,
        );
        if (!present) return existing;
        return {
          ...existing,
          recipes: {
            ...existing.recipes,
            edges: existing.recipes.edges.filter(edge => edge.node.id !== id),
            totalCount: (existing.recipes.totalCount ?? 0) - 1,
          },
        };
      },
    );
  };

  /** `true` once the recipe is gone or its removal is queued; `false` when refused. */
  const deleteRecipe = async (id: string): Promise<boolean> => {
    try {
      removeRecipeEdge(id);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Delete Recipe (optimistic)',
      });
    }

    const settled = await settleMutation(
      () =>
        deleteRecipeMutation({
          variables: { input: { id } },
          context: { localFirst: true },
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
