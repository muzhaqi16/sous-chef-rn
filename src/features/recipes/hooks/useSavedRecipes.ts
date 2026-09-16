import { useQuery } from '@apollo/client/react';
import {
  MySavedRecipesDocument,
  type MySavedRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import type { HookReturn } from '#hooks/types';
import { useLoadRemainingPages } from '#features/recipes/hooks/useLoadRemainingPages';

/** `useRecipeTags` watches the same page, so the first request is shared. */
export const SAVED_RECIPES_PAGE_SIZE = 20;

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
  hasMore: boolean;
  isLoadingMore: boolean;
  /** `loadAllPages` is on and pages remain that have not failed to load. */
  isLoadingRemainingPages: boolean;
}

interface SavedRecipesActions {
  /** Resolves when the refetch settles, so a caller can drive a spinner. */
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

type UseSavedRecipesResult = HookReturn<SavedRecipesState, SavedRecipesActions>;

interface SavedRecipesOptions {
  /**
   * Page through the whole connection while true. The API cannot search saved
   * recipes, so a local search covers every one only once all pages are loaded.
   */
  loadAllPages?: boolean;
}

/**
 * The user's saved recipes. Returns connection nodes as REFS — consumers render
 * them through `<SavedRecipeCard savedRecipeRef={node} />`, which takes its own
 * per-entity `useFragment` subscription.
 */
export function useSavedRecipes({
  loadAllPages = false,
}: SavedRecipesOptions = {}): UseSavedRecipesResult {
  const isLoggedOut = useIsLoggedOut();

  const { data, loading, error, refetch, fetchMore } = useQuery(
    MySavedRecipesDocument,
    {
      variables: { first: SAVED_RECIPES_PAGE_SIZE },
      skip: isLoggedOut,
    },
  );

  useApolloErrorLogger(MySavedRecipesDocument, error);

  const connectionData = useConnectionData({
    data,
    selector: d => d.me?.savedRecipesConnection,
    loading,
    fetchMore,
    refetch,
  });

  const recipes = connectionData.items;
  const { hasMore, isLoadingMore, loadMore } = connectionData;
  const isLoadingRemainingPages = useLoadRemainingPages(
    loadAllPages,
    loading,
    connectionData,
  );

  return {
    state: {
      recipes,
      loading,
      error: error,
      hasResult: data !== undefined,
      // Signed out, so the query above was never sent. Reported so the screen
      // shows its empty state rather than accusing the network of a failure.
      skipped: isLoggedOut,
      hasMore,
      isLoadingMore,
      isLoadingRemainingPages,
    },
    actions: {
      refetch: async () => {
        await refetch();
      },
      loadMore,
    },
  };
}
