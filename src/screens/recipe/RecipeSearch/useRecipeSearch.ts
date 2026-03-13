import { useState, useRef, useEffect } from 'react';
import { alertService } from '#/services/alertService';
import { useRoute } from '@react-navigation/native';

import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useDefaultHome } from '#hooks/home/useDefaultHome';
import { usePantryManagement } from '#hooks/home/pantry/usePantryManagement';
import { useDietaryProfile } from '#/hooks/profile/useDietaryProfile';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type {
  SearchRecipesResult,
  RecipeSearchResult,
} from '#/services/recipeApi/types';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useGetHomeQuery, ReligiousDiet } from '#generated';
import { transformRecipeForDisplay } from '#/utils/recipeTransform';
import { executeMutation } from '#/utils/compilerSafeWrappers';

export interface RecipeFilters {
  diet: string | null;
  intolerances: string[];
  mealType: string | null;
  maxReadyTime: number | null;
}

/** Handles API error alerts — extracted for reuse across search functions */
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

/** Module-level pantry ingredient search — extracted for React Compiler compatibility */
async function executePantrySearch(
  ingredientNames: string,
  setLoading: (v: boolean) => void,
  setSearchPerformed: (v: boolean) => void,
  setSearchResults: (v: (SearchRecipesResult | RecipeSearchResult)[]) => void,
): Promise<void> {
  setLoading(true);
  setSearchPerformed(true);

  await executeMutation(
    async () => {
      const results = await spoonacularService.searchRecipesByIngredients({
        ingredients: ingredientNames,
        number: 10,
        ranking: 1,
        ignorePantry: true,
      });
      setSearchResults(results);
      return results;
    },
    error => handleSearchError(error, 'Pantry search error'),
  );

  setLoading(false);
}

/** Module-level text search — extracted for React Compiler compatibility */
async function executeTextSearch(
  query: string,
  activeFilters: RecipeFilters,
  excludedIngredients: string[],
  setLoading: (v: boolean) => void,
  setSearchPerformed: (v: boolean) => void,
  setSearchResults: (v: (SearchRecipesResult | RecipeSearchResult)[]) => void,
): Promise<void> {
  setLoading(true);
  setSearchPerformed(true);

  await executeMutation(
    async () => {
      const data = await spoonacularService.searchRecipes({
        query,
        number: 10,
        addRecipeInformation: true,
        ...(activeFilters.diet && { diet: activeFilters.diet }),
        ...(activeFilters.intolerances.length > 0 && {
          intolerances: activeFilters.intolerances.join(','),
        }),
        ...(activeFilters.mealType && { type: activeFilters.mealType }),
        ...(activeFilters.maxReadyTime && {
          maxReadyTime: activeFilters.maxReadyTime,
        }),
        ...(excludedIngredients.length > 0 && {
          excludeIngredients: excludedIngredients.join(','),
        }),
      });

      setSearchResults(data.results || []);
      return data;
    },
    error => handleSearchError(error, 'Search error'),
  );

  setLoading(false);
}

/** Module-level ingredient search — extracted for React Compiler compatibility */
async function executeIngredientSearch(
  ingredientString: string,
  activeFilters: RecipeFilters,
  excludedIngredients: string[],
  setLoading: (v: boolean) => void,
  setSearchPerformed: (v: boolean) => void,
  setSearchResults: (v: (SearchRecipesResult | RecipeSearchResult)[]) => void,
): Promise<void> {
  setLoading(true);
  setSearchPerformed(true);

  await executeMutation(
    async () => {
      const results = await spoonacularService.searchRecipesByIngredients({
        ingredients: ingredientString,
        number: 10,
        ...(activeFilters.diet && { diet: activeFilters.diet }),
        ...(activeFilters.intolerances.length > 0 && {
          intolerances: activeFilters.intolerances.join(','),
        }),
        ...(activeFilters.mealType && { type: activeFilters.mealType }),
        ...(activeFilters.maxReadyTime && {
          maxReadyTime: activeFilters.maxReadyTime,
        }),
        ...(excludedIngredients.length > 0 && {
          excludeIngredients: excludedIngredients.join(','),
        }),
      });

      setSearchResults(results);
      return results;
    },
    error => handleSearchError(error, 'Ingredient search error'),
  );

  setLoading(false);
}

