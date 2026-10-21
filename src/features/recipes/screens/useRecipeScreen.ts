import { useState } from 'react';

import { useTranslation } from '#/i18n';
import { useAppStore } from '#store/useAppStore';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { t as tGlobal } from '#/i18n';
import { useDeferredSearch } from '#features/recipes/hooks/useDeferredSearch';
import { pantryItemSearch } from '#utils/searchUtils';
import { useRecipeDiscovery } from '#features/recipes/hooks/useRecipeDiscovery';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';
import { useRecipeFilters } from '#features/recipes/hooks/useRecipeFilters';
import {
  useRecipeSearch,
  type SearchOutcome,
} from '#features/recipes/hooks/useRecipeSearch';
import type { IconName } from '#components/atoms/Icon';
import type { Diet, Intolerance } from '#/graphql/generated/schemaTypes';
import type { RecipeFilters } from '#features/recipes/utils/recipeFilterOptions';
import { isLifestyleDiet } from '#domain/dietary';
import {
  MAX_CATALOG_INGREDIENTS,
  acceptedIngredientNames,
} from '#domain/catalogRecipes';
import { toDisplayItems, type DisplayItem } from './recipeDisplayItems';

/** Says why a search showed less than it could, in the screen's words. */
function presentSearchOutcome(outcome: SearchOutcome): void {
  if (outcome.status === 'shown') {
    // Held recipes show; the catalog's may on a later search.
    if (outcome.partial) {
      toastService.info(tGlobal('recipes.catalogUnavailable'));
    }
    return;
  }
  if (outcome.status !== 'failed') return;
  switch (outcome.failure) {
    case 'offline':
      // A modal would cover the screen's own offline state.
      toastService.info(tGlobal('errors.offlineSearchUnavailable'));
      return;
    case 'rateLimited':
      alertService.alert(
        tGlobal('recipes.rateLimitTitle'),
        tGlobal('recipes.rateLimitMessage'),
      );
      return;
    case 'failed':
      alertService.alert(
        tGlobal('errors.searchFailed'),
        tGlobal('recipes.searchErrorMessage'),
      );
      return;
  }
}

