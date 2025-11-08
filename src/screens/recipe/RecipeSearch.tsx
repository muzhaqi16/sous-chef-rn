import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Image,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useAppNavigation, useDefaultHome, usePantryManagement } from '#hooks';
import { useDietaryProfile } from '#/hooks/profile/useDietaryProfile';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import {
  ListTemplate,
  SearchBarAction,
  HeaderAction,
  BottomSheetAction,
} from '#components';
import { spoonacularService } from '#/services/recipeApi';
import type {
  SearchRecipesResult,
  RecipeSearchResult,
} from '#/services/recipeApi/types';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useGetHomeQuery, Diet, ReligiousDiet } from '#generated';

type RecipeSearchRouteProp = RouteProp<
  { RecipeSearch: { initialQuery?: string } },
  'RecipeSearch'
>;

export const RecipeSearch: React.FC = () => {
  const { navigate } = useAppNavigation();
  const { theme } = useUnistyles();
  const { selectedHomeId, getDefaultPantry } = useDefaultHome();
  const route = useRoute<RecipeSearchRouteProp>();
  const initialQuery = route.params?.initialQuery || '';

  // Fetch home data to get pantries
  const { data: homeData } = useGetHomeQuery({
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
  });

  // Get pantry for ingredient selection
  const defaultPantry = getDefaultPantry(homeData);
  const { allItems: pantryItems } = usePantryManagement(defaultPantry?.id);

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
  const [activeFilters, setActiveFilters] = useState<{
    diet: string | null;
    intolerances: string[];
    mealType: string | null;
    maxReadyTime: number | null;
  }>({
    diet: null,
    intolerances: [],
    mealType: null,
    maxReadyTime: null,
  });

  const ingredientSheetRef = useRef<BottomSheetModal>(null);
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const hasAutoSearchedRef = useRef(false);
  const hasInitializedFiltersRef = useRef(false);

  // Get excluded ingredients for Halal/Kosher restrictions
  const getExcludedIngredientsForReligiousDiet = useCallback(
    (restrictions: { diet?: Diet | null }[]): string[] => {
      const excluded: string[] = [];

      for (const restriction of restrictions) {
        // Check if this restriction has a religious diet
        const religionDiet =
          restriction.diet as unknown as ReligiousDiet | null;

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
    },
    [],
  );

  // Initialize filters from dietary profile
  useEffect(() => {
    if (!dietaryProfile || hasInitializedFiltersRef.current) {
      return;
    }

    // Extract diet and intolerances from restrictions
    const restrictions = dietaryProfile.restrictions || [];
    let diet: string | null = null;
    const intolerances: string[] = [];

    for (const restriction of restrictions) {
      // Take first diet restriction and convert to lowercase with spaces
      if (restriction.diet && !diet) {
        diet = restriction.diet.toLowerCase().replace(/_/g, ' ');
      }

      // Collect all intolerance restrictions
      if (restriction.intolerance) {
        intolerances.push(
          restriction.intolerance.toLowerCase().replace(/_/g, ' '),
        );
      }
    }

    // Round maxCookTimeMinutes to nearest filter option (15, 30, 45, 60)
    let maxReadyTime: number | null = null;
    if (dietaryProfile.maxCookTimeMinutes) {
      const cookTime = dietaryProfile.maxCookTimeMinutes;
      if (cookTime <= 15) maxReadyTime = 15;
      else if (cookTime <= 30) maxReadyTime = 30;
      else if (cookTime <= 45) maxReadyTime = 45;
      else if (cookTime <= 60) maxReadyTime = 60;
    }

    // Set filters if any were found
    if (diet || intolerances.length > 0 || maxReadyTime) {
      setActiveFilters({
        diet,
        intolerances,
        mealType: null,
        maxReadyTime,
      });
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
      // Get excluded ingredients for Halal/Kosher restrictions
      const excludedIngredients = getExcludedIngredientsForReligiousDiet(
        dietaryProfile?.restrictions || [],
      );

      const data = await spoonacularService.searchRecipes({
        query: searchQuery,
        number: 10,
        addRecipeInformation: true, // Get additional recipe metadata
        // Add filter parameters
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
    } catch (error: any) {
      console.error('Search error:', error);

      if (error.isQuotaExceeded) {
        Alert.alert(
          'API Limit Reached',
          'Spoonacular API quota exceeded. Please try again later.',
        );
      } else if (error.isRateLimitError) {
        Alert.alert(
          'Rate Limit',
          'Too many requests. Please try again in a moment.',
        );
      } else {
        Alert.alert(
          'Search Error',
          'Failed to search recipes. Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [
    searchQuery,
    activeFilters,
    dietaryProfile,
    getExcludedIngredientsForReligiousDiet,
  ]);

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
      Alert.alert(
        'No Ingredients Selected',
        'Please select at least one ingredient',
      );
      return;
    }

    const ingredientString = Array.from(selectedIngredients).join(',');

    setLoading(true);
    setSearchPerformed(true);
    ingredientSheetRef.current?.dismiss();

    try {
      // Get excluded ingredients for Halal/Kosher restrictions
      const excludedIngredients = getExcludedIngredientsForReligiousDiet(
        dietaryProfile?.restrictions || [],
      );

      const results = await spoonacularService.searchRecipesByIngredients({
        ingredients: ingredientString,
        number: 10,
        // Add filter parameters
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

      // Keep the full RecipeSearchResult with ingredient matching data
      setSearchResults(results);
    } catch (error: any) {
      console.error('Ingredient search error:', error);

      if (error.isQuotaExceeded) {
        Alert.alert(
          'API Limit Reached',
          'Spoonacular API quota exceeded. Please try again later.',
        );
      } else if (error.isRateLimitError) {
        Alert.alert(
          'Rate Limit',
          'Too many requests. Please try again in a moment.',
        );
      } else {
        Alert.alert(
          'Search Error',
          'Failed to search recipes. Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [
    selectedIngredients,
    activeFilters,
    dietaryProfile,
    getExcludedIngredientsForReligiousDiet,
  ]);

  // Open ingredient selector
  const openIngredientSelector = useCallback(() => {
    if (!pantryItems || pantryItems.length === 0) {
      Alert.alert(
        'No Pantry Items',
        'Add items to your pantry first to search by ingredients.',
      );
      return;
    }
    ingredientSheetRef.current?.present();
  }, [pantryItems]);

  // Toggle ingredient selection
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

  // Open filter sheet
  const openFilterSheet = useCallback(() => {
    filterSheetRef.current?.present();
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setActiveFilters({
      diet: null,
      intolerances: [],
      mealType: null,
      maxReadyTime: null,
    });
  }, []);

  // Apply filters and close sheet
  const applyFilters = useCallback(() => {
    filterSheetRef.current?.dismiss();
    // Trigger search if there's a query or ingredients selected
    if (searchQuery.trim()) {
      handleTextSearch();
    } else if (selectedIngredients.size > 0) {
      handleIngredientSearch();
    }
  }, [
    searchQuery,
    selectedIngredients,
    handleTextSearch,
    handleIngredientSearch,
  ]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilters.diet) count++;
    if (activeFilters.intolerances.length > 0)
      count += activeFilters.intolerances.length;
    if (activeFilters.mealType) count++;
    if (activeFilters.maxReadyTime) count++;
    return count;
  }, [activeFilters]);

  // Transform results to list items with unified display
  const items = useMemo(() => {
    return searchResults.map(recipe => {
      // Check if this is an ingredient-based search result
      const hasIngredientData = 'usedIngredientCount' in recipe;
      const recipeWithIngredients = hasIngredientData
        ? (recipe as RecipeSearchResult)
        : null;

      // Build subtitle parts
      const subtitleParts: string[] = [];

      // Ingredient match info (ingredient search only)
      if (recipeWithIngredients) {
        const totalIngredients =
          recipeWithIngredients.usedIngredientCount +
          recipeWithIngredients.missedIngredientCount;
        subtitleParts.push(
          `${recipeWithIngredients.usedIngredientCount}/${totalIngredients} ingredients`,
        );
      }

      // Cook time (both search types)
      const textSearchRecipe = recipe as SearchRecipesResult;
      if (textSearchRecipe.readyInMinutes) {
        subtitleParts.push(`⏱ ${textSearchRecipe.readyInMinutes} min`);
      }

      // Servings (both search types)
      if (textSearchRecipe.servings) {
        subtitleParts.push(`${textSearchRecipe.servings} servings`);
      }

      // Build likes badge (both search types)
      let badge;
      const likes =
        recipeWithIngredients?.likes ?? textSearchRecipe.aggregateLikes;
      if (likes && likes > 0) {
        badge = {
          text: `❤️ ${likes}`,
          variant: 'info' as const,
        };
      }

      return {
        id: `spoonacular-${recipe.id}`,
        title: recipe.title,
        subtitle: subtitleParts.join(' • ') || 'From Spoonacular',
        badge,
        leftElement: recipe.image ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: recipe.image }} style={styles.leftImage} />
          </View>
        ) : undefined,
        spoonacularId: recipe.id,
      };
    });
  }, [searchResults]);

  const handleItemPress = useCallback(
    (id: string) => {
      const item = items.find(i => i.id === id);
      if (!item) return;

      // Navigate to external recipe detail
      navigate('RecipeDetail', {
        externalSource: 'SPOONACULAR',
        externalId: String(item.spoonacularId),
      });
    },
    [items, navigate],
  );

  // Header actions
  const headerActions = useMemo(
    () => ({
      left: [
        {
          icon: 'arrow-back',
          onPress: () => navigate('RecipeMain'),
        },
      ] as HeaderAction[],
      right: [] as HeaderAction[],
    }),
    [navigate],
  );

  // Search bar actions
  const searchBarActions = useMemo(
    () => ({
      left: [] as SearchBarAction[],
      right: [
        {
          icon: 'restaurant',
          onPress: openIngredientSelector,
          color: theme.colors.white,
          badge:
            selectedIngredients.size > 0
              ? String(selectedIngredients.size)
              : undefined,
        },
        {
          icon: 'options',
          onPress: openFilterSheet,
          color: theme.colors.white,
          badge: activeFilterCount > 0 ? String(activeFilterCount) : undefined,
        },
        {
          icon: 'search',
          onPress: handleTextSearch,
          color: theme.colors.primary,
          backgroundColor: theme.colors.surface,
        },
      ] as SearchBarAction[],
    }),
    [
      handleTextSearch,
      openIngredientSelector,
      openFilterSheet,
      selectedIngredients.size,
      activeFilterCount,
      theme,
    ],
  );

  const emptyStateConfig = searchPerformed
    ? {
        icon: 'search-off',
        title: 'No recipes found',
        description: 'Try a different search term or different ingredients',
        action: {
          label: 'Search by Ingredients',
          onPress: openIngredientSelector,
        },
      }
    : {
        icon: 'search',
        title: 'Search for Recipes',
        description: 'Enter a search term or select pantry ingredients',
        action: {
          label: 'Search by Ingredients',
          onPress: openIngredientSelector,
        },
      };

  return (
    <View style={styles.container}>
      <ListTemplate
        title="Search Recipes"
        subtitle="Find recipes"
        items={items}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemPress={handleItemPress}
        loading={loading}
        hasNoData={false}
        showHeader={true}
        showSearchBar={true}
        headerActions={headerActions}
        searchBarActions={searchBarActions}
        emptyState={emptyStateConfig}
        showUserHeader={false}
      />

      {/* Ingredient Selector Bottom Sheet */}
      <BottomSheetAction
        sheetRef={ingredientSheetRef}
        sheetTitle="Select Ingredients"
        snapPoints={['50%', '75%', '90%']}
        scrollable={false}
      >
        <FlatList
          data={pantryItems}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const itemName = item.item?.name || item.itemName || '';
            const isSelected = selectedIngredients.has(itemName);

            return (
              <TouchableOpacity
                style={styles.ingredientItem}
                onPress={() => toggleIngredient(itemName)}
              >
                <Ionicons
                  name={isSelected ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={
                    isSelected
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                  }
                />
                <Text style={styles.ingredientText}>{itemName}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No pantry items available</Text>
          }
        />

        <TouchableOpacity
          style={[
            styles.searchButton,
            { backgroundColor: theme.colors.primary },
          ]}
          onPress={handleIngredientSearch}
          disabled={selectedIngredients.size === 0}
        >
          <Text style={styles.searchButtonText}>
            Search with {selectedIngredients.size} ingredient
            {selectedIngredients.size !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      </BottomSheetAction>

      {/* Filter Bottom Sheet */}
      <BottomSheetAction
        sheetRef={filterSheetRef}
        sheetTitle="Filters"
        snapPoints={['75%', '90%']}
      >
        {/* Diet Filter Section */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>🍽️ Diet</Text>
          <Text style={styles.filterSectionSubtitle}>Select one</Text>
          <View style={styles.chipRow}>
            {['Vegan', 'Vegetarian', 'Keto', 'Paleo', 'Whole30'].map(diet => (
              <TouchableOpacity
                key={diet}
                style={[
                  styles.filterChip,
                  activeFilters.diet === diet.toLowerCase() &&
                    styles.filterChipActive,
                ]}
                onPress={() =>
                  setActiveFilters(prev => ({
                    ...prev,
                    diet:
                      prev.diet === diet.toLowerCase()
                        ? null
                        : diet.toLowerCase(),
                  }))
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilters.diet === diet.toLowerCase() &&
                      styles.filterChipTextActive,
                  ]}
                >
                  {diet}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Intolerances Filter Section */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>
            ⚠️ Allergies & Intolerances
          </Text>
          <Text style={styles.filterSectionSubtitle}>
            Select all that apply
          </Text>
          <View style={styles.checkboxGrid}>
            {[
              'Gluten',
              'Dairy',
              'Egg',
              'Peanut',
              'Tree Nut',
              'Soy',
              'Shellfish',
              'Seafood',
            ].map(intolerance => {
              const isSelected = activeFilters.intolerances.includes(
                intolerance.toLowerCase(),
              );
              return (
                <TouchableOpacity
                  key={intolerance}
                  style={styles.checkboxItem}
                  onPress={() =>
                    setActiveFilters(prev => ({
                      ...prev,
                      intolerances: isSelected
                        ? prev.intolerances.filter(
                            i => i !== intolerance.toLowerCase(),
                          )
                        : [...prev.intolerances, intolerance.toLowerCase()],
                    }))
                  }
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={
                      isSelected
                        ? theme.colors.primary
                        : theme.colors.textSecondary
                    }
                  />
                  <Text style={styles.checkboxText}>{intolerance}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Meal Type Filter Section */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>🍳 Meal Type</Text>
          <Text style={styles.filterSectionSubtitle}>Select one</Text>
          <View style={styles.chipRow}>
            {['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'].map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterChip,
                  activeFilters.mealType === type.toLowerCase() &&
                    styles.filterChipActive,
                ]}
                onPress={() =>
                  setActiveFilters(prev => ({
                    ...prev,
                    mealType:
                      prev.mealType === type.toLowerCase()
                        ? null
                        : type.toLowerCase(),
                  }))
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilters.mealType === type.toLowerCase() &&
                      styles.filterChipTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Max Cook Time Filter Section */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>⏱️ Max Cook Time</Text>
          <Text style={styles.filterSectionSubtitle}>Select one</Text>
          <View style={styles.chipRow}>
            {[
              { label: '15 min', value: 15 },
              { label: '30 min', value: 30 },
              { label: '45 min', value: 45 },
              { label: '60 min', value: 60 },
            ].map(time => (
              <TouchableOpacity
                key={time.value}
                style={[
                  styles.filterChip,
                  activeFilters.maxReadyTime === time.value &&
                    styles.filterChipActive,
                ]}
                onPress={() =>
                  setActiveFilters(prev => ({
                    ...prev,
                    maxReadyTime:
                      prev.maxReadyTime === time.value ? null : time.value,
                  }))
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilters.maxReadyTime === time.value &&
                      styles.filterChipTextActive,
                  ]}
                >
                  {time.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.filterActions}>
          <TouchableOpacity
            style={[styles.filterActionButton, styles.clearButton]}
            onPress={clearFilters}
          >
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterActionButton,
              styles.applyButton,
              { backgroundColor: theme.colors.primary },
            ]}
            onPress={applyFilters}
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetAction>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  imageContainer: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    marginRight: theme.spacing.md,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  leftImage: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    borderRadius: theme.radii.md,
    resizeMode: 'cover',
    elevation: 2,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  ingredientText: {
    marginLeft: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.fonts.size.md,
    marginTop: theme.spacing.xl,
  },
  searchButton: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
  },
  // Filter styles
  filterContainer: {
    padding: theme.spacing.md,
  },
  filterSection: {
    marginBottom: theme.spacing.xl,
  },
  filterSectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  filterSectionSubtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.full,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    padding: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
  },
  checkboxText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
  },
  filterActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  filterActionButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  clearButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
  },
  applyButton: {
    // backgroundColor set inline with theme.colors.primary
  },
  applyButtonText: {
    color: '#fff',
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
  },
}));
