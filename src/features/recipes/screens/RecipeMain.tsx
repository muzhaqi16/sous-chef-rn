import React, { useState, useRef } from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { useFocusEffect } from '@react-navigation/native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddMenu } from '#hooks/navigation/useTabBarAddMenu';
import { useTabBarSetters } from '#/context/TabBarActionsContext';
import { CaptureRows } from '#features/recipes/components/capture/CaptureRows';
import { RecipeCaptureHost } from '#features/recipes/components/capture/RecipeCaptureHost';
import { useRecipeCaptureMenu } from '#features/recipes/components/capture/useRecipeCaptureMenu';
import { useCollapsibleScroll } from '#hooks/animations/useCollapsibleScroll';
import { StyleSheet } from 'react-native-unistyles';
import { ItemList } from '#components/organisms/ItemList';
import {
  SearchBar,
  type SearchBarAction,
} from '#components/molecules/SearchBar';
import { Icon } from '#components/atoms/Icon';
import { ModeTabs } from '#components/molecules/ModeTabs';
import { useTabScreenLifecycle } from '#hooks/performance/useTabScreenLifecycle';
import { useCommitTracking } from '#hooks/performance/useCommitTracking';
import { DeferredScreen } from '#components/performance/DeferredScreen';
import { RecipeSkeleton } from '#features/recipes/components/skeletons/RecipeSkeleton';
import { RecipeItemSkeleton } from '#features/recipes/components/skeletons/RecipeItemSkeleton';
import { PaginationFooter } from '#components/atoms/PaginationFooter';
import { SpotlightCoachMark } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { useTutorialSequence } from '#hooks/ui/useTutorialSequence';
import { useTranslation, type TranslationKey } from '#/i18n';
import { IngredientSelectorSheet } from '#features/recipes/components/recipeSearch/IngredientSelectorSheet';
import { useRecipeScreen } from '#features/recipes/screens/useRecipeScreen';
import { RecipeFilterSheet } from '#features/recipes/components/RecipeFilterSheet';
import { ActiveFilterChipsRow } from '#features/recipes/components/ActiveFilterChipsRow';
import { Text } from '#components/atoms/Text';
import { Screen } from '#components/templates/Screen';
import { recipesTestIDs } from '#features/recipes/testIDs';
import type { BarAction } from '#components/molecules/BarActions';
import { getRecipeTutorialSteps } from '#features/recipes/components/recipeTutorialSteps';
import {
  RecipeSearchInput,
  type RecipeSearchInputRef,
} from '#features/recipes/components/RecipeSearchInput';
import { hitSlop } from '#/theme/foundations/sizes';

type RecipeSearchMode = 'name' | 'ingredients';
const SEARCH_MODES: readonly RecipeSearchMode[] = ['name', 'ingredients'];
const SEARCH_MODE_LABEL: Record<RecipeSearchMode, TranslationKey> = {
  name: 'recipes.searchByName',
  ingredients: 'recipes.searchByIngredients',
};

// ── Inner component (thin — delegates to useRecipeScreen facade) ──