export function useRecipeScreen() {
  const { t } = useTranslation();
  const apiUnavailable = useAppStore(isApiUnavailable);

  // ── Dietary profile (for filter defaults + discovery tags) ──
  const { profile: dietaryProfile } = useDietaryProfile();

  // The profile's diets: at most one lifestyle diet (the first) plus every
  // constraint diet. Discovery and the search filters' seed share them, so the
  // two agree.
  const profileDiets = (dietaryProfile?.restrictions ?? []).flatMap(r =>
    r.diet ? [r.diet] : [],
  );
  const firstLifestyleDiet = profileDiets.find(isLifestyleDiet);
  const reconciledDiets: Diet[] = [
    ...(firstLifestyleDiet ? [firstLifestyleDiet] : []),
    ...profileDiets.filter(diet => !isLifestyleDiet(diet)),
  ];
  const profileIntolerances: Intolerance[] = (
    dietaryProfile?.restrictions ?? []
  ).flatMap(r => (r.intolerance ? [r.intolerance] : []));

  // ── Discovery (includes pantry data) ──
  const discovery = useRecipeDiscovery({
    diets: reconciledDiets,
    intolerances: profileIntolerances,
  });

  // ── Search ──
  const recipeSearch = useRecipeSearch();
  const {
    query: searchQuery,
    performed: searchPerformed,
    loading: searchLoading,
    loadingMore: searchLoadingMore,
  } = recipeSearch;
  // Written here, not when a page arrives, so the list follows a language change.
  const searchResults = toDisplayItems(recipeSearch.rows, t);
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

  // Re-run the current search with an explicit filter set (state updates are
  // async, so the caller passes the next filters rather than reading state).
  const rerunSearchWithFilters = async (nextFilters: RecipeFilters) => {
    if (!searchPerformed || !searchQuery.trim()) return;
    presentSearchOutcome(await recipeSearch.search(searchQuery, nextFilters));
  };

  // `useRecipeFilters` seeds itself from this the first time it carries data.
  const profileFilters: RecipeFilters | null = dietaryProfile
    ? {
        diet: reconciledDiets,
        intolerances: profileIntolerances,
        mealType: null,
        maxReadyTime: dietaryProfile.maxCookTimeMinutes ?? null,
      }
    : null;

  const {
    activeFilters,
    activeFilterCount,
    applyFilters,
    removeFilter,
    clearFiltersAndSearchAgain,
  } = useRecipeFilters({
    profileFilters,
    onApplyFilters: nextFilters => {
      // A search failure is an outcome the rerun presents, never thrown.
      void rerunSearchWithFilters(nextFilters);
    },
  });

  // ── Derived display state ──
  const showSearchResults = searchPerformed && searchResults.length > 0;
  const showDiscovery = !searchPerformed && discovery.rows.length > 0;

  // The whole list is shown; pagination is real, not a client-side slice.
  const searchItems = showSearchResults ? searchResults : [];

  const searchHasMore = showSearchResults && recipeSearch.hasMore;

  const items: DisplayItem[] = showSearchResults
    ? searchItems
    : showDiscovery
    ? toDisplayItems(discovery.rows, t)
    : [];

  // Image preloading is handled by ItemList internally — no duplicate effect needed

  // ── Actions ──
  const toggleIngredient = (name: string) => {
    // Counted as the API counts them, so a pick that adds no new name is kept.
    if (
      !selectedIngredients.has(name) &&
      acceptedIngredientNames([...selectedIngredients, name]).length >
        MAX_CATALOG_INGREDIENTS
    ) {
      toastService.info(
        t('recipes.ingredientLimitReached', { count: MAX_CATALOG_INGREDIENTS }),
      );
      return;
    }
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
    presentSearchOutcome(await recipeSearch.search(query, activeFilters));
  };

  const handleIngredientSearch = async () => {
    // A name the API would refuse is left out, so it alone cannot be searched.
    if (acceptedIngredientNames([...selectedIngredients]).length === 0) {
      alertService.alert(
        tGlobal('recipes.noIngredientsSelectedTitle'),
        tGlobal('recipes.selectAtLeastOneIngredient'),
      );
      return;
    }
    // The search clears the text query, so the active-filter row and the
    // filtered empty state stay scoped to text searches: filters don't apply.
    presentSearchOutcome(
      await recipeSearch.searchByIngredients(Array.from(selectedIngredients)),
    );
  };

  // The partial-results toast says to pull down: a pull goes on with a search
  // the catalog could not finish, and repeats any other.
  const handleRefresh = async () => {
    if (searchPerformed) {
      presentSearchOutcome(await recipeSearch.retry(activeFilters));
    } else {
      await discovery.refresh();
    }
  };

  const loadMoreSearch = async () => {
    presentSearchOutcome(await recipeSearch.loadMore());
  };

  // ── Empty state ──
  const emptyStateConfig: {
    icon: IconName;
    title: string;
    description: string;
    action?: { label: string; onPress: () => void };
  } = apiUnavailable
    ? {
        // Discovery and search both need the network. Saying "no recipes found"
        // offline blames the library for the connection.
        icon: 'cloud-offline-outline',
        title: t('errors.notAvailableOffline'),
        description: t('errors.offlineSearchUnavailable'),
      }
    : searchLoading
    ? {
        icon: 'search',
        title: t('recipes.searchingTitle'),
        description: t('recipes.searchingDescription'),
      }
    : searchPerformed && activeFilterCount > 0 && searchQuery.trim() !== ''
    ? {
        // No TEXT-search results under dietary filters: say why and offer a
        // one-tap recovery. Ingredient search takes no filters, so it falls to
        // the plain empty state.
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
    : discovery.failed
    ? {
        icon: 'alert-circle-outline',
        title: t('recipes.discoveryFailedTitle'),
        description: t('recipes.discoveryFailedDescription'),
      }
    : {
        icon: 'restaurant-outline',
        title: t('recipes.discoverTitle'),
        description: t('recipes.discoverDescription'),
      };

  return {
    // Data
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
    activeFilterCount,
    applyFilters,
    removeFilter,
    clearFiltersAndSearchAgain,

    // Actions
    handleTextSearch,
    handleIngredientSearch,
    handleRefresh,
    clearSearch: recipeSearch.clear,
    toggleIngredient,
    clearSelectedIngredients,
  };
}
