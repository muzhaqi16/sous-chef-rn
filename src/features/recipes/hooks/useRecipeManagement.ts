import { useQuery } from '@apollo/client/react';
import {
  MyRecipesDocument,
  type MyRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import { RecipeCategory, Difficulty } from '#/graphql/generated/schemaTypes';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

export interface RecipeFilters {
  category?: RecipeCategory;
  difficulty?: Difficulty;
}

/**
 * Connection node type emitted by the MyRecipes query. The cell renders via
 * `useFragment(MyRecipeCard_recipe)` so the parent only needs the id +
 * filterable scalars (category/difficulty) and the fragment ref.
 */
export type MyRecipeNode = NonNullable<
  MyRecipesQuery['recipes']
>['edges'][number]['node'];

/**
 * Recipe management hook with cursor-based pagination.
 *
 * Returns connection nodes as refs — consumers render them through
 * `<MyRecipeCard recipeRef={node} />` which internally calls `useFragment`
 * for a per-entity cache subscription.
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

  const recipes = connectionData.items as MyRecipeNode[];

  return {
    state: {
      recipes,
      loading,
      error,
      // `data !== undefined` — a response arrived, empty or not. Screens need
      // this to tell "the server says you have no recipes" from "we never got
      // an answer", which must not render the same way.
      hasResult: data !== undefined,
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
