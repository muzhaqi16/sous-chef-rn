import { useState } from 'react';

import { alertService } from '#/services/alertService';
import { useDeferredSearch } from '#hooks/performance/useDeferredSearch';
import { pantryItemSearch } from '#utils/searchUtils';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type {
  SearchRecipesResult,
  RecipeSearchResult,
} from '#/services/recipeApi/types';
import { useRecipeDiscovery } from '#features/recipes/hooks/useRecipeDiscovery';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';
import { transformRecipeForDisplay } from '#/utils/recipeTransform';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import {
  useRecipeCacheStore,
  textSearchCacheKey,
  ingredientCacheKey,
} from '#/store/useRecipeCacheStore';
import { useAppStore } from '#store/useAppStore';
import type { IconName } from '#/utils/iconUtils';

// ── Filter types ──

export interface RecipeFilters {
  diet: string[];
  intolerances: string[];
  mealType: string | null;
  maxReadyTime: number | null;
}

const DEFAULT_FILTERS: RecipeFilters = {
  diet: [],
  intolerances: [],
  mealType: null,
  maxReadyTime: null,
};

// ── Module-level search helpers (React Compiler safe) ──

function handleSearchError(error: unknown, label: string): void {
  const err = error as {
    isQuotaExceeded?: boolean;
    isRateLimitError?: boolean;
  };
  console.error(`${label}:`, error);
  if (err.isQuotaExceeded) {
    alertService.alert(
      'API Limit Reached',
      'Spoonacular API quota exceeded. Please try again later.',
    );
  } else if (err.isRateLimitError) {
    alertService.alert(
      'Rate Limit',
      'Too many requests. Please try again in a moment.',
    );
  } else {
    alertService.alert(
      'Search Error',
      'Failed to search recipes. Please try again.',
    );
  }
}

const SEARCH_FETCH_SIZE = 25;
const SEARCH_PAGE_SIZE = 15;

async function executeRecipeTextSearch(
  query: string,
  filters: RecipeFilters,
  setLoading: (v: boolean) => void,
  setSearchPerformed: (v: boolean) => void,
  setSearchResults: (v: (SearchRecipesResult | RecipeSearchResult)[]) => void,
): Promise<void> {
  setLoading(true);
  setSearchPerformed(true);

  // Check cache first
  const cacheKey = textSearchCacheKey(query, filters);
  const cacheStore = useRecipeCacheStore.getState();
  const cached = cacheStore.getCached(cacheKey);

  if (cached) {
    setSearchResults(cached.results);
    setLoading(false);
    return;
  }

  await executeMutation(
    async () => {
      const data = await spoonacularService.searchRecipes({
        query,
        number: SEARCH_FETCH_SIZE,
        addRecipeInformation: true,
        ...(filters.diet.length > 0 && { diet: filters.diet.join('|') }),
        ...(filters.intolerances.length > 0 && {
          intolerances: filters.intolerances.join(','),
        }),
        ...(filters.mealType && { type: filters.mealType }),
        ...(filters.maxReadyTime && {
          maxReadyTime: filters.maxReadyTime,
        }),
      });
      const results = data.results || [];
      setSearchResults(results);
      cacheStore.setCached(cacheKey, results);
      return data;
    },
    error => handleSearchError(error, 'Search error'),
  );

  setLoading(false);
}

async function executeRecipeIngredientSearch(
  ingredientString: string,
  setLoading: (v: boolean) => void,
  setSearchPerformed: (v: boolean) => void,
  setSearchResults: (v: (SearchRecipesResult | RecipeSearchResult)[]) => void,
): Promise<void> {
  setLoading(true);
  setSearchPerformed(true);

  // Check cache first
  const cacheKey = ingredientCacheKey(ingredientString);
  const cacheStore = useRecipeCacheStore.getState();
  const cached = cacheStore.getCached(cacheKey);

  if (cached) {
    setSearchResults(cached.results);
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
      setSearchResults(results);
      cacheStore.setCached(cacheKey, results);
      return results;
    },
    error => handleSearchError(error, 'Ingredient search error'),
  );

  setLoading(false);
}

// ── Display item type ──

interface DisplayItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
  imageUrl?: string;
}

// ── Facade hook ──

