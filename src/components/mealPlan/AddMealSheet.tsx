import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Pressable, ScrollView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Icon } from '#utils/iconUtils';
import { MealType } from '#generated';
import { useSavedRecipes } from '#hooks/recipe/useSavedRecipes';
import { CachedImage } from '#components/atoms/CachedImage';
import {
  BottomSheetSearchBar,
  type BottomSheetSearchBarRef,
} from '#components/molecules/BottomSheetSearchBar';
import { spoonacularService } from '#services/recipeApi/SpoonacularService';
import {
  transformRecipeForDisplay,
  type TransformedRecipeItem,
  type DietTag,
} from '#utils/recipeTransform';
import { useRecipePreload } from '#hooks/recipe/useRecipePreload';
import {
  useRecipeCacheStore,
  textSearchCacheKey,
} from '#store/useRecipeCacheStore';
import { toastService } from '#/services/toastService';
import { executeAsyncWithCleanup } from '#/utils/compilerSafeWrappers';
import type { SearchRecipesResult } from '#/services/recipeApi/types';

interface AddMealSheetProps {
  visible: boolean;
  onClose: () => void;
  initialMealType?: MealType;
  onAddRecipe: (recipeId: string, mealType: MealType) => void;
  onAddCustomMeal: (name: string, mealType: MealType) => void;
}

const MEAL_TYPES: { type: MealType; label: string }[] = [
  { type: MealType.Breakfast, label: 'Breakfast' },
  { type: MealType.Lunch, label: 'Lunch' },
  { type: MealType.Dinner, label: 'Dinner' },
  { type: MealType.Snack, label: 'Snack' },
  { type: MealType.Brunch, label: 'Brunch' },
  { type: MealType.Dessert, label: 'Dessert' },
];

const DIET_TAG_LABELS: Record<DietTag, string> = {
  vegan: 'Vegan',
  vegetarian: 'Vegetarian',
  glutenFree: 'GF',
  dairyFree: 'DF',
};

const MIN_QUERY_LENGTH = 3;

/** Module-level helper to reset sheet state when it opens */
function resetSheetState(
  initialMealType: MealType | undefined,
  setSearchQuery: (v: string) => void,
  setSelectedMealType: (v: MealType) => void,
  setSpoonacularResults: (v: TransformedRecipeItem[]) => void,
  setSearchingApi: (v: boolean) => void,
  setLoadingItemId: (v: number | null) => void,
) {
  setSearchQuery('');
  setSelectedMealType(initialMealType ?? MealType.Dinner);
  setSpoonacularResults([]);
  setSearchingApi(false);
  setLoadingItemId(null);
}

/** Module-level helper to clear search results when query is too short */
function clearSearchResults(
  setSpoonacularResults: (v: TransformedRecipeItem[]) => void,
  setSearchingApi: (v: boolean) => void,
) {
  setSpoonacularResults([]);
  setSearchingApi(false);
}

/** Module-level async helper: search Spoonacular with cache-first strategy */
function searchSpoonacularWithCache(
  query: string,
  onResults: (results: TransformedRecipeItem[]) => void,
  setSearching: (v: boolean) => void,
  signal: AbortSignal,
) {
  const cacheKey = textSearchCacheKey(query);
  const cacheStore = useRecipeCacheStore.getState();
  const cached = cacheStore.getCached(cacheKey);

  if (cached) {
    onResults(
      cached.results.map(r =>
        transformRecipeForDisplay(r as SearchRecipesResult),
      ),
    );
    setSearching(false);
    return;
  }

  setSearching(true);

  executeAsyncWithCleanup(
    async () => {
      const response = await spoonacularService.searchRecipes(
        { query, number: 10, addRecipeInformation: true },
        signal,
      );

      if (!signal.aborted) {
        cacheStore.setCached(cacheKey, response.results);
        onResults(response.results.map(transformRecipeForDisplay));
      }
    },
    () => {
      if (!signal.aborted) setSearching(false);
    },
    () => {
      // Silently fail - saved recipes still show
    },
  );
}

