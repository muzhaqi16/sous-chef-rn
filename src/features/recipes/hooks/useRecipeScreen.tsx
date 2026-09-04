import { useRef, useState } from 'react';

import { useTranslation } from '#/i18n';
import { useApolloClient } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { t as tGlobal } from '#/i18n';
import { useDeferredSearch } from '#features/recipes/hooks/useDeferredSearch';
import { pantryItemSearch } from '#utils/searchUtils';
import { useRecipeDiscovery } from '#features/recipes/hooks/useRecipeDiscovery';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';
import { useRecipeFilters } from '#features/recipes/hooks/useRecipeFilters';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import {} from '#features/recipes/graphql/recipe.generated';
import {} from '#features/recipes/store/useRecipeCacheStore';
import { useUserId } from '#store/useAppStore';
import type { IconName } from '#/utils/iconUtils';
import { Diet, Intolerance } from '#/graphql/generated/schemaTypes';
import {
  type RecipeFilters,
  DIET_ENUM_TO_SPOONACULAR,
  INTOLERANCE_ENUM_TO_SPOONACULAR,
} from '#features/recipes/utils/recipeFilterMaps';
import { isLifestyleDiet } from '#domain/dietary';
import { type DisplayItem } from '#features/recipes/utils/recipeDisplayTransforms';
import {
  EMPTY_PAGINATION,
  executeRecipeIngredientSearch,
  executeRecipeLoadMore,
  executeRecipeTextSearch,
  type SearchPagination,
} from '#features/recipes/utils/recipeSearchPaging';

// ── Module-level search helpers (React Compiler safe) ──

// ── Facade hook ──

export function useRecipeScreen() {
  const { t } = useTranslation();

  // ── User ──
  const userId = useUserId();

  // Apollo client for the imperative local-API search in executeRecipeTextSearch
  const client = useApolloClient();

  // Monotonic token that supersedes in-flight text searches. Every fresh search
  // (new query, filter re-run, refresh) bumps it and captures the value; a
  // search only commits its results if its captured value is still current.
  const searchGenerationRef = useRef(0);

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
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  // Rows and cursors live in ONE atom because they advance together, so a
  // resolved load-more commits both atomically — and pagination identity is
  // what tells it a new search replaced the state mid-flight, so the stale page
  // is dropped instead of corrupting the new list.
  const [searchData, setSearchData] = useState<{
    items: DisplayItem[];
    pagination: SearchPagination;
  }>({ items: [], pagination: EMPTY_PAGINATION });
  const searchResults = searchData.items;
  const searchPagination = searchData.pagination;
  // Guards against overlapping load-more calls (onEndReached can fire several
  // times before the next page resolves) and re-appending the same page.
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
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
  // transforms). A fresh search replaces the list and resets pagination (the
  // cursors come from executeRecipeTextSearch via setSearchPagination).
  const setDisplayResults = (displayItems: DisplayItem[]) => {
    setSearchData(prev => ({ ...prev, items: displayItems }));
  };

  const setSearchPagination = (pagination: SearchPagination) => {
    setSearchData(prev => ({ ...prev, pagination }));
  };

  // Re-run the current search with an explicit filter set (state updates are
  // async, so the caller passes the next filters rather than reading state).
  const rerunSearchWithFilters = async (nextFilters: RecipeFilters) => {
    if (!searchPerformed || !searchQuery.trim()) return;
    const generation = (searchGenerationRef.current += 1);
    await executeRecipeTextSearch(
      searchQuery,
      nextFilters,
      client,
      setSearchLoading,
      setSearchPerformed,
      setDisplayResults,
      setSearchPagination,
      () => generation === searchGenerationRef.current,
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

  // Results are pre-transformed at data arrival (see setDisplayResults) — the
  // whole list is shown; pagination is real, not a client-side slice.
  const searchItems = showSearchResults ? searchResults : [];

  // More remains while EITHER source still has a page to fetch.
  const searchHasMore =
    showSearchResults &&
    (searchPagination.localHasNextPage ||
      searchPagination.spoonacularOffset < searchPagination.spoonacularTotal);

  // Fetch the next page from each source, dedupe the new rows against what's
  // already shown, and append. The loadingMore flag drops re-entrant calls
  // (onEndReached can fire repeatedly mid-fetch).
  const loadMoreSearch = async () => {
    if (!searchHasMore || searchLoadingMore) return;
    const captured = searchPagination;
    // executeWithLoadingState guarantees searchLoadingMore is cleared even if
    // the map/dedup step throws synchronously — otherwise a single throw would
    // leave the guard stuck and disable load-more permanently.
    await executeWithLoadingState(async () => {
      const outcome = await executeRecipeLoadMore(captured, client);
      if (!outcome) return;
      // Commit rows + cursors together, and only if the pagination is still
      // the one this fetch started from — a new search or clear mid-flight
      // replaced it, and this page belongs to the old query.
      setSearchData(prev =>
        prev.pagination === captured
          ? {
              items: [...prev.items, ...outcome.items],
              pagination: outcome.nextPagination,
            }
          : prev,
      );
    }, setSearchLoadingMore);
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

    const generation = (searchGenerationRef.current += 1);
    await executeRecipeTextSearch(
      query,
      activeFilters,
      client,
      setSearchLoading,
      setSearchPerformed,
      setDisplayResults,
      setSearchPagination,
      () => generation === searchGenerationRef.current,
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

    // Ingredient search is a single non-paginated Spoonacular call — clear any
    // text-search pagination so the list doesn't try to "load more".
    setSearchPagination(EMPTY_PAGINATION);

    // Join the generation scheme: bump so any in-flight text search is
    // superseded, and capture so a text search fired after this one supersedes
    // this ingredient search's commit.
    const generation = (searchGenerationRef.current += 1);
    await executeRecipeIngredientSearch(
      ingredientString,
      setSearchLoading,
      setSearchPerformed,
      setDisplayResults,
      () => generation === searchGenerationRef.current,
    );
  };

  const handleRefresh = async () => {
    if (searchPerformed) {
      if (searchQuery.trim()) {
        const generation = (searchGenerationRef.current += 1);
        await executeRecipeTextSearch(
          searchQuery,
          activeFilters,
          client,
          setSearchLoading,
          setSearchPerformed,
          setDisplayResults,
          setSearchPagination,
          () => generation === searchGenerationRef.current,
        );
      }
    } else {
      discovery.refresh();
    }
  };

  const clearSearch = () => {
    // Bump the generation so any in-flight text search is superseded and can't
    // re-populate the list after the user has cleared it.
    searchGenerationRef.current += 1;
    setSearchQuery('');
    setSearchPerformed(false);
    setSearchData({ items: [], pagination: EMPTY_PAGINATION });
    // Clear the loading flag too — a search cleared mid-flight would otherwise
    // leave the empty state stuck on the "searching…" spinner.
    setSearchLoading(false);
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
    searchLoadingMore,
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
