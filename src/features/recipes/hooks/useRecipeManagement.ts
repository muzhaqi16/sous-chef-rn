import { useQuery } from '@apollo/client/react';
import {
  MyRecipesDocument,
  type MyRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useLoadRemainingPages } from '#features/recipes/hooks/useLoadRemainingPages';

/**
 * Connection node type emitted by the MyRecipes query. The cell renders via
 * `useFragment(MyRecipeCard_recipe)`; the parent reads only the id and the
 * scalars its local search matches on.
 */
export type MyRecipeNode = NonNullable<
  MyRecipesQuery['recipes']
>['edges'][number]['node'];

interface RecipeManagementOptions {
  /**
   * Page through the whole connection while true. The API cannot search the
   * user's recipes, so a local search covers every one only once all pages load.
   */
  loadAllPages?: boolean;
  /** The local filter; a new one restarts a load-all that stopped. */
  filterKey?: string;
}

/**
 * Cursor-paginated recipe management. Returns connection nodes as REFS —
 * consumers render them through `<MyRecipeCard recipeRef={node} />`, which
 * takes its own per-entity `useFragment` subscription.
 */
export function useRecipeManagement({
  loadAllPages = false,
  filterKey = '',
}: RecipeManagementOptions = {}) {
  const isLoggedOut = useIsLoggedOut();

  const { data, loading, error, refetch, fetchMore } = useQuery(
    MyRecipesDocument,
    {
      variables: { first: 25 },
      skip: isLoggedOut,
    },
  );

  useApolloErrorLogger(MyRecipesDocument, error);

  const connectionData = useConnectionData({
    data,
    selector: d => d.recipes,
    loading,
    fetchMore,
    cursorVariableName: 'cursor',
    refetch,
  });

  const remainingPages = useLoadRemainingPages(
    loadAllPages,
    loading,
    connectionData,
    filterKey,
  );

  return {
    state: {
      recipes: connectionData.items,
      loading,
      error,
      // `data !== undefined` — a response arrived, empty or not. Screens need
      // this to tell "the server says you have no recipes" from "we never got
      // an answer", which must not render the same way.
      hasResult: data !== undefined,
      // Signed out, so the query above was never sent. Reported so the screen
      // shows its empty state rather than accusing the network of a failure.
      skipped: isLoggedOut,
      hasMore: connectionData.hasMore,
      isLoadingMore: connectionData.isLoadingMore,
      isLoadingRemainingPages: remainingPages.isLoadingRemainingPages,
      isSearchIncomplete: remainingPages.incomplete,
    },
    actions: {
      loadMore: connectionData.loadMore,
      refetch,
      retryRemainingPages: remainingPages.retry,
    },
  };
}
