import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useTranslation, type TranslationKey } from '#/i18n';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import {
  ChipScrollRow,
  type ChipOption,
} from '#components/molecules/ChipScrollRow';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import { FlashList } from '@shopify/flash-list';
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Icon } from '#utils/iconUtils';
import { MealType } from '#/graphql/generated/schemaTypes';
import {
  MEAL_TYPE_LABEL_KEYS,
  MEAL_TYPE_ORDER,
} from '#features/mealPlan/utils/mealPlanEnumLabels';
import {
  useSavedRecipes,
  type SavedRecipeNode,
} from '#features/recipes/hooks/useSavedRecipes';
import { SavedRecipeRow } from './SavedRecipeRow';
import { CachedImage, warmImage } from '#components/atoms/CachedImage';
import { SearchBar, type SearchBarRef } from '#components/molecules/SearchBar';
import type { TransformedRecipeItem, DietTag } from '#domain/recipeTransform';
import { useRecipePreload } from '#features/recipes/hooks/useRecipePreload';
import { fetchRecipeInformation } from '#features/recipes/store/useRecipeCacheStore';
import { useRecipeTextSearch } from '#features/recipes/hooks/useRecipeTextSearch';
import { toastService } from '#/services/toastService';
import { executeAsyncWithCleanup } from '#/utils/finallyHelpers';
import { filterByTerm } from '#hooks/search/useLocalSearch';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { EmptyState } from '#components/molecules/EmptyState';
import { Loading } from '#components/molecules/Loading';

interface AddMealSheetProps {
  visible: boolean;
  onClose: () => void;
  initialMealType?: MealType;
  onAddRecipe: (recipeId: string, mealType: MealType) => void;
  onAddCustomMeal: (name: string, mealType: MealType) => void;
}

const DIET_TAG_LABEL_KEYS: Record<DietTag, TranslationKey> = {
  vegan: 'addMealSheet.dietVegan',
  vegetarian: 'addMealSheet.dietVegetarian',
  glutenFree: 'addMealSheet.dietGlutenFree',
  dairyFree: 'addMealSheet.dietDairyFree',
};

/** How long an add waits for the recipe's image, on top of saving it. */
const IMAGE_WARM_MAX_MS = 1500;

/** Module-level helper to reset sheet state when it opens */
function resetSheetState(
  initialMealType: MealType | undefined,
  setSearchQuery: (v: string) => void,
  setSelectedMealType: (v: MealType) => void,
  setLoadingItemId: (v: number | null) => void,
) {
  setSearchQuery('');
  setSelectedMealType(initialMealType ?? MealType.Dinner);
  setLoadingItemId(null);
}

// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';
const keyExtractor = (savedRecipe: SavedRecipeNode) => savedRecipe.id;

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
  const hasQuery = searchQuery.trim().length > 0;
  const {
    state: { recipes, hasMore, isLoadingRemainingPages },
    actions: { loadMore },
  } = useSavedRecipes({ loadAllPages: hasQuery });

  const {
    results: spoonacularResults,
    searching: searchingApi,
    search: searchSpoonacular,
    clear: clearSpoonacular,
  } = useRecipeTextSearch();
  const [loadingItemId, setLoadingItemId] = useState<number | null>(null);

  const { preloadRecipe } = useRecipePreload();
  const BottomSheetScrollable = useBottomSheetScrollableCreator();

  const searchBarRef = useRef<SearchBarRef>(null);

  // Reset state when sheet opens
  useEffect(() => {
    if (visible) {
      resetSheetState(
        initialMealType,
        setSearchQuery,
        setSelectedMealType,
        setLoadingItemId,
      );
      clearSpoonacular();
      searchBarRef.current?.clear();
    }
  }, [visible, initialMealType, clearSpoonacular]);

  const handleDebouncedSearch = (text: string) => {
    setSearchQuery(text);
    searchSpoonacular(text);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    clearSpoonacular();
  };

  const handleSelectRecipe = (recipeId: string) => {
    onAddRecipe(recipeId, selectedMealType);
    onClose();
  };

  const handleAddCustomMeal = () => {
    // Read immediate value from ref to avoid debounce-lag edge case
    const trimmed = (searchBarRef.current?.getValue() ?? searchQuery).trim();
    if (!trimmed) return;
    onAddCustomMeal(trimmed, selectedMealType);
    onClose();
  };

  const handleSelectSpoonacularRecipe = (item: TransformedRecipeItem) => {
    setLoadingItemId(item.spoonacularId);

    void executeAsyncWithCleanup(
      async () => {
        // With nutrition, so the ingest below fills the ingredient mirror; the
        // same cached entry the detail screen reads.
        const fullRecipe = await fetchRecipeInformation(item.spoonacularId);

        // Deliberate save (add to meal plan) → withCost re-ingests with the
        // recipe-scoped priceBreakdown so per-ingredient cost lands in the mirror.
        const preloaded = await preloadRecipe(fullRecipe, undefined, {
          withCost: true,
        });
        // The saved recipe's image is the server's own copy, a URL this device
        // has never loaded, so the new meal card would open on a shimmer.
        if (preloaded?.imageUrl) {
          await warmImage(preloaded.imageUrl, IMAGE_WARM_MAX_MS);
        }
        if (preloaded) {
          onAddRecipe(preloaded.id, selectedMealType);
          onClose();
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
    if (hasMore) {
      void loadMore();
    }
  };

  // Filtering moved up from the row so the list's item count matches what is
  // actually rendered — a virtualized list can't absorb rows that return null.
  const filteredRecipes = filterByTerm(recipes, searchQuery, [
    r => r.recipe.name,
  ]);

  const mealTypeOptions: ChipOption<MealType>[] = MEAL_TYPE_ORDER.map(type => ({
    key: type,
    label: t(MEAL_TYPE_LABEL_KEYS[type]),
  }));

  return (
    <BottomSheetModal
      ref={ref}
      {...modalProps}
      android_keyboardInputMode="adjustResize"
    >
      <View style={[styles.content, contentContainerStyle]}>
        <View style={styles.header}>
          <Text role="heading" style={styles.headerTitle}>
            {t('labels.addAMeal')}
          </Text>
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
          <SearchBar
            showSearchIcon
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
                  <Text
                    role="bodyStrong"
                    style={styles.customMealText}
                    numberOfLines={1}
                  >
                    {t('addMealSheet.addCustom', { query: searchQuery.trim() })}
                  </Text>
                </AppPressable>
              ) : null}

              {/* Shown whenever there are rows beneath it, searching or not.
                  During a search it separates saved matches from the API
                  results that follow; with no matches there's no section to
                  label, so it drops out. */}
              {filteredRecipes.length > 0 ? (
                <SectionHeader
                  variant="overline"
                  style={styles.sectionHeaderSpacing}
                >
                  {t('addMealSheet.yourRecipes')}
                </SectionHeader>
              ) : null}
            </>
          }
          ListFooterComponent={
            <>
              {hasQuery && isLoadingRemainingPages ? (
                <Loading
                  size="small"
                  message={t('recipes.savedRecipesSearchingAll')}
                  style={styles.loadingRemaining}
                />
              ) : null}

              {/* Additional search results */}
              {hasQuery && (searchingApi || spoonacularResults.length > 0) ? (
                <>
                  {searchingApi ? (
                    <View style={styles.centeredSpinner}>
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
                        <Text role="bodyStrong" numberOfLines={1}>
                          {item.title}
                        </Text>
                        {item.subtitle ? (
                          <Text
                            role="caption"
                            tone="secondary"
                            style={styles.recipeMeta}
                            numberOfLines={1}
                          >
                            {item.subtitle}
                          </Text>
                        ) : null}
                        {item.dietTags && item.dietTags.length > 0 ? (
                          <View style={styles.dietTagsRow}>
                            {item.dietTags.map(tag => (
                              <View key={tag} style={styles.dietTag}>
                                <Text role="label" style={styles.dietTagText}>
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
                <EmptyState
                  size="compact"
                  title={t('addMealSheet.noSavedRecipes')}
                />
              ) : null}

              {hasQuery &&
              filteredRecipes.length === 0 &&
              !isLoadingRemainingPages &&
              !searchingApi &&
              spoonacularResults.length === 0 ? (
                <EmptyState
                  size="compact"
                  title={t('addMealSheet.noResults')}
                />
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
  customMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  customMealText: {
    flex: 1,
    color: theme.colors.primary,
  },
  recipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
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
  recipeMeta: {
    marginTop: theme.spacing['2xs'],
  },
  dietTagsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  dietTag: {
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: theme.spacing.xsPlus,
    paddingVertical: theme.spacing['3xs'],
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
  },
  dietTagText: {
    color: theme.colors.textTertiary,
  },
  sectionHeaderSpacing: {
    paddingVertical: theme.spacing.sm,
  },
  loadingRemaining: {
    flex: 0,
    paddingVertical: theme.spacing.md,
  },
  centeredSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['3xl'],
  },
}));
