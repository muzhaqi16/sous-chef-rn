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
 * Cells read fields via `useFragment(SavedRecipeCard_savedRecipe)` for a
 * per-entity subscription; the hook exposes only the id-level scalars its
 * client-side filter helpers need.
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
  /** The query was skipped, so no response was ever requested. */
  skipped: boolean;
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
 * The user's saved recipes. Returns connection nodes as REFS — consumers render
 * them through `<SavedRecipeCard savedRecipeRef={node} />`, which takes its own
 * per-entity `useFragment` subscription.
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
      // Signed out, so the query above was never sent. Reported so the screen
      // shows its empty state rather than accusing the network of a failure.
      skipped: isLoggedOut,
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
