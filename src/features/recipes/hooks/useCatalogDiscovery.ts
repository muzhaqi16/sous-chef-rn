import { useState } from 'react';
import { skipToken, useApolloClient, useQuery } from '@apollo/client/react';
import { useScreenFocusEffect } from '#platform/screen';
import { useFirstFetchPolicy } from '#hooks/apollo/useFirstFetchPolicy';
import { useCurrentHome } from '#features/pantry/hooks/useCurrentHome';
import { usePantryManagement } from '#features/pantry/hooks/usePantryManagement';
import type { PantryListItemNode } from '#features/pantry/hooks/usePantryQuery';
import { catalogIngredientNames } from '#domain/catalogRecipes';
import { defaultPantryOf } from '#domain/homePantries';
import type { Diet, Intolerance } from '#/graphql/generated/schemaTypes';
import type { RecipeRow } from '#features/recipes/utils/recipeRows';
import {
  CatalogRecipesByIngredientsDocument,
  RandomCatalogRecipesDocument,
  type CatalogRecipesByIngredientsQuery,
  type RandomCatalogRecipesQuery,
} from './useCatalogDiscovery.generated';

type DiscoveryMode = 'pantry' | 'random' | 'none';

const DISCOVERY_PAGE_SIZE = 15;
const DISCOVERY_FETCH_SIZE = 25;

/** The dietary profile discovery screens catalog recipes by. */
export interface DiscoveryDiet {
  diets: Diet[];
  intolerances: Intolerance[];
}

export interface CatalogDiscoveryResult {
  mode: DiscoveryMode;
  /** Any discovery's rows, so another source can stand in for these. */
  rows: RecipeRow[];
  loading: boolean;
  /** Nothing to show because the API failed or could not ask the catalog. */
  failed: boolean;
  refresh: () => Promise<void>;
  pantryItems: PantryListItemNode[];
  hasPantryItems: boolean;
  pantryHasMore: boolean;
  pantryLoadingMore: boolean;
  loadMorePantryItems: () => void;
  discoveryHasMore: boolean;
  loadMoreDiscovery: () => void;
}

function modeOf(ready: boolean, ingredientCount: number): DiscoveryMode {
  if (!ready) return 'none';
  return ingredientCount > 0 ? 'pantry' : 'random';
}

/** Every row the API found for `mode`. */
function foundRows(
  mode: DiscoveryMode,
  byIngredients: CatalogRecipesByIngredientsQuery | undefined,
  random: RandomCatalogRecipesQuery | undefined,
): RecipeRow[] {
  switch (mode) {
    case 'pantry':
      return (byIngredients?.catalogRecipesByIngredients.edges ?? []).map(
        (edge): RecipeRow => ({ source: 'pantry', edge }),
      );
    case 'random':
      return (random?.randomCatalogRecipes.edges ?? []).map(
        (edge): RecipeRow => ({ source: 'random', hit: edge.node }),
      );
    case 'none':
      return [];
  }
}

/** The page `mode` shows, the same object while the answer is unchanged. */
function pageOf(
  mode: DiscoveryMode,
  byIngredients: CatalogRecipesByIngredientsQuery | undefined,
  random: RandomCatalogRecipesQuery | undefined,
): { catalogAvailable: boolean } | undefined {
  switch (mode) {
    case 'pantry':
      return byIngredients?.catalogRecipesByIngredients;
    case 'random':
      return random?.randomCatalogRecipes;
    case 'none':
      return undefined;
  }
}

/** Answered without the catalog, so asking again may find more. */
const isDegraded = (page: { catalogAvailable: boolean } | undefined): boolean =>
  page?.catalogAvailable === false;

/**
 * Catalog recipes the pantry can make, or random ones screened by the dietary
 * profile when it is empty: one page from the API, shown a screenful at a
 * time. Not `enabled`, only the ingredient picker's pantry watch runs.
 */
