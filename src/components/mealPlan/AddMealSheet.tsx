import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Icon } from '#utils/iconUtils';
import { MealType } from '#generated';
import { useSavedRecipes } from '#hooks/recipe/useSavedRecipes';
import { CachedImage } from '#components/atoms/CachedImage';
import { spoonacularService } from '#services/recipeApi/SpoonacularService';
import { transformRecipeForDisplay, type TransformedRecipeItem } from '#utils/recipeTransform';
import { useRecipePreload } from '#hooks/recipe/useRecipePreload';
import { toastService } from '#/services/toastService';

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

const DEBOUNCE_MS = 500;

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
    snapPoints: ['80%'],
  });

  const [selectedMealType, setSelectedMealType] = useState<MealType>(MealType.Dinner);
  const [searchQuery, setSearchQuery] = useState('');
  const { recipes, hasNextPage, loadMore } = useSavedRecipes();

  // Spoonacular search state
  const [spoonacularResults, setSpoonacularResults] = useState<TransformedRecipeItem[]>([]);
  const [searchingApi, setSearchingApi] = useState(false);
  const [loadingItemId, setLoadingItemId] = useState<number | null>(null);

  const { preloadRecipe } = useRecipePreload();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset state when sheet opens
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setSelectedMealType(initialMealType ?? MealType.Dinner);
      setSpoonacularResults([]);
      setSearchingApi(false);
      setLoadingItemId(null);
    }
  }, [visible, initialMealType]);

  // Debounced Spoonacular search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSpoonacularResults([]);
      setSearchingApi(false);
      return;
    }

    setSearchingApi(true);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await spoonacularService.searchRecipes(
          { query: trimmed, number: 10 },
          controller.signal,
        );

        if (!controller.signal.aborted) {
          setSpoonacularResults(response.results.map(transformRecipeForDisplay));
          setSearchingApi(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSearchingApi(false);
          // Silently fail - saved recipes still show
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return recipes;
    const query = searchQuery.toLowerCase();
    return recipes.filter(r => r.name?.toLowerCase().includes(query));
  }, [recipes, searchQuery]);

  const handleSelectRecipe = useCallback(
    (recipeId: string) => {
      onAddRecipe(recipeId, selectedMealType);
      ref.current?.dismiss();
    },
    [onAddRecipe, selectedMealType, ref],
  );

  const handleAddCustomMeal = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    onAddCustomMeal(trimmed, selectedMealType);
    ref.current?.dismiss();
  }, [searchQuery, onAddCustomMeal, selectedMealType, ref]);

  const handleSelectSpoonacularRecipe = useCallback(
    async (item: TransformedRecipeItem) => {
      setLoadingItemId(item.spoonacularId);

      try {
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
      } catch {
        toastService.error('Failed to add recipe. Please try again.');
      } finally {
        setLoadingItemId(null);
      }
    },
    [preloadRecipe, onAddRecipe, selectedMealType, ref],
  );

  const handleScrollEndReached = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
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
    },
    [hasNextPage, searchQuery, loadMore],
  );

  const hasQuery = searchQuery.trim().length > 0;

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
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
        <View style={styles.searchContainer}>
          <Icon name="search" size={18} color={styles.searchIcon.color} />
          <BottomSheetTextInput
            style={styles.searchInput}
            placeholder="Search recipes or add a custom meal..."
            placeholderTextColor={styles.searchPlaceholder.color}
            defaultValue={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <BottomSheetScrollView contentContainerStyle={styles.listContent} onScroll={handleScrollEndReached} scrollEventThrottle={400}>
          {/* Custom meal row */}
          {hasQuery ? (
            <Pressable
              onPress={handleAddCustomMeal}
              style={({ pressed }) => [styles.customMealRow, pressed && styles.pressed]}
            >
              <Icon name="add-circle-outline" size={24} color={styles.addIcon.color} />
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
              style={({ pressed }) => [styles.recipeItem, pressed && styles.pressed]}
            >
              {recipe.imageUrl ? <CachedImage uri={recipe.imageUrl} style={styles.recipeImage} displaySize={44} /> : null}
              <View style={styles.recipeInfo}>
                <Text style={styles.recipeName} numberOfLines={1}>{recipe.name}</Text>
                <Text style={styles.recipeMeta}>
                  {recipe.servings} servings
                  {recipe.totalTimeMinutes ? ` · ${recipe.totalTimeMinutes} min` : ''}
                </Text>
              </View>
              <Icon name="add-circle-outline" size={24} color={styles.addIcon.color} />
            </Pressable>
          ))}

          {/* Additional search results */}
          {hasQuery && (searchingApi || spoonacularResults.length > 0) ? (
            <>
              {searchingApi ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={styles.addIcon.color} />
                </View>
              ) : null}

              {spoonacularResults.map(item => (
                <Pressable
                  key={item.id}
                  onPress={() => handleSelectSpoonacularRecipe(item)}
                  disabled={loadingItemId === item.spoonacularId}
                  style={({ pressed }) => [styles.recipeItem, pressed && styles.pressed]}
                >
                  {item.imageUrl ? <CachedImage uri={item.imageUrl} style={styles.recipeImage} displaySize={44} /> : null}
                  <View style={styles.recipeInfo}>
                    <Text style={styles.recipeName} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.recipeMeta}>{item.subtitle}</Text>
                  </View>
                  {loadingItemId === item.spoonacularId ? (
                    <ActivityIndicator size="small" color={styles.addIcon.color} />
                  ) : (
                    <Icon name="add-circle-outline" size={24} color={styles.addIcon.color} />
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

          {hasQuery && filteredRecipes.length === 0 && !searchingApi && spoonacularResults.length === 0 ? (
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
    marginBottom: theme.spacing.md,
  },
  mealTypeRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    color: theme.colors.textTertiary,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    padding: 0,
  },
  searchPlaceholder: {
    color: theme.colors.textTertiary,
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
