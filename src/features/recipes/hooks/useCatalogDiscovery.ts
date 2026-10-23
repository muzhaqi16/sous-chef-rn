import { useState } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { useScreenFocusEffect } from '#platform/screen';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { useCurrentHome } from '#features/pantry/hooks/useCurrentHome';
import { usePantryManagement } from '#features/pantry/hooks/usePantryManagement';
import type { PantryListItemNode } from '#features/pantry/hooks/usePantryQuery';
import { catalogIngredientNames } from '#domain/catalogRecipes';
import { defaultPantryOf } from '#domain/homePantries';
import type { Diet, Intolerance } from '#/graphql/generated/schemaTypes';
import type { RecipeRow } from '#features/recipes/utils/recipeRows';
import { useCatalogReadOptions } from './useCatalogReadOptions';
import {
  CatalogRecipesByIngredientsDocument,
  RandomCatalogRecipesDocument,
  type CatalogRecipesByIngredientsQuery,
  type RandomCatalogRecipesQuery,
} from './useCatalogDiscovery.generated';

type DiscoveryMode = 'pantry' | 'random' | 'none';

const DISCOVERY_PAGE_SIZE = 15;
const DISCOVERY_FETCH_SIZE = 25;
const DISCOVERY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
  /** A refresh is in flight. */
  refreshing: boolean;
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

/** The page `mode` shows, the same object while unchanged, and its rows. */
function shownOf(
  mode: DiscoveryMode,
  byIngredients: CatalogRecipesByIngredientsQuery | undefined,
  random: RandomCatalogRecipesQuery | undefined,
): { page: { catalogAvailable: boolean } | undefined; rows: RecipeRow[] } {
  switch (mode) {
    case 'pantry': {
      const page = byIngredients?.catalogRecipesByIngredients;
      return {
        page,
        rows: (page?.edges ?? []).map(
          (edge): RecipeRow => ({ source: 'pantry', edge }),
        ),
      };
    }
    case 'random': {
      const page = random?.randomCatalogRecipes;
      return {
        page,
        rows: (page?.edges ?? []).map(
          (edge): RecipeRow => ({ source: 'random', hit: edge.node }),
        ),
      };
    }
    case 'none':
      return { page: undefined, rows: [] };
  }
}

/** Every index below `count`, in a random order. */
function shuffledIndices(count: number): number[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    rank: Math.random(),
  }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ index }) => index);
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

  const pantryVariables =
    mode === 'pantry' ? { ingredients, first: DISCOVERY_FETCH_SIZE } : null;
  const pantryOptions = useCatalogReadOptions(
    CatalogRecipesByIngredientsDocument,
    pantryVariables,
    {
      field: 'catalogRecipesByIngredients',
      maxAgeMs: DISCOVERY_MAX_AGE_MS,
      pageOf: data => data.catalogRecipesByIngredients,
    },
  );
  const byIngredients = useQuery(
    CatalogRecipesByIngredientsDocument,
    pantryVariables
      ? { variables: pantryVariables, ...pantryOptions }
      : skipToken,
  );

  const randomVariables =
    mode === 'random'
      ? {
          diets: diet.diets,
          intolerances: diet.intolerances,
          first: DISCOVERY_FETCH_SIZE,
        }
      : null;
  const randomOptions = useCatalogReadOptions(
    RandomCatalogRecipesDocument,
    randomVariables,
    {
      field: 'randomCatalogRecipes',
      maxAgeMs: DISCOVERY_MAX_AGE_MS,
      pageOf: data => data.randomCatalogRecipes,
    },
  );
  const random = useQuery(
    RandomCatalogRecipesDocument,
    randomVariables
      ? { variables: randomVariables, ...randomOptions }
      : skipToken,
  );

  // A skipped query keeps its last run's data, so only the current mode's is read.
  const { page, rows: answered } = shownOf(
    mode,
    byIngredients.data,
    random.data,
  );

  // The API serves everyone one random draw for a day, so refreshing it
  // reorders the draw held; a new page drops the order.
  const [shuffle, setShuffle] = useState<{
    of: typeof page;
    order: number[];
  } | null>(null);
  const shuffled = shuffle?.of === page ? shuffle : null;
  const found = shuffled
    ? shuffled.order.flatMap(index => {
        const row = answered[index];
        return row ? [row] : [];
      })
    : answered;

  // A screenful at a time, from the top again for a new list or order.
  const list = shuffled ?? page;
  const [visible, setVisible] = useState({
    of: list,
    count: DISCOVERY_PAGE_SIZE,
  });
  if (visible.of !== list) {
    setVisible({ of: list, count: DISCOVERY_PAGE_SIZE });
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

  // Set by `refresh` only: a resync refetches the same page unseen.
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (mode === 'none') return;
    if (mode === 'random' && page && !isDegraded(page)) {
      setShuffle({ of: page, order: shuffledIndices(answered.length) });
      return;
    }
    await executeRefreshWithFinally(active.refetch, setRefreshing);
  };

  return {
    mode,
    rows: found.slice(0, visible.count),
    loading,
    refreshing: mode !== 'none' && refreshing,
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
