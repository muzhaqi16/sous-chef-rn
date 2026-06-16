import { useState } from 'react';
import { errorService } from '#/services/errorService';

import { useTranslation } from 'react-i18next';
import { useApolloClient } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
import { alertService } from '#/services/alertService';
import { t as tGlobal } from '#/i18n/t';
import { useDeferredSearch } from '#hooks/performance/useDeferredSearch';
import { pantryItemSearch } from '#utils/searchUtils';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type {
  SearchRecipesResult,
  RecipeSearchResult,
} from '#/services/recipeApi/types';
import { useRecipeDiscovery } from '#features/recipes/hooks/useRecipeDiscovery';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';
import { useRecipeFilters } from '#features/recipes/hooks/useRecipeFilters';
import {
  executeMutation,
  executeSearchQuery,
} from '#/utils/compilerSafeWrappers';
import {
  SearchRecipesDocument,
  type SearchRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import {
  useRecipeCacheStore,
  textSearchCacheKey,
  ingredientCacheKey,
} from '#/store/useRecipeCacheStore';
import { useUserId } from '#store/useAppStore';
import type { IconName } from '#/utils/iconUtils';
import {
  ExternalSource,
  Diet,
  Intolerance,
} from '#/graphql/generated/schemaTypes';
import {
  type RecipeFilters,
  DIET_ENUM_TO_SPOONACULAR,
  INTOLERANCE_ENUM_TO_SPOONACULAR,
  SPOONACULAR_TO_DIET_ENUM,
  SPOONACULAR_TO_INTOLERANCE_ENUM,
} from '#features/recipes/utils/recipeFilterMaps';
import { isLifestyleDiet } from '#/constants/dietary';
import {
  type DisplayItem,
  type LocalRecipeNode,
  type SpoonacularRecipe,
  toSpoonacularDisplayItems,
  toLocalDisplayItems,
} from '#features/recipes/utils/recipeDisplayTransforms';

// ── Module-level search helpers (React Compiler safe) ──

function handleSearchError(error: unknown, label: string): void {
  const err = error as {
    isQuotaExceeded?: boolean;
    isRateLimitError?: boolean;
  };
  errorService.reportError(error, { operation: label });
  if (err.isQuotaExceeded) {
    alertService.alert(
      tGlobal('recipes.apiLimitTitle'),
      tGlobal('recipes.apiLimitMessage'),
    );
  } else if (err.isRateLimitError) {
    alertService.alert(
      tGlobal('recipes.rateLimitTitle'),
      tGlobal('recipes.rateLimitMessage'),
    );
  } else {
    alertService.alert(
      tGlobal('recipes.searchErrorTitle'),
      tGlobal('recipes.searchErrorMessage'),
    );
  }
}

const SEARCH_FETCH_SIZE = 25;
const SEARCH_PAGE_SIZE = 15;

async function executeRecipeTextSearch(
  query: string,
  filters: RecipeFilters,
  client: ApolloClient,
  setLoading: (v: boolean) => void,
  setSearchPerformed: (v: boolean) => void,
  setDisplayResults: (v: DisplayItem[]) => void,
): Promise<void> {
  setLoading(true);
  setSearchPerformed(true);

  // Local API search — the user's own recipes. `searchRecipes` now accepts the
  // same diet/intolerance/maxReadyTime filters as Spoonacular, so both sources
  // stay consistent under active filters. `activeFilters` stores Spoonacular
  // strings; map them back to Diet/Intolerance enums for the GraphQL API
  // (unmapped values are dropped). Failures (offline, API unreachable) resolve
  // to null and degrade silently — Spoonacular results still display.
  const localDiets = filters.diet
    .map(d => SPOONACULAR_TO_DIET_ENUM[d])
    .filter((d): d is Diet => Boolean(d));
  const localIntolerances = filters.intolerances
    .map(i => SPOONACULAR_TO_INTOLERANCE_ENUM[i])
    .filter((i): i is Intolerance => Boolean(i));
  const localPromise = executeSearchQuery<SearchRecipesQuery>(
    () =>
      client.query<SearchRecipesQuery>({
        query: SearchRecipesDocument,
        variables: {
          query,
          first: SEARCH_FETCH_SIZE,
          ...(localDiets.length > 0 && { diets: localDiets }),
          ...(localIntolerances.length > 0 && {
            intolerances: localIntolerances,
          }),
          ...(filters.maxReadyTime && { maxReadyTime: filters.maxReadyTime }),
        },
        fetchPolicy: 'network-only',
      }),
    () => false,
  );

  // Spoonacular search — served from the 24h cache when available. Errors
  // are captured (not alerted) so the local source can still render; the
  // alert only fires when the combined list would otherwise be empty.
  let spoonacularError: unknown = null;
  const cacheKey = textSearchCacheKey(query, filters);
  const cacheStore = useRecipeCacheStore.getState();
  const cached = cacheStore.getCached(cacheKey);

  const spoonacularPromise: Promise<
    (SearchRecipesResult | RecipeSearchResult)[]
  > = cached
    ? Promise.resolve(cached.results)
    : (async () => {
        let results: (SearchRecipesResult | RecipeSearchResult)[] = [];
        await executeMutation(
          async () => {
            const data = await spoonacularService.searchRecipesWithInfo({
              query,
              number: SEARCH_FETCH_SIZE,
              ...(filters.diet.length > 0 && { diet: filters.diet.join(',') }),
              ...(filters.intolerances.length > 0 && {
                intolerances: filters.intolerances.join(','),
              }),
              ...(filters.mealType && { type: filters.mealType }),
              ...(filters.maxReadyTime && {
                maxReadyTime: filters.maxReadyTime,
              }),
            });
            results = data.results || [];
            cacheStore.setCached(cacheKey, results);
            return data;
          },
          error => {
            spoonacularError = error;
          },
        );
        return results;
      })();

  const [localData, spoonacularResults] = await Promise.all([
    localPromise,
    spoonacularPromise,
  ]);

  const localNodes =
    localData?.searchRecipes.edges.map(edge => edge.node) ?? [];

  // Drop Spoonacular results the backend already knows about so they don't
  // appear twice. Two guards: (1) by Spoonacular id when the backend recipe
  // is linked (viewed external recipes are upserted server-side); (2) by
  // normalized title, which catches the same recipe surfaced from both
  // sources without an external-id link. Backend results render first, so the
  // backend copy is the one kept.
  const localSpoonacularIds = new Set(
    localNodes
      .filter(
        node =>
          node.externalSource === ExternalSource.Spoonacular && node.externalId,
      )
      .map(node => node.externalId),
  );
  const normalizeTitle = (title: string) =>
    title.trim().toLowerCase().replace(/\s+/g, ' ');
  const localTitles = new Set(
    localNodes.map(node => normalizeTitle(node.name)),
  );
  const dedupedSpoonacular = spoonacularResults.filter(
    recipe =>
      !localSpoonacularIds.has(String(recipe.id)) &&
      !localTitles.has(normalizeTitle(recipe.title)),
  );

  // Index the live Spoonacular results so each backend row can borrow the
  // time + like count from its twin (matched by external id, then by title).
  const spoonacularById = new Map<string, SpoonacularRecipe>();
  const spoonacularByTitle = new Map<string, SpoonacularRecipe>();
  for (const recipe of spoonacularResults) {
    spoonacularById.set(String(recipe.id), recipe);
    const titleKey = normalizeTitle(recipe.title);
    if (!spoonacularByTitle.has(titleKey))
      spoonacularByTitle.set(titleKey, recipe);
  }
  const enrichmentFor = (
    node: LocalRecipeNode,
  ): SpoonacularRecipe | undefined => {
    if (node.externalSource === ExternalSource.Spoonacular && node.externalId) {
      const byId = spoonacularById.get(node.externalId);
      if (byId) return byId;
    }
    return spoonacularByTitle.get(normalizeTitle(node.name));
  };

  const combined = [
    ...toLocalDisplayItems(localNodes, enrichmentFor),
    ...toSpoonacularDisplayItems(dedupedSpoonacular),
  ];
  setDisplayResults(combined);

  if (spoonacularError) {
    if (combined.length === 0) {
      handleSearchError(spoonacularError, 'Search error');
    } else {
      // Local results are on screen — degrade silently.
      errorService.reportError(spoonacularError, {
        operation: 'searchRecipesSpoonacularDegraded',
      });
    }
  }

  setLoading(false);
}

async function executeRecipeIngredientSearch(
  ingredientString: string,
  setLoading: (v: boolean) => void,
  setSearchPerformed: (v: boolean) => void,
  setDisplayResults: (v: DisplayItem[]) => void,
): Promise<void> {
  setLoading(true);
  setSearchPerformed(true);

  // Check cache first
  const cacheKey = ingredientCacheKey(ingredientString);
  const cacheStore = useRecipeCacheStore.getState();
  const cached = cacheStore.getCached(cacheKey);

  if (cached) {
    setDisplayResults(toSpoonacularDisplayItems(cached.results));
    setLoading(false);
    return;
  }

  await executeMutation(
    async () => {
      // Note: findByIngredients API does NOT support diet/intolerance/mealType filters
      const results = await spoonacularService.searchRecipesByIngredients({
        ingredients: ingredientString,
        number: SEARCH_FETCH_SIZE,
        ranking: 1,
        ignorePantry: true,
      });
      setDisplayResults(toSpoonacularDisplayItems(results));
      cacheStore.setCached(cacheKey, results);
      return results;
    },
    error => handleSearchError(error, 'Ingredient search error'),
  );

  setLoading(false);
}

// ── Facade hook ──

export function useRecipeScreen() {
  const { t } = useTranslation();

  // ── User ──
  const userId = useUserId();

  // Apollo client for the imperative local-API search in executeRecipeTextSearch
  const client = useApolloClient();

  // ── Dietary profile (for filter defaults + discovery tags) ──
  const { profile: dietaryProfile } = useDietaryProfile();

  // Reconcile the profile's diet restrictions into the single-lifestyle +
  // stackable-constraints model: keep at most one lifestyle diet (the first,
  // deterministic) plus every constraint diet, as Spoonacular-format strings.
  // Shared by discovery tags and the search filter seeding so the two agree.
  const profileDietRestrictions = (dietaryProfile?.restrictions ?? []).filter(
    (r): r is typeof r & { diet: Diet } => Boolean(r.diet),
  );
  const firstLifestyleDiet = profileDietRestrictions.find(r =>
    isLifestyleDiet(r.diet),
  );
  const reconciledDietValues = [
    ...(firstLifestyleDiet ? [firstLifestyleDiet] : []),
    ...profileDietRestrictions.filter(r => !isLifestyleDiet(r.diet)),
  ].map(r => DIET_ENUM_TO_SPOONACULAR[r.diet] ?? r.diet.toLowerCase());

  // Discovery (random recipe API) takes a comma-separated tag string (AND).
  const dietaryTags =
    reconciledDietValues.length > 0
      ? reconciledDietValues.join(',')
      : undefined;

  // ── Discovery (includes pantry data) ──
  const discovery = useRecipeDiscovery(dietaryTags);

  // ── Search state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DisplayItem[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [visibleSearchCount, setVisibleSearchCount] =
    useState(SEARCH_PAGE_SIZE);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(
    new Set(),
  );

  // ── Ingredient search (local filtering for bottom sheet) ──
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState('');

  const { results: filteredPantryItems } = useDeferredSearch({
    items: discovery.pantryItems,
    searchQuery: ingredientSearchQuery,
    searchFn: pantryItemSearch,
  });

  const resetIngredientSearch = () => {
    setIngredientSearchQuery('');
  };

  // Results arrive pre-transformed into DisplayItems (see the recipeDisplay
  // transforms) — store them and reset the client-side pagination window.
  const setDisplayResultsAndResetPage = (displayItems: DisplayItem[]) => {
    setSearchResults(displayItems);
    setVisibleSearchCount(SEARCH_PAGE_SIZE);
  };

  // Re-run the current search with an explicit filter set (state updates are
  // async, so the caller passes the next filters rather than reading state).
  const rerunSearchWithFilters = async (nextFilters: RecipeFilters) => {
    if (!searchPerformed || !searchQuery.trim()) return;
    await executeRecipeTextSearch(
      searchQuery,
      nextFilters,
      client,
      setSearchLoading,
      setSearchPerformed,
      setDisplayResultsAndResetPage,
    );
  };

  // ── Filters ──
  // Normalize the dietary profile's Diet/Intolerance enums into the
  // Spoonacular-format strings RecipeFilters stores, via the shared forward
  // maps (single source of truth). useRecipeFilters owns the state + mutators
  // and seeds itself from this the first time it arrives carrying data.
  const profileFilters: RecipeFilters | null = dietaryProfile
    ? {
        diet: reconciledDietValues,
        intolerances: (dietaryProfile.restrictions ?? [])
          .filter((r): r is typeof r & { intolerance: Intolerance } =>
            Boolean(r.intolerance),
          )
          .map(
            r =>
              INTOLERANCE_ENUM_TO_SPOONACULAR[r.intolerance] ??
              r.intolerance.toLowerCase(),
          ),
        mealType: null,
        maxReadyTime: dietaryProfile.maxCookTimeMinutes ?? null,
      }
    : null;

  const {
    activeFilters,
    setActiveFilters,
    activeFilterCount,
    clearFilters,
    removeFilter,
    clearFiltersAndSearchAgain,
  } = useRecipeFilters({
    profileFilters,
    onApplyFilters: rerunSearchWithFilters,
  });

  // ── Derived display state ──
  const showSearchResults = searchPerformed && searchResults.length > 0;
  const showDiscovery = !searchPerformed && discovery.items.length > 0;

  // Search results are pre-transformed at data arrival (see setSearchResultsAndResetPage)
  // Just slice for client-side pagination
  const searchItems = showSearchResults
    ? searchResults.slice(0, visibleSearchCount)
    : [];

  const searchHasMore =
    showSearchResults && visibleSearchCount < searchResults.length;

  const loadMoreSearch = () => {
    if (!searchHasMore) return;
    setVisibleSearchCount(prev =>
      Math.min(prev + SEARCH_PAGE_SIZE, searchResults.length),
    );
  };

  // DiscoveryItem already satisfies DisplayItem — no mapping needed
  const items: DisplayItem[] = showSearchResults
    ? searchItems
    : showDiscovery
    ? discovery.items
    : [];

  // Image preloading is handled by ItemList internally — no duplicate effect needed

  // ── Actions ──
  const toggleIngredient = (name: string) => {
    setSelectedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const clearSelectedIngredients = () => {
    setSelectedIngredients(new Set());
  };

  const handleTextSearch = async (query: string) => {
    if (!query.trim()) return;
    setSearchQuery(query);

    await executeRecipeTextSearch(
      query,
      activeFilters,
      client,
      setSearchLoading,
      setSearchPerformed,
      setDisplayResultsAndResetPage,
    );
  };

  const handleIngredientSearch = async () => {
    if (selectedIngredients.size === 0) {
      alertService.alert(
        tGlobal('recipes.noIngredientsSelectedTitle'),
        tGlobal('recipes.selectAtLeastOneIngredient'),
      );
      return;
    }

    const ingredientString = Array.from(selectedIngredients).join(',');

    // Ingredient results aren't driven by the text query, and filters don't
    // apply to them — clearing the query keeps the active-filter row and the
    // filtered empty state scoped to text searches only.
    setSearchQuery('');

    await executeRecipeIngredientSearch(
      ingredientString,
      setSearchLoading,
      setSearchPerformed,
      setDisplayResultsAndResetPage,
    );
  };

  const handleRefresh = async () => {
    if (searchPerformed) {
      if (searchQuery.trim()) {
        await executeRecipeTextSearch(
          searchQuery,
          activeFilters,
          client,
          setSearchLoading,
          setSearchPerformed,
          setDisplayResultsAndResetPage,
        );
      }
    } else {
      discovery.refresh();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchPerformed(false);
    setVisibleSearchCount(SEARCH_PAGE_SIZE);
  };

  // ── Empty state ──
  const emptyStateConfig: {
    icon: IconName;
    title: string;
    description: string;
    action?: { label: string; onPress: () => void };
  } = searchLoading
    ? {
        icon: 'search',
        title: t('recipes.searchingTitle'),
        description: t('recipes.searchingDescription'),
      }
    : searchPerformed && activeFilterCount > 0 && searchQuery.trim() !== ''
    ? {
        // Zero TEXT-search results with dietary filters narrowing the search —
        // tell the user why and offer a one-tap recovery instead of a dead
        // end. Ingredient search never applies filters (searchQuery stays
        // empty), so it falls through to the plain empty state.
        icon: 'search-outline',
        title: t('recipes.noRecipesFoundTitle'),
        description: t('recipes.noResultsFiltered', {
          count: activeFilterCount,
        }),
        action: {
          label: t('recipes.clearFiltersAction'),
          onPress: clearFiltersAndSearchAgain,
        },
      }
    : searchPerformed
    ? {
        icon: 'search-outline',
        title: t('recipes.noRecipesFoundTitle'),
        description: t('recipes.noRecipesFoundDescription'),
      }
    : {
        icon: 'restaurant-outline',
        title: t('recipes.discoverTitle'),
        description: t('recipes.discoverDescription'),
      };

  return {
    // Data
    userId,
    discovery,
    pantryItems: discovery.pantryItems,
    hasPantryItems: discovery.hasPantryItems,
    pantryHasMore: discovery.pantryHasMore,
    pantryLoadingMore: discovery.pantryLoadingMore,
    loadMorePantryItems: discovery.loadMorePantryItems,
    discoveryHasMore: discovery.discoveryHasMore,
    loadMoreDiscovery: discovery.loadMoreDiscovery,
    items,

    // Search state
    searchQuery,
    searchResults,
    searchPerformed,
    searchLoading,
    searchHasMore,
    loadMoreSearch,
    selectedIngredients,
    ingredientSearchQuery,
    setIngredientSearchQuery,
    filteredPantryItems,
    resetIngredientSearch,

    // Display
    showSearchResults,
    showDiscovery,
    emptyStateConfig,

    // Filters
    activeFilters,
    setActiveFilters,
    activeFilterCount,
    clearFilters,
    removeFilter,
    clearFiltersAndSearchAgain,

    // Actions
    handleTextSearch,
    handleIngredientSearch,
    handleRefresh,
    clearSearch,
    toggleIngredient,
    clearSelectedIngredients,
  };
}