export function useRecipeSearch() {
  const { navigate, goBack } = useAppNavigation();
  const {
    state: { selectedHomeId },
    actions: { getDefaultPantry },
  } = useDefaultHome();
  const route = useRoute();
  const initialQuery =
    (route.params as { initialQuery?: string } | undefined)?.initialQuery || '';

  // Track screen performance
  useScreenTransition('RecipeSearch');

  // Fetch home data to get pantries
  const { data: homeData } = useGetHomeQuery({
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

  // Get pantry for ingredient selection
  const defaultPantry = getDefaultPantry(homeData);
  const {
    state: { items: pantryItems },
  } = usePantryManagement(defaultPantry?.id);

  // Get dietary profile for filter defaults
  const { profile: dietaryProfile } = useDietaryProfile();

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<
    (SearchRecipesResult | RecipeSearchResult)[]
  >([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(
    new Set(),
  );

  // Filter state
  const [activeFilters, setActiveFilters] = useState<RecipeFilters>({
    diet: null,
    intolerances: [],
    mealType: null,
    maxReadyTime: null,
  });

  const ingredientSheetRef = useRef<BottomSheetModal>(null);
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const hasAutoSearchedRef = useRef(false);

  // Memoize excluded ingredients
  const excludedIngredients = (() => {
    const restrictions = dietaryProfile?.restrictions || [];
    const excluded: string[] = [];

    for (const restriction of restrictions) {
      const religionDiet = restriction.diet as unknown as ReligiousDiet | null;

      if (religionDiet === ReligiousDiet.Halal) {
        excluded.push(
          'pork',
          'bacon',
          'ham',
          'sausage',
          'pepperoni',
          'prosciutto',
          'alcohol',
          'wine',
          'beer',
          'vodka',
          'rum',
          'whiskey',
          'brandy',
          'gelatin',
          'lard',
        );
      } else if (religionDiet === ReligiousDiet.Kosher) {
        excluded.push(
          'pork',
          'bacon',
          'ham',
          'sausage',
          'pepperoni',
          'shellfish',
          'shrimp',
          'crab',
          'lobster',
          'clam',
          'oyster',
          'squid',
          'octopus',
          'catfish',
        );
      }
    }

    return excluded;
  })();

  // Note: Filters are NOT auto-initialized from dietary profile
  // User can manually apply filters via the filter sheet when needed
  // This allows unfiltered searches by default

  // Text-based search (with pantry fallback when empty)
  const handleTextSearch = async () => {
    // If no query, fall back to pantry ingredient search
    if (!searchQuery.trim()) {
      if (pantryItems?.length) {
        const ingredientNames = pantryItems
          .map(item => item.itemName)
          .filter(Boolean)
          .slice(0, 20)
          .join(',');

        if (ingredientNames) {
          await executePantrySearch(
            ingredientNames,
            setLoading,
            setSearchPerformed,
            setSearchResults,
          );
          return;
        }
      }
      alertService.alert(
        'Search Required',
        'Please enter a search term or add items to your pantry',
      );
      return;
    }

    await executeTextSearch(
      searchQuery,
      activeFilters,
      excludedIngredients,
      setLoading,
      setSearchPerformed,
      setSearchResults,
    );
  };

  // Auto-trigger search on mount
  useEffect(() => {
    if (hasAutoSearchedRef.current) return;

    if (initialQuery && initialQuery.trim()) {
      // Text search from navigation params
      hasAutoSearchedRef.current = true;
      executeTextSearch(
        initialQuery,
        activeFilters,
        excludedIngredients,
        setLoading,
        setSearchPerformed,
        setSearchResults,
      );
    } else if (pantryItems?.length) {
      // Auto-search with pantry ingredients
      const ingredientNames = pantryItems
        .map(item => item.itemName)
        .filter(Boolean)
        .slice(0, 20) // Limit to 20 ingredients for API
        .join(',');

      if (ingredientNames) {
        hasAutoSearchedRef.current = true;
        executePantrySearch(
          ingredientNames,
          setLoading,
          setSearchPerformed,
          setSearchResults,
        );
      }
    }
  }, [initialQuery, pantryItems, activeFilters, excludedIngredients]);

  // Ingredient-based search
  const handleIngredientSearch = async () => {
    if (selectedIngredients.size === 0) {
      alertService.alert(
        'No Ingredients Selected',
        'Please select at least one ingredient',
      );
      return;
    }

    const ingredientString = Array.from(selectedIngredients).join(',');
    ingredientSheetRef.current?.close();

    await executeIngredientSearch(
      ingredientString,
      activeFilters,
      excludedIngredients,
      setLoading,
      setSearchPerformed,
      setSearchResults,
    );
  };

  const hasPantryItems = (pantryItems?.length ?? 0) > 0;

  const openIngredientSelector = () => {
    ingredientSheetRef.current?.present();
  };

  const toggleIngredient = (itemName: string) => {
    setSelectedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(itemName)) {
        next.delete(itemName);
      } else {
        next.add(itemName);
      }
      return next;
    });
  };

  const openFilterSheet = () => {
    filterSheetRef.current?.present();
  };

  const clearFilters = () => {
    setActiveFilters({
      diet: null,
      intolerances: [],
      mealType: null,
      maxReadyTime: null,
    });
  };

  const applyFilters = () => {
    filterSheetRef.current?.dismiss();
    if (searchQuery.trim()) {
      handleTextSearch();
    } else if (selectedIngredients.size > 0) {
      handleIngredientSearch();
    }
  };

  const activeFilterCount = (() => {
    let count = 0;
    if (activeFilters.diet) count++;
    if (activeFilters.intolerances.length > 0)
      count += activeFilters.intolerances.length;
    if (activeFilters.mealType) count++;
    if (activeFilters.maxReadyTime) count++;
    return count;
  })();

  // Transform results to list items
  const items = (() => {
    return searchResults.map(recipe => transformRecipeForDisplay(recipe));
  })();

  const handleItemPress = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    navigate('RecipeDetail', {
      externalSource: 'SPOONACULAR',
      externalId: String(item.spoonacularId),
    });
  };

  return {
    navigate,
    goBack,
    searchQuery,
    setSearchQuery,
    loading,
    searchResults,
    searchPerformed,
    selectedIngredients,
    activeFilters,
    setActiveFilters,
    ingredientSheetRef,
    filterSheetRef,
    pantryItems,
    handleTextSearch,
    handleIngredientSearch,
    openIngredientSelector,
    toggleIngredient,
    openFilterSheet,
    clearFilters,
    applyFilters,
    activeFilterCount,
    hasPantryItems,
    items,
    handleItemPress,
  };
}
