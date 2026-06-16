import { useState } from 'react';
import {
  type RecipeFilters,
  DEFAULT_FILTERS,
} from '#features/recipes/utils/recipeFilterMaps';

interface UseRecipeFiltersArgs {
  /** Filters normalized from the dietary profile, or null until it loads.
   *  Applied once — the first time it arrives carrying data. */
  profileFilters: RecipeFilters | null;
  /** Re-run the active search with a new filter set. The filter mutators call
   *  this so removing/clearing a filter immediately refreshes results. Search
   *  execution lives in the orchestrator; this hook only signals intent
   *  (dependency inversion), keeping it independent of the search pipeline. */
  onApplyFilters: (next: RecipeFilters) => void;
}

/**
 * Owns recipe filter state and the operations on it (count, clear, remove,
 * clear-and-research). The dietary-profile → filter normalization and the
 * search pipeline both live in the caller; this hook just holds the state and
 * the pure transitions, so it can be exercised in isolation.
 */
export function useRecipeFilters({
  profileFilters,
  onApplyFilters,
}: UseRecipeFiltersArgs) {
  const [activeFilters, setActiveFilters] =
    useState<RecipeFilters>(DEFAULT_FILTERS);
  const [profileSynced, setProfileSynced] = useState(false);

  // Seed filters from the dietary profile once it loads (adjusting state
  // during render — the "store info from previous renders" pattern).
  if (!profileSynced && profileFilters) {
    const hasProfileData =
      profileFilters.diet.length > 0 ||
      profileFilters.intolerances.length > 0 ||
      profileFilters.maxReadyTime;
    if (hasProfileData) {
      setActiveFilters(profileFilters);
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
    onApplyFilters(next);
  };

  const clearFiltersAndSearchAgain = () => {
    setActiveFilters(DEFAULT_FILTERS);
    onApplyFilters(DEFAULT_FILTERS);
  };

  return {
    activeFilters,
    setActiveFilters,
    activeFilterCount,
    clearFilters,
    removeFilter,
    clearFiltersAndSearchAgain,
  };
}
