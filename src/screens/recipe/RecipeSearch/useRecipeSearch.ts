import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useAppNavigation, useDefaultHome, usePantryManagement } from '#hooks';
import { useDietaryProfile } from '#/hooks/profile/useDietaryProfile';
import { spoonacularService } from '#/services/recipeApi';
import type { SearchRecipesResult, RecipeSearchResult } from '#/services/recipeApi/types';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useScreenTransition } from '#hooks/performance';
import { useGetHomeQuery, ReligiousDiet } from '#generated';
import { transformRecipeForDisplay } from '#/utils/recipeTransform';

type RecipeSearchRouteProp = RouteProp<
  { RecipeSearch: { initialQuery?: string } },
  'RecipeSearch'
>;

export interface RecipeFilters {
  diet: string | null;
  intolerances: string[];
  mealType: string | null;
  maxReadyTime: number | null;
}

export function useRecipeSearch() {
  const { navigate } = useAppNavigation();
  const { selectedHomeId, getDefaultPantry } = useDefaultHome();
  const route = useRoute<RecipeSearchRouteProp>();
  const initialQuery = route.params?.initialQuery || '';

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
  const { allItems: pantryItems } = usePantryManagement(defaultPantry?.id);

  // Get dietary profile for filter defaults
  const { profile: dietaryProfile } = useDietaryProfile();

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<(SearchRecipesResult | RecipeSearchResult)[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());

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
  const hasInitializedFiltersRef = useRef(false);

  // Memoize excluded ingredients
  const excludedIngredients = useMemo(() => {
    const restrictions = dietaryProfile?.restrictions || [];
    const excluded: string[] = [];

    for (const restriction of restrictions) {
      const religionDiet = restriction.diet as unknown as ReligiousDiet | null;

      if (religionDiet === ReligiousDiet.Halal) {
        excluded.push(
          'pork', 'bacon', 'ham', 'sausage', 'pepperoni', 'prosciutto',
          'alcohol', 'wine', 'beer', 'vodka', 'rum', 'whiskey', 'brandy',
          'gelatin', 'lard',
        );
      } else if (religionDiet === ReligiousDiet.Kosher) {
        excluded.push(
          'pork', 'bacon', 'ham', 'sausage', 'pepperoni',
          'shellfish', 'shrimp', 'crab', 'lobster', 'clam', 'oyster',
          'squid', 'octopus', 'catfish',
        );
      }
    }

    return excluded;
  }, [dietaryProfile?.restrictions]);

  // Initialize filters from dietary profile
  useEffect(() => {
    if (!dietaryProfile || hasInitializedFiltersRef.current) return;

    const restrictions = dietaryProfile.restrictions || [];
    let diet: string | null = null;
    const intolerances: string[] = [];

    for (const restriction of restrictions) {
      if (restriction.diet && !diet) {
        diet = restriction.diet.toLowerCase().replace(/_/g, ' ');
      }
      if (restriction.intolerance) {
        intolerances.push(restriction.intolerance.toLowerCase().replace(/_/g, ' '));
      }
    }

    let maxReadyTime: number | null = null;
    if (dietaryProfile.maxCookTimeMinutes) {
      const cookTime = dietaryProfile.maxCookTimeMinutes;
      if (cookTime <= 15) maxReadyTime = 15;
      else if (cookTime <= 30) maxReadyTime = 30;
      else if (cookTime <= 45) maxReadyTime = 45;
      else if (cookTime <= 60) maxReadyTime = 60;
    }

    if (diet || intolerances.length > 0 || maxReadyTime) {
      setActiveFilters({ diet, intolerances, mealType: null, maxReadyTime });
    }

    hasInitializedFiltersRef.current = true;
  }, [dietaryProfile]);

  // Text-based search
  const handleTextSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Search Required', 'Please enter a search term');
      return;
    }

    setLoading(true);
    setSearchPerformed(true);

    try {
      const data = await spoonacularService.searchRecipes({
        query: searchQuery,
        number: 10,
        addRecipeInformation: true,
        ...(activeFilters.diet && { diet: activeFilters.diet }),
        ...(activeFilters.intolerances.length > 0 && {
          intolerances: activeFilters.intolerances.join(','),
        }),
        ...(activeFilters.mealType && { type: activeFilters.mealType }),
        ...(activeFilters.maxReadyTime && { maxReadyTime: activeFilters.maxReadyTime }),
        ...(excludedIngredients.length > 0 && {
          excludeIngredients: excludedIngredients.join(','),
        }),
      });

      setSearchResults(data.results || []);
    } catch (error: any) {
      console.error('Search error:', error);
      if (error.isQuotaExceeded) {
        Alert.alert('API Limit Reached', 'Spoonacular API quota exceeded. Please try again later.');
      } else if (error.isRateLimitError) {
        Alert.alert('Rate Limit', 'Too many requests. Please try again in a moment.');
      } else {
        Alert.alert('Search Error', 'Failed to search recipes. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeFilters, excludedIngredients]);

  // Auto-trigger search if initialQuery is provided
  useEffect(() => {
    if (initialQuery && initialQuery.trim() && !hasAutoSearchedRef.current) {
      hasAutoSearchedRef.current = true;
      handleTextSearch();
    }
  }, [initialQuery, handleTextSearch]);

  // Ingredient-based search
  const handleIngredientSearch = useCallback(async () => {
    if (selectedIngredients.size === 0) {
      Alert.alert('No Ingredients Selected', 'Please select at least one ingredient');
      return;
    }

    const ingredientString = Array.from(selectedIngredients).join(',');

    setLoading(true);
    setSearchPerformed(true);
    ingredientSheetRef.current?.close();

    try {
      const results = await spoonacularService.searchRecipesByIngredients({
        ingredients: ingredientString,
        number: 10,
        ...(activeFilters.diet && { diet: activeFilters.diet }),
        ...(activeFilters.intolerances.length > 0 && {
          intolerances: activeFilters.intolerances.join(','),
        }),
        ...(activeFilters.mealType && { type: activeFilters.mealType }),
        ...(activeFilters.maxReadyTime && { maxReadyTime: activeFilters.maxReadyTime }),
        ...(excludedIngredients.length > 0 && {
          excludeIngredients: excludedIngredients.join(','),
        }),
      });

      setSearchResults(results);
    } catch (error: any) {
      console.error('Ingredient search error:', error);
      if (error.isQuotaExceeded) {
        Alert.alert('API Limit Reached', 'Spoonacular API quota exceeded. Please try again later.');
      } else if (error.isRateLimitError) {
        Alert.alert('Rate Limit', 'Too many requests. Please try again in a moment.');
      } else {
        Alert.alert('Search Error', 'Failed to search recipes. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedIngredients, activeFilters, excludedIngredients]);

  const openIngredientSelector = useCallback(() => {
    if (!pantryItems || pantryItems.length === 0) {
      Alert.alert('No Pantry Items', 'Add items to your pantry first to search by ingredients.');
      return;
    }
    ingredientSheetRef.current?.present();
  }, [pantryItems]);

  const toggleIngredient = useCallback((itemName: string) => {
    setSelectedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(itemName)) {
        next.delete(itemName);
      } else {
        next.add(itemName);
      }
      return next;
    });
  }, []);

  const openFilterSheet = useCallback(() => {
    filterSheetRef.current?.present();
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters({
      diet: null,
      intolerances: [],
      mealType: null,
      maxReadyTime: null,
    });
  }, []);

  const applyFilters = useCallback(() => {
    filterSheetRef.current?.dismiss();
    if (searchQuery.trim()) {
      handleTextSearch();
    } else if (selectedIngredients.size > 0) {
      handleIngredientSearch();
    }
  }, [searchQuery, selectedIngredients, handleTextSearch, handleIngredientSearch]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilters.diet) count++;
    if (activeFilters.intolerances.length > 0) count += activeFilters.intolerances.length;
    if (activeFilters.mealType) count++;
    if (activeFilters.maxReadyTime) count++;
    return count;
  }, [activeFilters]);

  // Transform results to list items
  const items = useMemo(() => {
    return searchResults.map(recipe => transformRecipeForDisplay(recipe));
  }, [searchResults]);

  const handleItemPress = useCallback(
    (id: string) => {
      const item = items.find(i => i.id === id);
      if (!item) return;

      navigate('RecipeDetail', {
        externalSource: 'SPOONACULAR',
        externalId: String(item.spoonacularId),
      });
    },
    [items, navigate],
  );

  return {
    navigate,
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
    items,
    handleItemPress,
  };
}
