import { useQuery } from '@apollo/client/react';
import {
  MySavedRecipesDocument,
  type MySavedRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import type { HookReturn } from '#hooks/types';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Connection node type emitted by the MySavedRecipes query. Cells read fields
 * via `useFragment(SavedRecipeCard_savedRecipe)` for a per-entity cache
 * subscription. The hook itself exposes only the id-level scalars needed for
 * client-side filter helpers (`getRecipeById`, `getRecipesByFolder`,
 * `getRecipesByTag`).
 */
export type SavedRecipeNode = NonNullable<
  MySavedRecipesQuery['me']
>['savedRecipesConnection']['edges'][number]['node'];

interface SavedRecipesState {
  recipes: SavedRecipeNode[];
  loading: boolean;
  error: Error | undefined;
  /** `data !== undefined` — a response arrived, empty or not. */
  hasResult: boolean;
  totalCount: number | undefined;
  hasMore: boolean;
}

interface SavedRecipesActions {
  refetch: () => void;
  loadMore: () => Promise<void>;
  getRecipeById: (recipeId: string) => SavedRecipeNode | undefined;
  getRecipesByFolder: (folderName: string) => SavedRecipeNode[];
  getRecipesByTag: (tag: string) => SavedRecipeNode[];
}

type UseSavedRecipesResult = HookReturn<SavedRecipesState, SavedRecipesActions>;

/**
 * Hook to fetch the user's saved/favorited recipes.
 *
 * Returns connection nodes as refs — consumers render them through
 * `<SavedRecipeCard savedRecipeRef={node} />` which internally calls
 * `useFragment` for a per-entity cache subscription.
 */
export function useSavedRecipes(folder?: string | null): UseSavedRecipesResult {
  const isLoggedOut = useIsLoggedOut();

  const { data, loading, error, refetch, fetchMore } = useQuery(
    MySavedRecipesDocument,
    {
      variables: {
        folder: folder ?? undefined,
        first: DEFAULT_PAGE_SIZE,
      },
      skip: isLoggedOut,
    },
  );

  useApolloErrorLogger('MySavedRecipes', error);

  const connectionData = useConnectionData({
    data,
    selector: d => d.me?.savedRecipesConnection,
    loading,
    fetchMore,
  });

  const recipes = connectionData.items as SavedRecipeNode[];

  return {
    state: {
      recipes,
      loading,
      error: error as Error | undefined,
      hasResult: data !== undefined,
      totalCount: connectionData.totalCount,
      hasMore: connectionData.hasMore,
    },
    actions: {
      refetch,
      loadMore: connectionData.loadMore,
      getRecipeById: (recipeId: string) =>
        recipes.find(recipe => recipe.recipe.id === recipeId),
      getRecipesByFolder: (folderName: string) =>
        recipes.filter(recipe => recipe.folder === folderName),
      getRecipesByTag: (tag: string) =>
        recipes.filter(recipe => (recipe.tags ?? []).includes(tag)),
    },
  };
}
