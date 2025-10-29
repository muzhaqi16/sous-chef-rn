import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
import { useGetHomeQuery } from '#generated';

type RecipeSearchRouteProp = RouteProp<{ RecipeSearch: { initialQuery?: string } }, 'RecipeSearch'>;

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

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<
    (SearchRecipesResult | RecipeSearchResult)[]
  >([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(
    new Set(),
  );

  const ingredientSheetRef = useRef<BottomSheetModal>(null);
  const hasAutoSearchedRef = useRef(false);

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
        addRecipeInformation: true, // Get additional recipe metadata
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
  }, [searchQuery]);

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
      const results = await spoonacularService.searchRecipesByIngredients({
        ingredients: ingredientString,
        number: 10,
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
  }, [selectedIngredients]);

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

  // Transform results to list items with unified display
  const items = useMemo(() => {
    return searchResults.map(recipe => {
      // Check if this is an ingredient-based search result
      const hasIngredientData = 'usedIngredientCount' in recipe;
      const recipeWithIngredients = hasIngredientData ? (recipe as RecipeSearchResult) : null;

      // Build subtitle parts
      const subtitleParts: string[] = [];

      // Ingredient match info (ingredient search only)
      if (recipeWithIngredients) {
        subtitleParts.push(
          `✅ ${recipeWithIngredients.usedIngredientCount} ingredients • ❌ ${recipeWithIngredients.missedIngredientCount} missing`
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
      const likes = recipeWithIngredients?.likes ?? textSearchRecipe.aggregateLikes;
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
          icon: 'search',
          onPress: handleTextSearch,
          color: theme.colors.primary,
          backgroundColor: theme.colors.surface,
        },
      ] as SearchBarAction[],
    }),
    [handleTextSearch, openIngredientSelector, selectedIngredients.size, theme],
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
      />

      {/* Ingredient Selector Bottom Sheet */}
      <BottomSheetAction
        sheetRef={ingredientSheetRef}
        sheetTitle="Select Ingredients"
        snapPoints={['50%', '75%', '90%']}
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
}));
