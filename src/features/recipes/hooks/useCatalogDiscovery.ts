import { useState } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { useScreenFocusEffect } from '#platform/screen';
import { useCurrentHome } from '#features/pantry/hooks/useCurrentHome';
import { usePantryManagement } from '#features/pantry/hooks/usePantryManagement';
import type { PantryListItemNode } from '#features/pantry/hooks/usePantryQuery';
import { defaultPantryOf } from '#domain/homePantries';
import type { Diet, Intolerance } from '#/graphql/generated/schemaTypes';
import type { RecipeRow } from '#features/recipes/utils/recipeRows';
import { MAX_SEARCH_INGREDIENTS } from './useRecipeSearch';
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

const ingredientNamesOf = (pantryItems: PantryListItemNode[]): string[] =>
  pantryItems
    .map(item => item.itemName)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_INGREDIENTS);

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
      hasMore: pantryHasMore,
      isLoadingMore: pantryLoadingMore,
    },
    actions: { loadMore: loadMorePantryItems },
  } = usePantryManagement(defaultPantry?.id, {
    skip: !isFocused,
    fetchPolicy: 'cache-first',
  });

  const ingredients = ingredientNamesOf(pantryItems);
  const ready = enabled && !pantryLoading;
  const mode = modeOf(ready, ingredients.length);

  const byIngredients = useQuery(
    CatalogRecipesByIngredientsDocument,
    mode === 'pantry'
      ? {
          variables: { ingredients, first: DISCOVERY_FETCH_SIZE },
          fetchPolicy: 'cache-first',
          refetchOn: false,
        }
      : skipToken,
  );
  const random = useQuery(
    RandomCatalogRecipesDocument,
    mode === 'random'
      ? {
          variables: {
            diets: diet.diets,
            intolerances: diet.intolerances,
            first: DISCOVERY_FETCH_SIZE,
          },
          fetchPolicy: 'cache-first',
          refetchOn: false,
        }
      : skipToken,
  );

  // A skipped query keeps its last run's data, so only the current mode's is read.
  const found = foundRows(mode, byIngredients.data, random.data);

  // A screenful at a time, from the top again whenever a new list arrives.
  const [visible, setVisible] = useState({
    of: found.length,
    count: DISCOVERY_PAGE_SIZE,
  });
  if (visible.of !== found.length) {
    setVisible({ of: found.length, count: DISCOVERY_PAGE_SIZE });
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
    (pantryLoading || (mode !== 'none' && active.loading && !active.data));

  const refresh = async () => {
    if (mode === 'none') return;
    await active.refetch();
  };

  return {
    mode,
    rows: found.slice(0, visible.count),
    loading,
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