export const AddMealSheet: React.FC<AddMealSheetProps> = ({
  visible,
  onClose,
  initialMealType,
  onAddRecipe,
  onAddCustomMeal,
}) => {
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['65%', '85%'],
  });

  const [selectedMealType, setSelectedMealType] = useState<MealType>(
    MealType.Dinner,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const {
    state: { recipes, hasNextPage },
    actions: { loadMore },
  } = useSavedRecipes();

  // Spoonacular search state
  const [spoonacularResults, setSpoonacularResults] = useState<
    TransformedRecipeItem[]
  >([]);
  const [searchingApi, setSearchingApi] = useState(false);
  const [loadingItemId, setLoadingItemId] = useState<number | null>(null);

  const { preloadRecipe } = useRecipePreload();

  const searchBarRef = useRef<BottomSheetSearchBarRef>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset state when sheet opens
  useEffect(() => {
    if (visible) {
      resetSheetState(
        initialMealType,
        setSearchQuery,
        setSelectedMealType,
        setSpoonacularResults,
        setSearchingApi,
        setLoadingItemId,
      );
      searchBarRef.current?.clear();
    }
  }, [visible, initialMealType]);

  const handleDebouncedSearch = (text: string) => {
    setSearchQuery(text);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const trimmed = text.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      clearSearchResults(setSpoonacularResults, setSearchingApi);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    searchSpoonacularWithCache(
      trimmed,
      setSpoonacularResults,
      setSearchingApi,
      controller.signal,
    );
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    clearSearchResults(setSpoonacularResults, setSearchingApi);
  };

  const filteredRecipes = (() => {
    if (!searchQuery.trim()) return recipes;
    const query = searchQuery.toLowerCase();
    return recipes.filter(r => r.name?.toLowerCase().includes(query));
  })();

  const handleSelectRecipe = (recipeId: string) => {
    onAddRecipe(recipeId, selectedMealType);
    ref.current?.dismiss();
  };

  const handleAddCustomMeal = () => {
    // Read immediate value from ref to avoid debounce-lag edge case
    const trimmed = (searchBarRef.current?.getValue() ?? searchQuery).trim();
    if (!trimmed) return;
    onAddCustomMeal(trimmed, selectedMealType);
    ref.current?.dismiss();
  };

  const handleSelectSpoonacularRecipe = (item: TransformedRecipeItem) => {
    setLoadingItemId(item.spoonacularId);

    executeAsyncWithCleanup(
      async () => {
        const fullRecipe = await spoonacularService.getRecipeInformation({
          id: item.spoonacularId,
        });

        const preloaded = await preloadRecipe(fullRecipe);
        if (preloaded) {
          onAddRecipe(preloaded.id, selectedMealType);
          ref.current?.dismiss();
        } else {
          toastService.error('Failed to add recipe. Please try again.');
        }
      },
      () => setLoadingItemId(null),
      () => {
        toastService.error('Failed to add recipe. Please try again.');
      },
    );
  };

  const handleScrollEndReached = (
    e: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const paddingToBottom = 100;
    if (
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom
    ) {
      if (hasNextPage && !searchQuery.trim()) {
        loadMore();
      }
    }
  };

  const hasQuery = searchQuery.trim().length > 0;

  return (
    <BottomSheetModal
      ref={ref}
      {...modalProps}
      android_keyboardInputMode="adjustResize"
    >
      <View style={[styles.content, contentContainerStyle]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add a meal</Text>
        </View>

        {/* Meal type selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mealTypeRow}
          style={styles.mealTypeScroll}
        >
          {MEAL_TYPES.map(({ type, label }) => (
            <Pressable
              key={type}
              onPress={() => setSelectedMealType(type)}
              style={[
                styles.mealTypeChip,
                selectedMealType === type && styles.mealTypeChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.mealTypeText,
                  selectedMealType === type && styles.mealTypeTextSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Search input */}
        <View style={styles.searchBarWrapper}>
          <BottomSheetSearchBar
            ref={searchBarRef}
            placeholder="Search recipes or add a custom meal..."
            onChangeText={handleDebouncedSearch}
            onClear={handleClearSearch}
            isLoading={searchingApi}
            debounceMs={500}
            autoCapitalize="none"
          />
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.listContent}
          onScroll={handleScrollEndReached}
          scrollEventThrottle={400}
        >
          {/* Custom meal row */}
          {hasQuery ? (
            <Pressable
              onPress={handleAddCustomMeal}
              style={({ pressed }) => [
                styles.customMealRow,
                pressed && styles.pressed,
              ]}
            >
              <Icon
                name="add-circle-outline"
                size={24}
                color={styles.addIcon.color}
              />
              <Text style={styles.customMealText} numberOfLines={1}>
                Add &quot;{searchQuery.trim()}&quot; as custom meal
              </Text>
            </Pressable>
          ) : null}

          {/* Your Recipes section */}
          {hasQuery && filteredRecipes.length > 0 ? (
            <Text style={styles.sectionHeader}>Your Recipes</Text>
          ) : null}

          {filteredRecipes.map(recipe => (
            <Pressable
              key={recipe.recipeId}
              onPress={() => handleSelectRecipe(recipe.recipeId)}
              style={({ pressed }) => [
                styles.recipeItem,
                pressed && styles.pressed,
              ]}
            >
              {recipe.imageUrl ? (
                <CachedImage
                  uri={recipe.imageUrl}
                  style={styles.recipeImage}
                  displaySize={44}
                />
              ) : null}
              <View style={styles.recipeInfo}>
                <Text style={styles.recipeName} numberOfLines={1}>
                  {recipe.name}
                </Text>
                {recipe.servings || recipe.totalTimeMinutes ? (
                  <Text style={styles.recipeMeta}>
                    {recipe.servings ? `${recipe.servings} servings` : ''}
                    {recipe.totalTimeMinutes
                      ? `${recipe.servings ? ' · ' : ''}${
                          recipe.totalTimeMinutes
                        } min`
                      : ''}
                  </Text>
                ) : null}
              </View>
              <Icon
                name="add-circle-outline"
                size={24}
                color={styles.addIcon.color}
              />
            </Pressable>
          ))}

          {/* Additional search results */}
          {hasQuery && (searchingApi || spoonacularResults.length > 0) ? (
            <>
              {searchingApi ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator
                    size="small"
                    color={styles.addIcon.color}
                  />
                </View>
              ) : null}

              {spoonacularResults.map(item => (
                <Pressable
                  key={item.id}
                  onPress={() => handleSelectSpoonacularRecipe(item)}
                  disabled={loadingItemId === item.spoonacularId}
                  style={({ pressed }) => [
                    styles.recipeItem,
                    pressed && styles.pressed,
                  ]}
                >
                  {item.imageUrl ? (
                    <CachedImage
                      uri={item.imageUrl}
                      style={styles.recipeImage}
                      displaySize={44}
                    />
                  ) : null}
                  <View style={styles.recipeInfo}>
                    <Text style={styles.recipeName} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text style={styles.recipeMeta} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                    {item.dietTags && item.dietTags.length > 0 ? (
                      <View style={styles.dietTagsRow}>
                        {item.dietTags.map(tag => (
                          <View key={tag} style={styles.dietTag}>
                            <Text style={styles.dietTagText}>
                              {DIET_TAG_LABELS[tag]}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  {loadingItemId === item.spoonacularId ? (
                    <ActivityIndicator
                      size="small"
                      color={styles.addIcon.color}
                    />
                  ) : (
                    <Icon
                      name="add-circle-outline"
                      size={24}
                      color={styles.addIcon.color}
                    />
                  )}
                </Pressable>
              ))}
            </>
          ) : null}

          {/* Empty state */}
          {!hasQuery && filteredRecipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No saved recipes yet</Text>
            </View>
          ) : null}

          {hasQuery &&
          filteredRecipes.length === 0 &&
          !searchingApi &&
          spoonacularResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No recipes match your search</Text>
            </View>
          ) : null}
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
  },
  mealTypeScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: theme.spacing.md,
  },
  mealTypeRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  mealTypeChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mealTypeChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  mealTypeText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  mealTypeTextSelected: {
    color: theme.colors.white,
    fontWeight: theme.fonts.weight.medium,
  },
  searchBarWrapper: {
    paddingHorizontal: theme.spacing.lg,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  sectionHeader: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    paddingVertical: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  customMealText: {
    flex: 1,
    fontSize: theme.fonts.size.md,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
  recipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  recipeImage: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.sm,
    marginRight: theme.spacing.sm,
  },
  recipeInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  recipeName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  recipeMeta: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  dietTagsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: 4,
  },
  dietTag: {
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: theme.radii.sm,
  },
  dietTagText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textTertiary,
    fontWeight: theme.fonts.weight.medium,
  },
  addIcon: {
    color: theme.colors.primary,
  },
  loadingContainer: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
  },
}));
