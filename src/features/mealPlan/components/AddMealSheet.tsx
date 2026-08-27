import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import {
  ChipScrollRow,
  type ChipOption,
} from '#components/atoms/ChipScrollRow';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import { FlashList } from '@shopify/flash-list';
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Icon } from '#utils/iconUtils';
import { useFragment } from '@apollo/client/react';
import { MealType } from '#/graphql/generated/schemaTypes';
import {
  useSavedRecipes,
  type SavedRecipeNode,
} from '#features/recipes/hooks/useSavedRecipes';
import { AddMealSheet_SavedRecipeFragmentDoc } from './AddMealSheet.generated';
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
import { useRecipePreload } from '#features/recipes/hooks/useRecipePreload';
import {
  useRecipeCacheStore,
  textSearchCacheKey,
} from '#features/recipes/store/useRecipeCacheStore';
import { toastService } from '#/services/toastService';
import { executeAsyncWithCleanup } from '#/utils/finallyHelpers';
import type { SearchRecipesResult } from '#/services/recipeApi/types';

interface AddMealSheetProps {
  visible: boolean;
  onClose: () => void;
  initialMealType?: MealType;
  onAddRecipe: (recipeId: string, mealType: MealType) => void;
  onAddCustomMeal: (name: string, mealType: MealType) => void;
}

const MEAL_TYPES: { type: MealType; labelKey: string }[] = [
  { type: MealType.Breakfast, labelKey: 'labels.breakfast' },
  { type: MealType.Lunch, labelKey: 'labels.lunch' },
  { type: MealType.Dinner, labelKey: 'labels.dinner' },
  { type: MealType.Snack, labelKey: 'usagePurpose.SNACK' },
  { type: MealType.Brunch, labelKey: 'labels.brunch' },
  { type: MealType.Dessert, labelKey: 'labels.dessert' },
];