const RecipeMainInner: React.FC = () => {
  const { t } = useTranslation();
  useCommitTracking('RecipeMain');
  const { toRecipeCreate, toRecipeDetail, toSavedRecipes, toMyRecipes } =
    useAppNavigation();

  // Single facade hook for all data + state
  const screen = useRecipeScreen();

  const searchInputRef = useRef<RecipeSearchInputRef>(null);

  // ── Scroll direction tracking (tab bar hide on scroll down) ──
  const { scrollTabBarHidden } = useTabBarSetters();
  const {
    scrollBeginDragHandler,
    scrollHandler,
    scrollEndDragHandler,
    momentumEndHandler,
    isScrolledDown,
    isUserDragging,
  } = useCollapsibleScroll();

  useAnimatedReaction(
    () => isScrolledDown.get(),
    hidden => {
      scrollTabBarHidden.set(hidden);
    },
  );

  const [isRecipeFocused, setIsRecipeFocused] = useState(true);
  const [onRecipeFocus] = useState(() => () => {
    setIsRecipeFocused(true);
    // Return to a clean, visible tab bar on focus so a stale scroll-hidden
    // state from a previous visit can never leave the bar hidden.
    isScrolledDown.set(false);
    isUserDragging.set(false);
    scrollTabBarHidden.set(false);
    return () => {
      setIsRecipeFocused(false);
      // Reset scroll-driven tab bar hide so tab bar reappears on other tabs
      isUserDragging.set(false);
      scrollTabBarHidden.set(false);
    };
  });
  useFocusEffect(onRecipeFocus);

  type LayoutRect = { x: number; y: number; width: number; height: number };
  type TutorialTarget =
    | 'savedButton'
    | 'myRecipesButton'
    | 'dietaryButton'
    | 'pantryButton';

  // Single state for all layout rects — avoids 4 separate re-renders
  const [buttonRects, setButtonRects] = useState<
    Partial<Record<TutorialTarget, LayoutRect>>
  >({});
  const setButtonRect = (key: TutorialTarget, rect: LayoutRect) => {
    setButtonRects(prev => {
      // Skip if already measured — button positions don't change after initial layout
      if (prev[key]) return prev;
      return { ...prev, [key]: rect };
    });
  };

  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Each sheet takes `visible`; `useStandardBottomSheet` presents and dismisses
  // off it, releasing the backdrop on blur. No manual present or dismiss: those
  // hit gorhom 5.2.14's dismiss-before-present wedge.
  const [ingredientSheetVisible, setIngredientSheetVisible] = useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  const tutorial = useTutorialSequence({
    steps: getRecipeTutorialSteps(t),
    targetRects: {
      savedButton: buttonRects.savedButton ?? null,
      myRecipesButton: buttonRects.myRecipesButton ?? null,
      dietaryButton: buttonRects.dietaryButton ?? null,
      pantryButton: buttonRects.pantryButton ?? null,
    },
    canStart: true,
    isPaused: !isRecipeFocused || isSheetOpen,
  });

  useTabScreenLifecycle({
    screenName: 'RecipeMain',
    // No recipe entity persists optimistic field markers — favorites survive a
    // restart through the raw MMKV Apollo cache (savedRecipesConnection edges),
    // not this per-field restore path.
    optimisticTypes: [],
    telemetryProperties: () => ({
      discovery_count: screen.discovery.rows.length,
      view: 'discovery',
    }),
  });

  // Capture is a seam: off, its entries, sheets and rows are not rendered and
  // the `+` writes a recipe at once, as it always has.
  const capture = useRecipeCaptureMenu();

  // The ways to add a recipe, nearest the `+` first; one entry runs at once.
  useTabBarAddMenu([
    ...capture.entries,
    {
      key: 'manual',
      label: t('recipes.writeItMyself'),
      icon: 'create-outline',
      onPress: () => toRecipeCreate(),
      testID: recipesTestIDs.addManually,
    },
  ]);

  const openIngredientSelector = () => {
    setIngredientSheetVisible(true);
  };

  const openFilterSheet = () => {
    setFilterSheetVisible(true);
  };

  // Track sheet open/close — filters are saved on close but search is NOT
  // auto-triggered; the user presses the search button to apply new filters.
  // Also keep our visibility state in sync when the user dismisses via swipe.
  const handleSheetChange = (index: number) => {
    setIsSheetOpen(index >= 0);
    if (index < 0) {
      setFilterSheetVisible(false);
    }
  };

  const handleItemPress = (id: string | number) => {
    const row = screen.items.find(item => item.id === String(id));
    if (row) toRecipeDetail(row.target);
  };

  // Two ways to search: by name with the diet filters, or by what the pantry
  // holds. The API cannot combine them, so they are modes, not filters.
  const [chosenSearchMode, setSearchMode] = useState<RecipeSearchMode>(
    screen.selectedIngredients.size > 0 ? 'ingredients' : 'name',
  );
  const searchMode: RecipeSearchMode = screen.hasPantryItems
    ? chosenSearchMode
    : 'name';
  // A search belongs to the mode that ran it, so switching modes drops it and
  // the list returns to suggestions. The picked ingredients stay picked.
  const switchSearchMode = (mode: RecipeSearchMode) => {
    if (mode === searchMode) return;
    screen.clearSearch();
    setSearchMode(mode);
  };

  const filterAccessory: SearchBarAction = {
    icon: 'options-outline',
    onPress: openFilterSheet,
    accessibilityLabel: t('recipes.dietaryRestrictions'),
    badge: screen.activeFilterCount,
    onButtonLayout: (rect: LayoutRect) => setButtonRect('dietaryButton', rect),
  };

  const ingredientNames = [...screen.selectedIngredients].join(', ');

  const headerActions: BarAction[] = [
    {
      icon: 'bookmark-outline',
      tone: 'textSecondary',
      onPress: toSavedRecipes,
      accessibilityLabel: t('recipes.savedRecipes'),
      onMeasure: rect => setButtonRect('savedButton', rect),
    },
    {
      icon: 'create-outline',
      tone: 'textSecondary',
      onPress: toMyRecipes,
      accessibilityLabel: t('recipes.myRecipes'),
      onMeasure: rect => setButtonRect('myRecipesButton', rect),
    },
  ];

  const DiscoveryHeader = (() => {
    if (!screen.showDiscovery) return null;
    const isPantry = screen.discovery.mode === 'pantry';
    const busy = screen.discovery.loading || screen.discovery.refreshing;
    return (
      <View style={styles.suggestedHeader}>
        <View style={styles.suggestedTextContainer}>
          <Text role="heading">
            {isPantry
              ? t('recipes.basedOnPantry')
              : t('recipes.needInspiration')}
          </Text>
          <Text
            role="caption"
            tone="secondary"
            style={styles.suggestedSubtitle}
          >
            {isPantry
              ? t('recipes.recipesYouCanMake')
              : t('recipes.recipeIdeasToTry')}
          </Text>
        </View>
        <AppPressable
          style={styles.refreshButton}
          onPress={screen.discovery.refresh}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('recipes.refreshSuggestions')}
        >
          <Icon
            name="refresh"
            size={20}
            tone={busy ? 'textSecondary' : 'primary'}
          />
        </AppPressable>
      </View>
    );
  })();

  const SearchResultsHeader = (() => {
    if (!screen.showSearchResults) return null;
    return (
      <View style={styles.searchResultsHeader}>
        <Text role="label" tone="secondary">
          {t(
            screen.searchResults.length === 1
              ? 'recipes.resultSingular'
              : 'recipes.resultPlural',
            { count: screen.searchResults.length },
          )}
        </Text>
        <Pressable
          onPress={() => {
            screen.clearSearch();
            searchInputRef.current?.clear();
          }}
          hitSlop={hitSlop.md}
          accessibilityRole="button"
          accessibilityLabel={t('recipes.clearSearch')}
        >
          <Icon name="close" size={20} tone="textSecondary" />
        </Pressable>
      </View>
    );
  })();

  const ListHeader = screen.showSearchResults
    ? SearchResultsHeader
    : screen.showDiscovery
    ? DiscoveryHeader
    : null;

  const recipeListHeader = (
    <>
      {capture.enabled ? <CaptureRows /> : null}
      {/* Only text search takes filters, so the active-filter row shows only
          while one drives the screen; the header badge is always on. */}
      {screen.searchPerformed && screen.searchQuery.trim() !== '' ? (
        <ActiveFilterChipsRow
          filters={screen.activeFilters}
          onRemoveFilter={screen.removeFilter}
          onClearAll={screen.clearFiltersAndSearchAgain}
        />
      ) : null}
      {ListHeader}
    </>
  );

  return (
    <Screen
      testID={recipesTestIDs.recipesScreen}
      header={{
        variant: 'tab',
        title: t('labels.recipes'),
        actions: headerActions,
      }}
      scroll="list"
      gutter="none"
    >
      {/* Above the list, not inside it: the spinner drops from the list's top. */}
      <View style={styles.gutter}>
        {screen.hasPantryItems ? (
          <View style={styles.modes}>
            <ModeTabs<RecipeSearchMode>
              options={SEARCH_MODES}
              value={searchMode}
              onChange={switchSearchMode}
              formatLabel={mode => t(SEARCH_MODE_LABEL[mode])}
              tabTestID={recipesTestIDs.searchModeTab}
              onTabLayout={(mode, rect) => {
                if (mode === 'ingredients') setButtonRect('pantryButton', rect);
              }}
            />
          </View>
        ) : null}
        {searchMode === 'name' ? (
          <RecipeSearchInput
            ref={searchInputRef}
            onSearch={screen.handleTextSearch}
            initialQuery={screen.searchQuery}
            onClear={screen.clearSearch}
            accessory={filterAccessory}
          />
        ) : (
          // The same field, read-only: it shows the picked ingredients and
          // opens the pantry picker, whose Search button runs the search.
          <Pressable
            onPress={openIngredientSelector}
            accessibilityRole="button"
            accessibilityLabel={ingredientNames || t('recipes.cookWithPantry')}
            testID={recipesTestIDs.ingredientPicker}
          >
            <View pointerEvents="none">
              <SearchBar
                value={ingredientNames}
                onChangeText={noop}
                placeholder={t('recipes.cookWithPantry')}
                editable={false}
              />
            </View>
          </Pressable>
        )}
      </View>
      {/* A search in flight always shows the skeleton so the tap gets instant
          feedback (and any stale prior results are replaced); discovery's
          initial load only skeletons when there's nothing on screen yet. */}
      {screen.searchLoading ||
      (screen.discovery.loading &&
        !screen.showSearchResults &&
        screen.items.length === 0) ? (
        <>
          <View style={styles.gutter}>{recipeListHeader}</View>
          <RecipeSkeleton />
        </>
      ) : (
        <ItemList
          items={screen.items}
          onItemPress={handleItemPress}
          onRefresh={screen.handleRefresh}
          emptyState={screen.emptyStateConfig}
          dataMode={screen.showSearchResults ? 'search' : 'discovery'}
          onScroll={scrollHandler}
          onScrollBeginDrag={scrollBeginDragHandler}
          onScrollEndDrag={scrollEndDragHandler}
          onMomentumScrollEnd={momentumEndHandler}
          scrollEventThrottle={16}
          ListHeaderComponent={recipeListHeader}
          onEndReached={
            screen.searchHasMore
              ? screen.loadMoreSearch
              : screen.discoveryHasMore
              ? screen.loadMoreDiscovery
              : undefined
          }
          ListFooterComponent={
            <PaginationFooter
              hasMore={screen.searchHasMore || screen.discoveryHasMore}
              isFetchingMore={
                screen.searchLoadingMore || screen.pantryLoadingMore
              }
              itemCount={screen.items.length}
              SkeletonComponent={RecipeItemSkeleton}
              skeletonCount={2}
            />
          }
        />
      )}

      <IngredientSelectorSheet
        visible={ingredientSheetVisible}
        screen={screen}
        onSheetChange={open => {
          setIsSheetOpen(open);
          if (!open) {
            setIngredientSheetVisible(false);
          }
        }}
      />

      {capture.enabled ? <RecipeCaptureHost {...capture.host} /> : null}

      {/* Filter Bottom Sheet — lazy-mounted for performance */}
      <RecipeFilterSheet
        visible={filterSheetVisible}
        onRequestClose={() => setFilterSheetVisible(false)}
        activeFilters={screen.activeFilters}
        onApplyFilters={screen.applyFilters}
        onSheetChange={handleSheetChange}
        isIngredientSearch={
          screen.selectedIngredients.size > 0 ||
          (!screen.showSearchResults && screen.discovery.mode === 'pantry')
        }
      />

      {tutorial.currentStep ? (
        <SpotlightCoachMark
          targetRect={tutorial.currentStep.targetRect}
          title={tutorial.currentStep.title}
          subtitle={tutorial.currentStep.subtitle}
          stepIndex={tutorial.currentStep.stepIndex}
          totalSteps={tutorial.currentStep.totalSteps}
          onDismiss={tutorial.skipAll}
          onNext={tutorial.advanceInPlace}
          onTargetPress={() => {
            const actions: Record<number, () => void> = {
              0: toSavedRecipes,
              1: toMyRecipes,
              2: openFilterSheet,
              3: () => {
                switchSearchMode('ingredients');
                openIngredientSelector();
              },
            };
            const step = tutorial.currentStep;
            if (step) actions[step.stepIndex]?.();
            tutorial.advance();
          }}
        />
      ) : null}
    </Screen>
  );
};

