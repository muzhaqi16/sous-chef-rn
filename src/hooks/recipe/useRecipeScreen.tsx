import { useState } from 'react';
import { View } from 'react-native';

import { alertService } from '#/services/alertService';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type {
  SearchRecipesResult,
  RecipeSearchResult,
} from '#/services/recipeApi/types';
import { useRecipeDiscovery } from '#/hooks/recipe/useRecipeDiscovery';
import { useDietaryProfile } from '#hooks/profile/useDietaryProfile';
import { transformRecipeForDisplay } from '#/utils/recipeTransform';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { commonStyles } from '#/styles/commonStyles';
import { CachedImage } from '#components/atoms/CachedImage';
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

async function executeRecipeTextSearch(
  query: string,
  filters: RecipeFilters,
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
        ...(filters.diet.length > 0 && { diet: filters.diet.join('|') }),
        ...(filters.intolerances.length > 0 && {
          intolerances: filters.intolerances.join(','),
        }),
        ...(filters.mealType && { type: filters.mealType }),
        ...(filters.maxReadyTime && {
          maxReadyTime: filters.maxReadyTime,
        }),
      });
      setSearchResults(data.results || []);
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

  await executeMutation(
    async () => {
      // Note: findByIngredients API does NOT support diet/intolerance/mealType filters
      const results = await spoonacularService.searchRecipesByIngredients({
        ingredients: ingredientString,
        number: 10,
        ranking: 1,
        ignorePantry: true,
      });
      setSearchResults(results);
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
  leftElement?: React.ReactElement;
}

// ── Facade hook ──

export function useRecipeScreen() {
  // ── User ──
  const userId = useAppStore(state => state.user?.id);

  // ── Dietary profile (for filter defaults) ──
  const { profile: dietaryProfile } = useDietaryProfile();

  // ── Discovery (includes pantry data) ──
  const discovery = useRecipeDiscovery();

  // ── Search state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    (SearchRecipesResult | RecipeSearchResult)[]
  >([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(
    new Set(),
  );

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

  // Transform search results
  const searchItems: DisplayItem[] = showSearchResults
    ? searchResults.map(recipe => {
        const transformed = transformRecipeForDisplay(recipe);
        return {
          id: transformed.id,
          title: transformed.title,
          subtitle: transformed.subtitle,
          badge: transformed.badge
            ? { text: transformed.badge.text, variant: 'primary' as 'primary' }
            : undefined,
          leftElement: transformed.imageUrl ? (
            <View style={commonStyles.listItemImageContainerCompact}>
              <CachedImage
                uri={transformed.imageUrl}
                style={commonStyles.listItemImageCompact}
                displaySize={48}
              />
            </View>
          ) : undefined,
        };
      })
    : [];

  // Transform discovery items
  const discoveryDisplayItems: DisplayItem[] = showDiscovery
    ? discovery.items.map(item => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        badge: item.badge,
        leftElement: item.imageUrl ? (
          <View style={commonStyles.listItemImageContainerCompact}>
            <CachedImage
              uri={item.imageUrl}
              style={commonStyles.listItemImageCompact}
              displaySize={48}
            />
          </View>
        ) : undefined,
      }))
    : [];

  const items = showSearchResults
    ? searchItems
    : showDiscovery
    ? discoveryDisplayItems
    : [];

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

  const handleTextSearch = async () => {
    if (!searchQuery.trim()) {
      if (discovery.hasPantryItems) {
        const ingredientNames = discovery.pantryItems
          .map((item: any) => item.itemName)
          .filter(Boolean)
          .slice(0, 20)
          .join(',');

        if (ingredientNames) {
          await executeRecipeIngredientSearch(
            ingredientNames,
            setSearchLoading,
            setSearchPerformed,
            setSearchResults,
          );
          return;
        }
      }
      alertService.alert(
        'Search Required',
        'Please enter a search term or select pantry ingredients',
      );
      return;
    }

    await executeRecipeTextSearch(
      searchQuery,
      activeFilters,
      setSearchLoading,
      setSearchPerformed,
      setSearchResults,
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
      setSearchResults,
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
          setSearchResults,
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
    items,

    // Search state
    searchQuery,
    setSearchQuery,
    searchResults,
    searchPerformed,
    searchLoading,
    selectedIngredients,

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
  };
}