export function useCatalogDiscovery(
  diet: DiscoveryDiet,
  { enabled = true }: { enabled?: boolean } = {},
): CatalogDiscoveryResult {
  // From the cache: `useDefaultHome` owns the homes fetch.
  const { currentHome } = useCurrentHome();
  const defaultPantry = defaultPantryOf(currentHome);

  // The Recipes tab stays mounted hidden, so blurred the pantry watch is
  // skipped and `usePreservedConnection` holds it. Starts FOCUSED: tabs are
  // lazy, and a blurred first render fires a throwaway random-mode fetch.
  const [isFocused, setIsFocused] = useState(true);
  const [onFocusChange] = useState(() => () => {
    setIsFocused(true);
    return () => setIsFocused(false);
  });
  useScreenFocusEffect(onFocusChange);

  const {
    state: {
      items: pantryItems,
      loading: pantryLoading,
      hasResult: pantryHasResult,
      hasMore: pantryHasMore,
      isLoadingMore: pantryLoadingMore,
    },
    actions: { loadMore: loadMorePantryItems },
  } = usePantryManagement(defaultPantry?.id, {
    skip: !isFocused,
    fetchPolicy: 'cache-first',
  });

  const ingredients = catalogIngredientNames(
    pantryItems.map(item => item.itemName),
  );
  // A pantry that has answered keeps its items through a refetch or a next
  // page, so only one that never has holds discovery back.
  const pantryPending = pantryLoading && !pantryHasResult;
  const mode = modeOf(enabled && !pantryPending, ingredients.length);

  const client = useApolloClient();
  const pantryVariables = { ingredients, first: DISCOVERY_FETCH_SIZE };
  const pantryPolicy = useFirstFetchPolicy(
    mode === 'pantry' ? JSON.stringify(pantryVariables) : null,
    () =>
      isDegraded(
        client.readQuery({
          query: CatalogRecipesByIngredientsDocument,
          variables: pantryVariables,
        })?.catalogRecipesByIngredients,
      ),
  );
  const byIngredients = useQuery(
    CatalogRecipesByIngredientsDocument,
    mode === 'pantry'
      ? {
          variables: pantryVariables,
          fetchPolicy: pantryPolicy,
          refetchOn: false,
        }
      : skipToken,
  );

  const randomVariables = {
    diets: diet.diets,
    intolerances: diet.intolerances,
    first: DISCOVERY_FETCH_SIZE,
  };
  const randomPolicy = useFirstFetchPolicy(
    mode === 'random' ? JSON.stringify(randomVariables) : null,
    () =>
      isDegraded(
        client.readQuery({
          query: RandomCatalogRecipesDocument,
          variables: randomVariables,
        })?.randomCatalogRecipes,
      ),
  );
  const random = useQuery(
    RandomCatalogRecipesDocument,
    mode === 'random'
      ? {
          variables: randomVariables,
          fetchPolicy: randomPolicy,
          refetchOn: false,
        }
      : skipToken,
  );

  // A skipped query keeps its last run's data, so only the current mode's is read.
  const found = foundRows(mode, byIngredients.data, random.data);
  const page = pageOf(mode, byIngredients.data, random.data);

  // A screenful at a time, from the top again whenever a new list arrives.
  const [visible, setVisible] = useState({
    of: page,
    count: DISCOVERY_PAGE_SIZE,
  });
  if (visible.of !== page) {
    setVisible({ of: page, count: DISCOVERY_PAGE_SIZE });
  }

  const discoveryHasMore = visible.count < found.length;
  const loadMoreDiscovery = () => {
    if (!discoveryHasMore) return;
    setVisible(prev => ({
      ...prev,
      count: Math.min(prev.count + DISCOVERY_PAGE_SIZE, found.length),
    }));
  };

  const active = mode === 'pantry' ? byIngredients : random;
  const loading =
    enabled &&
    (pantryPending || (mode !== 'none' && active.loading && !active.data));
  const failed =
    mode !== 'none' &&
    !loading &&
    found.length === 0 &&
    (page ? isDegraded(page) : active.error !== undefined);

  const refresh = async () => {
    if (mode === 'none') return;
    await active.refetch();
  };

  return {
    mode,
    rows: found.slice(0, visible.count),
    loading,
    failed,
    refresh,
    pantryItems,
    hasPantryItems: pantryItems.length > 0,
    pantryHasMore,
    pantryLoadingMore,
    // `usePagination` catches a failed page itself.
    loadMorePantryItems: () => {
      void loadMorePantryItems();
    },
    discoveryHasMore,
    loadMoreDiscovery,
  };
}