const noop = () => {};

const RecipeMainFallback: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Screen
      testID={recipesTestIDs.recipesScreen}
      header={{
        variant: 'tab',
        title: t('labels.recipes'),
      }}
      scroll="list"
      gutter="none"
    >
      <View style={styles.gutter}>
        <SearchBar
          value=""
          onChangeText={noop}
          placeholder={t('recipes.searchPlaceholder')}
          editable={false}
        />
      </View>
      <RecipeSkeleton />
    </Screen>
  );
};

export const RecipeMain: React.FC = () => (
  <DeferredScreen
    fallback={<RecipeMainFallback />}
    component={RecipeMainInner}
  />
);

const styles = StyleSheet.create(theme => ({
  // Chrome renders bare under `gutter="none"`, with no list content container
  // to inset it, so this screen supplies the gutter.
  gutter: {
    paddingHorizontal: theme.layout.pageGutter,
  },
  modes: {
    marginBottom: theme.spacing.sm,
  },
  suggestedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    // The row rhythm, so this header sits in the list's spacing rather than a
    // tighter one of its own.
    marginVertical: theme.layout.rowGap,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  suggestedTextContainer: { flex: 1 },
  suggestedSubtitle: {
    marginTop: theme.spacing['2xs'],
  },
  refreshButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    marginVertical: theme.layout.rowGap,
  },
}));