const DIET_TAG_LABEL_KEYS: Record<DietTag, string> = {
  vegan: 'addMealSheet.dietVegan',
  vegetarian: 'addMealSheet.dietVegetarian',
  glutenFree: 'addMealSheet.dietGlutenFree',
  dairyFree: 'addMealSheet.dietDairyFree',
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
      const response = await spoonacularService.searchRecipesWithInfo(
        { query, number: 10 },
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

// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';
const keyExtractor = (savedRecipe: SavedRecipeNode) => savedRecipe.id;

/**
 * Per-row leaf that subscribes to a single SavedRecipe via the colocated
 * `AddMealSheet_savedRecipe` fragment. `useFragment` reads these scalars
 * straight from the normalized cache (populated by the MySavedRecipes query),
 * so the row stays independent of the recipes feature's internal fragments.
 *
 * Search filtering is the parent's job — a row that rendered `null` would
 * still occupy a slot in the list's item count and leave a blank gap.
 */
interface SavedRecipeRowProps {
  savedRecipeRef: SavedRecipeNode;
  onPress: (recipeId: string) => void;
}

const SavedRecipeRow: React.FC<SavedRecipeRowProps> = ({
  savedRecipeRef,
  onPress,
}) => {
  const { t } = useTranslation();
  const { data, complete } = useFragment({
    fragment: AddMealSheet_SavedRecipeFragmentDoc,
    fragmentName: 'AddMealSheet_savedRecipe',
    from: savedRecipeRef,
  });

  if (!complete) return null;

  const { recipe } = data;
  return (
    <AppPressable onPress={() => onPress(recipe.id)} style={styles.recipeItem}>
      {!!recipe.imageUrl && (
        <CachedImage
          uri={recipe.imageUrl}
          style={styles.recipeImage}
          displaySize={44}
        />
      )}
      <View style={styles.recipeInfo}>
        <Text style={styles.recipeName} numberOfLines={1}>
          {recipe.name}
        </Text>
        {!!(recipe.servings || recipe.totalTimeMinutes) && (
          <Text style={styles.recipeMeta}>
            {recipe.servings
              ? t('addMealSheet.servings', { count: recipe.servings })
              : ''}
            {recipe.totalTimeMinutes
              ? `${recipe.servings ? ' · ' : ''}${t('labels.min', {
                  count: recipe.totalTimeMinutes,
                })}`
              : ''}
          </Text>
        )}
      </View>
      <Icon name="add-circle-outline" size={24} tone="primary" />
    </AppPressable>
  );
};

export const AddMealSheet: React.FC<AddMealSheetProps> = ({
  visible,
  onClose,
  initialMealType,
  onAddRecipe,
  onAddCustomMeal,
}) => {
  const { t } = useTranslation();
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
    state: { recipes, hasMore },
    actions: { loadMore },
  } = useSavedRecipes();

  // Spoonacular search state
  const [spoonacularResults, setSpoonacularResults] = useState<
    TransformedRecipeItem[]
  >([]);
  const [searchingApi, setSearchingApi] = useState(false);
  const [loadingItemId, setLoadingItemId] = useState<number | null>(null);

  const { preloadRecipe } = useRecipePreload();
  const BottomSheetScrollable = useBottomSheetScrollableCreator();

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
          // Carry per-ingredient nutrition so the ingest below populates the
          // external-ingredient mirror (spoonacular.nutrition) — one call with
          // a flag, no extra requests. Matches useRecipeData's detail fetch.
          includeNutrition: true,
        });

        // Deliberate save (add to meal plan) → withCost re-ingests with the
        // recipe-scoped priceBreakdown so per-ingredient cost lands in the mirror.
        const preloaded = await preloadRecipe(fullRecipe, undefined, {
          withCost: true,
        });
        if (preloaded) {
          onAddRecipe(preloaded.id, selectedMealType);
          ref.current?.dismiss();
        } else {
          toastService.error(t('addMealSheet.addRecipeFailed'));
        }
      },
      () => setLoadingItemId(null),
      () => {
        toastService.error(t('addMealSheet.addRecipeFailed'));
      },
    );
  };

  // `loadMore` guards re-entry synchronously (usePagination's isFetchingMoreRef),
  // so onEndReached firing repeatedly during a fling is safe.
  const handleEndReached = () => {
    if (hasMore && !searchQuery.trim()) {
      loadMore();
    }
  };

  const hasQuery = searchQuery.trim().length > 0;

  // Filtering moved up from the row so the list's item count matches what is
  // actually rendered — a virtualized list can't absorb rows that return null.
  const filteredRecipes = hasQuery
    ? recipes.filter(savedRecipe =>
        savedRecipe.recipe.name
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase()),
      )
    : recipes;

  const mealTypeOptions: ChipOption<MealType>[] = MEAL_TYPES.map(
    ({ type, labelKey }) => ({ key: type, label: t(labelKey) }),
  );

  return (
    <BottomSheetModal
      ref={ref}
      {...modalProps}
      android_keyboardInputMode="adjustResize"
    >
      <View style={[styles.content, contentContainerStyle]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('labels.addAMeal')}</Text>
        </View>

        {/* Meal type selector */}
        <ChipScrollRow
          options={mealTypeOptions}
          selected={selectedMealType}
          onSelect={setSelectedMealType}
          style={styles.mealTypeScroll}
          contentContainerStyle={styles.mealTypeContent}
          edgeFadeColor="surface"
        />

        {/* Search input */}
        <View style={styles.searchBarWrapper}>
          <BottomSheetSearchBar
            ref={searchBarRef}
            placeholder={t('addMealSheet.searchPlaceholder')}
            onChangeText={handleDebouncedSearch}
            onClear={handleClearSearch}
            isLoading={searchingApi}
            debounceMs={500}
            autoCapitalize="none"
          />
        </View>

        {/* Only the saved-recipe rows repeat; everything else is a fixed block
            above or below them, so header/footer cover it without a mixed
            item type. */}
        <FlashList
          renderScrollComponent={BottomSheetScrollable}
          data={filteredRecipes}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          renderItem={({ item }) => (
            <SavedRecipeRow
              savedRecipeRef={item}
              onPress={handleSelectRecipe}
            />
          )}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={
            FLASHLIST_DEFAULTS.bottomSheet.onEndReachedThreshold
          }
          drawDistance={FLASHLIST_DEFAULTS.bottomSheet.drawDistance}
          maxItemsInRecyclePool={
            FLASHLIST_DEFAULTS.bottomSheet.maxItemsInRecyclePool
          }
          ListHeaderComponent={
            <>
              {/* Custom meal row */}
              {hasQuery ? (
                <AppPressable
                  onPress={handleAddCustomMeal}
                  style={styles.customMealRow}
                >
                  <Icon name="add-circle-outline" size={24} tone="primary" />
                  <Text style={styles.customMealText} numberOfLines={1}>
                    {t('addMealSheet.addCustom', { query: searchQuery.trim() })}
                  </Text>
                </AppPressable>
              ) : null}

              {/* Shown whenever there are rows beneath it, searching or not.
                  During a search it separates saved matches from the API
                  results that follow; with no matches there's no section to
                  label, so it drops out. */}
              {filteredRecipes.length > 0 ? (
                <Text style={styles.sectionHeader}>
                  {t('addMealSheet.yourRecipes')}
                </Text>
              ) : null}
            </>
          }
          ListFooterComponent={
            <>
              {/* Additional search results */}
              {hasQuery && (searchingApi || spoonacularResults.length > 0) ? (
                <>
                  {searchingApi ? (
                    <View style={styles.loadingContainer}>
                      <PrimaryActivityIndicator size="small" />
                    </View>
                  ) : null}

                  {spoonacularResults.map(item => (
                    <AppPressable
                      key={item.id}
                      onPress={() => handleSelectSpoonacularRecipe(item)}
                      disabled={loadingItemId === item.spoonacularId}
                      style={styles.recipeItem}
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
                                  {t(DIET_TAG_LABEL_KEYS[tag])}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                      {loadingItemId === item.spoonacularId ? (
                        <PrimaryActivityIndicator size="small" />
                      ) : (
                        <Icon
                          name="add-circle-outline"
                          size={24}
                          tone="primary"
                        />
                      )}
                    </AppPressable>
                  ))}
                </>
              ) : null}

              {/* Empty state */}
              {!hasQuery && recipes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    {t('addMealSheet.noSavedRecipes')}
                  </Text>
                </View>
              ) : null}

              {hasQuery &&
              filteredRecipes.length === 0 &&
              !searchingApi &&
              spoonacularResults.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    {t('addMealSheet.noResults')}
                  </Text>
                </View>
              ) : null}
            </>
          }
        />
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
  mealTypeContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
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
    borderCurve: 'continuous',
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
    marginTop: theme.spacing.xs,
  },
  dietTag: {
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
  },
  dietTagText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textTertiary,
    fontWeight: theme.fonts.weight.medium,
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