export function useRecipeScreen() {
  // ── User ──
  const userId = useAppStore(state => state.user?.id);

  // ── Dietary profile (for filter defaults + discovery tags) ──
  const { profile: dietaryProfile } = useDietaryProfile();

  // Compute dietary tags once for discovery (random recipe API)
  const dietRestriction = dietaryProfile?.restrictions?.find(
    (r: any) => r.diet,
  );
  const dietaryTags = dietRestriction?.diet
    ? dietRestriction.diet.toLowerCase()
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

  // ── Filter state (initialized from dietary profile) ──
  // Map GraphQL enum values to Spoonacular API values
  const dietMap: Record<string, string> = {
    VEGETARIAN: 'vegetarian',
    VEGAN: 'vegan',
    GLUTEN_FREE: 'gluten free',
    KETO: 'ketogenic',
    PALEO: 'paleo',
    PESCETARIAN: 'pescetarian',
    LACTO_VEGETARIAN: 'lacto-vegetarian',
    OVO_VEGETARIAN: 'ovo-vegetarian',
    PRIMAL: 'primal',
    LOW_FODMAP: 'low fodmap',
    WHOLE30: 'whole30',
  };

  const profileDiets = (dietaryProfile?.restrictions ?? [])
    .filter((r: any) => r.diet)
    .map((r: any) => dietMap[r.diet] ?? r.diet.toLowerCase())
    .filter(Boolean);

  const profileIntolerances = (dietaryProfile?.restrictions ?? [])
    .filter((r: any) => r.intolerance)
    .map((r: any) => {
      const intoleranceMap: Record<string, string> = {
        DAIRY: 'dairy',
        EGG: 'egg',
        GLUTEN: 'gluten',
        GRAIN: 'grain',
        PEANUT: 'peanut',
        SEAFOOD: 'seafood',
        SESAME: 'sesame',
        SHELLFISH: 'shellfish',
        SOY: 'soy',
        SULFITE: 'sulfite',
        TREE_NUT: 'tree nut',
        WHEAT: 'wheat',
        FISH: 'fish',
      };
      return intoleranceMap[r.intolerance] ?? r.intolerance.toLowerCase();
    });

  const profileMaxTime = dietaryProfile?.maxCookTimeMinutes ?? null;

  const [activeFilters, setActiveFilters] =
    useState<RecipeFilters>(DEFAULT_FILTERS);
  const [profileSynced, setProfileSynced] = useState(false);

  // Sync filters from dietary profile once loaded (adjusting state during render)
  if (!profileSynced && dietaryProfile) {
    const hasProfileData =
      profileDiets.length > 0 ||
      profileIntolerances.length > 0 ||
      profileMaxTime;
    if (hasProfileData) {
      setActiveFilters({
        diet: profileDiets,
        intolerances: profileIntolerances,
        mealType: null,
        maxReadyTime: profileMaxTime,
      });
    }
    setProfileSynced(true);
  }

  const activeFilterCount =
    activeFilters.diet.length +
    activeFilters.intolerances.length +
    (activeFilters.mealType ? 1 : 0) +
    (activeFilters.maxReadyTime ? 1 : 0);

  const clearFilters = () => {
    setActiveFilters(DEFAULT_FILTERS);
  };

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
      setSearchLoading,
      setSearchPerformed,
      setSearchResultsAndResetPage,
    );
  };

  const handleIngredientSearch = async () => {
    if (selectedIngredients.size === 0) {
      alertService.alert(
        'No Ingredients Selected',
        'Please select at least one ingredient',
      );
      return;
    }

    const ingredientString = Array.from(selectedIngredients).join(',');

    await executeRecipeIngredientSearch(
      ingredientString,
      setSearchLoading,
      setSearchPerformed,
      setSearchResultsAndResetPage,
    );
  };

  const handleRefresh = async () => {
    if (searchPerformed) {
      if (searchQuery.trim()) {
        await executeRecipeTextSearch(
          searchQuery,
          activeFilters,
          setSearchLoading,
          setSearchPerformed,
          setSearchResultsAndResetPage,
        );
      }
    } else {
      discovery.refresh();
    }
  };

  // Transform + store results at data arrival time (avoids per-render transformation)
  const setSearchResultsAndResetPage = (
    results: (SearchRecipesResult | RecipeSearchResult)[],
  ) => {
    const transformed = results.map(recipe => {
      const t = transformRecipeForDisplay(recipe);
      return {
        id: t.id,
        title: t.title,
        subtitle: t.subtitle,
        badge: t.badge
          ? ({
              text: t.badge.text,
              variant: 'primary',
            } satisfies DisplayItem['badge'])
          : undefined,
        imageUrl: t.imageUrl,
      };
    });
    setSearchResults(transformed);
    setVisibleSearchCount(SEARCH_PAGE_SIZE);
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
        title: 'Searching...',
        description: 'Finding recipes for you',
      }
    : searchPerformed
    ? {
        icon: 'search-outline',
        title: 'No recipes found',
        description: 'Try a different search term or different ingredients',
      }
    : {
        icon: 'restaurant-outline',
        title: 'Discover Recipes',
        description: 'Search for recipes or browse suggestions',
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

    // Actions
    handleTextSearch,
    handleIngredientSearch,
    handleRefresh,
    clearSearch,
    toggleIngredient,
    clearSelectedIngredients,
  };
}
