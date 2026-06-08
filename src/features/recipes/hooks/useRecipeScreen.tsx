import { useState } from 'react';

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
import { transformRecipeForDisplay } from '#/utils/recipeTransform';
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
  type Diet,
  type Intolerance,
} from '#/graphql/generated/schemaTypes';

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

type LocalRecipeNode =
  SearchRecipesQuery['searchRecipes']['edges'][number]['node'];

/** Transform Spoonacular search results into display items */
function toSpoonacularDisplayItems(
  results: (SearchRecipesResult | RecipeSearchResult)[],
): DisplayItem[] {
  return results.map(recipe => {
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
}

type SpoonacularRecipe = SearchRecipesResult | RecipeSearchResult;

/** Spoonacular's popularity count — `likes` on ingredient-search results,
 * `aggregateLikes` on text-search results. `usedIngredientCount` is the
 * required field that distinguishes the two shapes (same discriminant as
 * recipeTransform). */
function spoonacularLikes(recipe: SpoonacularRecipe): number | undefined {
  return 'usedIngredientCount' in recipe ? recipe.likes : recipe.aggregateLikes;
}

/** Transform local API recipe nodes into display items, mirroring the
 * Spoonacular subtitle format. The `local-` id prefix keeps these
 * collision-free against `spoonacular-<n>` ids and lets the press handler
 * route to the backend recipe detail view.
 *
 * Backend (imported) recipes are missing time/likes — the import only stores
 * Spoonacular's prep/cook breakdown (usually empty) and keeps the like count
 * inside an opaque JSON blob. `enrichmentFor` supplies the matching live
 * Spoonacular result so the row can borrow its `readyInMinutes` + like count
 * and look identical to a native Spoonacular row. */
function toLocalDisplayItems(
  nodes: LocalRecipeNode[],
  enrichmentFor: (node: LocalRecipeNode) => SpoonacularRecipe | undefined,
): DisplayItem[] {
  return nodes.map(node => {
    const match = enrichmentFor(node);
    const matchTime =
      match && 'readyInMinutes' in match ? match.readyInMinutes : undefined;
    const matchLikes = match ? spoonacularLikes(match) : undefined;

    const totalTime = node.totalTimeMinutes ?? matchTime;
    const subtitleParts: string[] = [];
    if (totalTime) {
      subtitleParts.push(`⏱ ${totalTime} ${tGlobal('recipes.minutes')}`);
    }
    if (node.servings) {
      subtitleParts.push(
        `${node.servings} ${tGlobal('recipes.servingsSuffix')}`,
      );
    }

    // Saved recipes keep the green "Saved" badge; otherwise borrow the live
    // Spoonacular like count so the row carries the same ❤️ as its twin.
    // Backend search results are the app's recipe corpus, not the user's own,
    // so an unconditional "My recipe" badge would mislabel them.
    const badge: DisplayItem['badge'] = node.isSaved
      ? { text: tGlobal('recipes.savedBadge'), variant: 'success' }
      : matchLikes && matchLikes > 0
      ? { text: `❤️ ${matchLikes}`, variant: 'primary' }
      : undefined;

    return {
      id: `local-${node.id}`,
      title: node.name,
      subtitle: subtitleParts.join(' • '),
      badge,
      imageUrl: node.imageUrl ?? undefined,
    };
  });
}

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

  // Local API search — the user's own recipes. `searchRecipes` takes only a
  // text query (no diet/intolerance params), so local results are shown
  // regardless of active filters. Failures (offline, API unreachable) resolve
  // to null and degrade silently — Spoonacular results still display.
  const localPromise = executeSearchQuery<SearchRecipesQuery>(
    () =>
      client.query<SearchRecipesQuery>({
        query: SearchRecipesDocument,
        variables: { query, first: SEARCH_FETCH_SIZE },
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
              ...(filters.diet.length > 0 && { diet: filters.diet.join('|') }),
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
      console.error('Search error (Spoonacular degraded):', spoonacularError);
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
  const { t } = useTranslation();

  // ── User ──
  const userId = useUserId();

  // Apollo client for the imperative local-API search in executeRecipeTextSearch
  const client = useApolloClient();

  // ── Dietary profile (for filter defaults + discovery tags) ──
  const { profile: dietaryProfile } = useDietaryProfile();

  // Compute dietary tags once for discovery (random recipe API)
  const dietRestriction = dietaryProfile?.restrictions?.find(r => r.diet);
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
    .filter((r): r is typeof r & { diet: Diet } => Boolean(r.diet))
    .map(r => dietMap[r.diet] ?? r.diet.toLowerCase())
    .filter(Boolean);

  const profileIntolerances = (dietaryProfile?.restrictions ?? [])
    .filter((r): r is typeof r & { intolerance: Intolerance } =>
      Boolean(r.intolerance),
    )
    .map(r => {
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
      client,
      setSearchLoading,
      setSearchPerformed,
      setDisplayResultsAndResetPage,
    );
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

  const removeFilter = (
    kind: 'diet' | 'intolerance' | 'mealType' | 'maxReadyTime',
    value?: string,
  ) => {
    const next: RecipeFilters = {
      diet:
        kind === 'diet'
          ? activeFilters.diet.filter(d => d !== value)
          : activeFilters.diet,
      intolerances:
        kind === 'intolerance'
          ? activeFilters.intolerances.filter(i => i !== value)
          : activeFilters.intolerances,
      mealType: kind === 'mealType' ? null : activeFilters.mealType,
      maxReadyTime: kind === 'maxReadyTime' ? null : activeFilters.maxReadyTime,
    };
    setActiveFilters(next);
    rerunSearchWithFilters(next);
  };

  const clearFiltersAndSearchAgain = () => {
    setActiveFilters(DEFAULT_FILTERS);
    rerunSearchWithFilters(DEFAULT_FILTERS);
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

  // Results arrive pre-transformed into DisplayItems (see the module-level
  // transforms) — store them and reset the client-side pagination window.
  const setDisplayResultsAndResetPage = (displayItems: DisplayItem[]) => {
    setSearchResults(displayItems);
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
