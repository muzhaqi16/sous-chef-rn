import { useQuery } from '@apollo/client/react';
import { MyRecipesDocument } from '../../graphql/operations/recipe/recipe.generated';
import {
  RecipeCategory,
  Difficulty,
} from '../../graphql/generated/schemaTypes';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

export interface RecipeFilters {
  category?: RecipeCategory;
  difficulty?: Difficulty;
}

/**
 * Recipe management hook with cursor-based pagination
 * Uses Connection pattern for infinite scroll
 */
export function useRecipeManagement(filters?: RecipeFilters) {
  const isLoggedOut = useIsLoggedOut();

  const { data, loading, error, refetch, fetchMore } = useQuery(
    MyRecipesDocument,
    {
      variables: {
        first: 25,
        category: filters?.category,
        difficulty: filters?.difficulty,
      },
      skip: isLoggedOut,
    },
  );

  useApolloErrorLogger('MyRecipes', error);

  const connectionData = useConnectionData({
    data,
    selector: d => d.recipes,
    loading,
    fetchMore,
    cursorVariableName: 'cursor',
  });

  const recipes = connectionData.items;

  return {
    state: {
      recipes,
      loading,
      error,
      totalCount: connectionData.totalCount ?? 0,
      hasMore: connectionData.hasMore,
      isLoadingMore: connectionData.isLoadingMore,
    },
    actions: {
      loadMore: connectionData.loadMore,
      refetch,
      getRecipeById: (recipeId: string) =>
        recipes.find(recipe => recipe.id === recipeId),
      getRecipesByCategory: (category: RecipeCategory) =>
        recipes.filter(recipe => recipe.category === category),
      getRecipesByDifficulty: (difficulty: Difficulty) =>
        recipes.filter(recipe => recipe.difficulty === difficulty),
    },
  };
}
