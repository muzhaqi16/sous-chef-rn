import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  DeleteRecipeDocument,
  MyRecipesDocument,
  type MyRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import { errorService } from '#/services/errorService';

/** The result is carried so the caller can resolve LOCALIZED refusal copy. */
export interface DeleteRecipeOutcome {
  result: { data?: unknown; error?: unknown } | undefined;
}

/**
 * Delete a recipe local-first: the row leaves the list BEFORE the mutation
 * fires, so the deletion is visible immediately and survives an offline queue
 * (a duplicate replay surfaces as NotFound, which the queue drops).
 */
export function useDeleteRecipe() {
  const client = useApolloClient();
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

  const deleteRecipe = async (id: string): Promise<DeleteRecipeOutcome> => {
    try {
      removeRecipeEdge(id);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Delete Recipe (optimistic)',
      });
    }

    let result;
    try {
      result = await deleteRecipeMutation({
        variables: { input: { id } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, { operation: 'deleteRecipe' });
    }
    return { result };
  };

  return { deleteRecipe };
}
