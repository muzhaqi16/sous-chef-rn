import React, {
  useEffect,
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { useFocusEffect } from '@react-navigation/native';
import { useAnimatedReaction } from 'react-native-reanimated';
import type { BottomSheetModalRef } from '#hooks/useStandardBottomSheet';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { useTabBarSetters } from '#/context/TabBarActionsContext';
import { useCollapsibleScroll } from '#hooks/animations/useCollapsibleScroll';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { ItemList } from '#components/organisms/ItemList';
import {
  SearchBar,
  type SearchBarAction,
} from '#components/molecules/SearchBar';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { TabMainScreen } from '#components/templates/TabMainScreen';
import { Icon } from '#/utils/iconUtils';
import { useTabScreenLifecycle } from '#hooks/performance/useTabScreenLifecycle';
import { useRenderTime } from '#hooks/performance/useRenderTime';
import { DeferredScreen } from '#components/performance/DeferredScreen';
import { RecipeSkeleton } from '#components/base/Skeleton/RecipeSkeleton';
import { PaginationFooter } from '#components/organisms/PaginationFooter';
import { SpotlightCoachMark } from '#/components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import {
  useTutorialSequence,
  type TutorialStep,
} from '#hooks/ui/useTutorialSequence';
import { useTranslation } from 'react-i18next';
import {
  IngredientSelectorSheet,
  type IngredientSelectorSheetRef,
} from './RecipeSearch/IngredientSelectorSheet';
import { useRecipeScreen } from '#features/recipes/hooks/useRecipeScreen';
import { RecipeFilterSheet } from './RecipeFilterSheet';
import { ActiveFilterChipsRow } from '#features/recipes/components/ActiveFilterChipsRow';
import { Text } from '#components/atoms/Text';

// ── Recipe tutorial steps (titles/subtitles resolved at usage via t()) ──
type T = (key: string, opts?: Record<string, unknown>) => string;
const getRecipeTutorialSteps = (t: T): TutorialStep[] => [
  {
    featureId: 'recipe_tutorial_saved',
    title: t('recipes.savedRecipes'),
    subtitle: t('recipes.savedRecipesSubtitle'),
    rectKey: 'savedButton',
  },
  {
    featureId: 'recipe_tutorial_my_recipes',
    title: t('recipes.myRecipes'),
    subtitle: t('recipes.myRecipesSubtitle'),
    rectKey: 'myRecipesButton',
  },
  {
    featureId: 'recipe_tutorial_dietary',
    title: t('recipes.dietaryRestrictions'),
    subtitle: t('recipes.dietaryRestrictionsSubtitle'),
    rectKey: 'dietaryButton',
  },
  {
    featureId: 'recipe_tutorial_pantry',
    title: t('recipes.cookWithPantry'),
    subtitle: t('recipes.cookWithPantrySubtitle'),
    rectKey: 'pantryButton',
  },
];

// ── Isolated search input — keystrokes only re-render this component ──

interface RecipeSearchInputRef {
  clear: () => void;
}

interface RecipeSearchInputProps {
  onSearch: (query: string) => void;
  extraActions: SearchBarAction[];
  /** Seeds the field so the submitted query survives the screen's
   * skeleton↔list remounts (this component is rendered in two tree positions).
   * Read once on mount — keystrokes stay local to keep the parent from
   * re-rendering on every character. */
  initialQuery: string;
  /** Tapped the ✕ — clear the field and cancel the active search. */
  onClear: () => void;
}

const RecipeSearchInput = forwardRef<
  RecipeSearchInputRef,
  RecipeSearchInputProps
>(({ onSearch, extraActions, initialQuery, onClear }, ref) => {
  const { t } = useTranslation();
  const [inputQuery, setInputQuery] = useState(initialQuery);
  // `useUnistyles()` is intentional: theme colors are constructed into the
  // dynamic `SearchBarAction[]` prop array passed to `<SearchBar>`. The action
  // shape carries `color`/`backgroundColor` strings, so a `withUnistyles`
  // wrap on SearchBar would require redesigning the SearchBarAction type.
  const { theme } = useUnistyles();

  useImperativeHandle(ref, () => ({
    clear: () => setInputQuery(''),
  }));

  const rightActions: SearchBarAction[] = [
    ...extraActions,
    {
      icon: 'search',
      onPress: () => onSearch(inputQuery),
      color: theme.colors.primary,
      backgroundColor: theme.colors.surface,
      testID: 'recipe-main-search-submit',
    },
  ];

  return (
    <View style={styles.searchBarContainer}>
      <SearchBar
        value={inputQuery}
        onChangeText={setInputQuery}
        onClear={onClear}
        onSubmitEditing={() => onSearch(inputQuery)}
        returnKeyType="search"
        placeholder={t('recipes.searchPlaceholder')}
        rightActions={rightActions}
        testID="recipe-main-search-input"
      />
    </View>
  );
});

// ── Inner component (thin — delegates to useRecipeScreen facade) ──

const RecipeMainInner: React.FC = () => {
  const { t } = useTranslation();
  useRenderTime('RecipeMain');
  const { toRecipeCreate, toRecipeDetail, toSavedRecipes, toMyRecipes } =
    useAppNavigation();
  // `useUnistyles()` is intentional: same `SearchBarAction[]` construction
  // pattern as `RecipeSearchInput` above — theme strings flow into a runtime
  // prop array that can't move into a stylesheet.
  const { theme } = useUnistyles();

  // Single facade hook for all data + state
  const screen = useRecipeScreen();

  const searchInputRef = useRef<RecipeSearchInputRef>(null);

  // ── Scroll direction tracking (tab bar hide on scroll down) ──
  const { scrollTabBarHidden } = useTabBarSetters();
  const {
    scrollHandler,
    scrollEndDragHandler,
    momentumEndHandler,
    isScrolledDown,
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
    scrollTabBarHidden.set(false);
    return () => {
      setIsRecipeFocused(false);
      // Reset scroll-driven tab bar hide so tab bar reappears on other tabs
      scrollTabBarHidden.set(false);
    };
  });
  useFocusEffect(onRecipeFocus);

  type LayoutRect = { x: number; y: number; width: number; height: number };
  const savedButtonRef = useRef<View>(null);
  const myRecipesButtonRef = useRef<View>(null);
  const dietaryButtonRef = useRef<View>(null);

  // Single state for all layout rects — avoids 4 separate re-renders
  const [buttonRects, setButtonRects] = useState<
    Record<string, LayoutRect | null>
  >({});
  const setButtonRect = (key: string, rect: LayoutRect) => {
    setButtonRects(prev => {
      // Skip if already measured — button positions don't change after initial layout
      if (prev[key]) return prev;
      return { ...prev, [key]: rect };
    });
  };

  const filterSheetRef = useRef<BottomSheetModalRef>(null);
  const ingredientSheetRef = useRef<IngredientSelectorSheetRef>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Per CLAUDE.md: never call present()/dismiss() directly outside of an
  // effect. We track desired sheet visibility in state and let an effect
  // imperatively present/dismiss the underlying ref-based sheets.
  const [ingredientSheetVisible, setIngredientSheetVisible] = useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  useEffect(() => {
    if (ingredientSheetVisible) {
      ingredientSheetRef.current?.present();
    } else {
      ingredientSheetRef.current?.dismiss();
    }
  }, [ingredientSheetVisible]);

  useEffect(() => {
    if (filterSheetVisible) {
      filterSheetRef.current?.present();
    } else {
      filterSheetRef.current?.dismiss();
    }
  }, [filterSheetVisible]);

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
    optimisticTypes: ['Recipe', 'SavedRecipe'],
    telemetryProperties: () => ({
      discovery_count: screen.discovery.items.length,
      view: 'discovery',
    }),
  });

  useTabBarAddButton(() => toRecipeCreate());

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
    const idStr = String(id);
    // `local-` ids come from the local-API portion of combined search results
    // and open the backend recipe detail view.
    if (idStr.startsWith('local-')) {
      toRecipeDetail({ recipeId: idStr.slice('local-'.length) });
      return;
    }
    const externalId = idStr.startsWith('spoonacular-')
      ? idStr.replace('spoonacular-', '')
      : idStr;
    toRecipeDetail({ externalSource: 'SPOONACULAR', externalId });
  };

  const hasIngredientSelection = screen.selectedIngredients.size > 0;
  const searchBarExtraActions: SearchBarAction[] = screen.hasPantryItems
    ? [
        {
          icon: 'restaurant',
          onPress: openIngredientSelector,
          color: hasIngredientSelection
            ? theme.colors.white
            : theme.colors.primary,
          backgroundColor: hasIngredientSelection
            ? theme.colors.primary
            : theme.colors.surface,
          badge: hasIngredientSelection
            ? screen.selectedIngredients.size
            : undefined,
          onButtonLayout: (rect: LayoutRect) =>
            setButtonRect('pantryButton', rect),
        },
      ]
    : [];

  const headerRight = (
    <View style={styles.headerActions}>
      <View
        ref={savedButtonRef}
        collapsable={false}
        onLayout={() => {
          requestAnimationFrame(() => {
            savedButtonRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
              if (w > 0 && h > 0)
                setButtonRect('savedButton', {
                  x: pageX,
                  y: pageY,
                  width: w,
                  height: h,
                });
            });
          });
        }}
      >
        <Pressable
          onPress={toSavedRecipes}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('recipes.savedRecipes')}
        >
          <Icon name="bookmark-outline" size={24} tone="textSecondary" />
        </Pressable>
      </View>
      <View
        ref={myRecipesButtonRef}
        collapsable={false}
        onLayout={() => {
          requestAnimationFrame(() => {
            myRecipesButtonRef.current?.measure(
              (_x, _y, w, h, pageX, pageY) => {
                if (w > 0 && h > 0)
                  setButtonRect('myRecipesButton', {
                    x: pageX,
                    y: pageY,
                    width: w,
                    height: h,
                  });
              },
            );
          });
        }}
      >
        <Pressable
          onPress={toMyRecipes}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('recipes.myRecipes')}
        >
          <Icon name="create-outline" size={24} tone="textSecondary" />
        </Pressable>
      </View>
      <View
        ref={dietaryButtonRef}
        collapsable={false}
        onLayout={() => {
          requestAnimationFrame(() => {
            dietaryButtonRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
              if (w > 0 && h > 0)
                setButtonRect('dietaryButton', {
                  x: pageX,
                  y: pageY,
                  width: w,
                  height: h,
                });
            });
          });
        }}
      >
        <Pressable
          onPress={openFilterSheet}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('recipes.dietaryRestrictions')}
        >
          <View style={styles.filterIconWrapper}>
            <Icon
              name="options-outline"
              size={24}
              tone={screen.activeFilterCount > 0 ? 'primary' : 'textSecondary'}
            />
            {screen.activeFilterCount > 0 ? (
              <View style={styles.filterCountBadge} testID="filter-count-badge">
                <Text style={styles.filterCountBadgeText}>
                  {String(screen.activeFilterCount)}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
    </View>
  );

  const DiscoveryHeader = (() => {
    if (!screen.showDiscovery) return null;
    const isPantry = screen.discovery.mode === 'pantry';
    return (
      <View style={styles.suggestedHeader}>
        <View style={styles.suggestedTextContainer}>
          <Text size="lg" weight="semibold">
            {isPantry
              ? t('recipes.basedOnPantry')
              : t('recipes.needInspiration')}
          </Text>
          <Text size="sm" tone="secondary" style={styles.suggestedSubtitle}>
            {isPantry
              ? t('recipes.recipesYouCanMake')
              : t('recipes.recipeIdeasToTry')}
          </Text>
        </View>
        <AppPressable
          style={styles.refreshButton}
          onPress={screen.discovery.refresh}
          disabled={screen.discovery.loading}
          accessibilityRole="button"
          accessibilityLabel={t('recipes.refreshSuggestions')}
        >
          <Icon
            name="refresh"
            size={20}
            tone={screen.discovery.loading ? 'textSecondary' : 'primary'}
          />
        </AppPressable>
      </View>
    );
  })();

  const SearchResultsHeader = (() => {
    if (!screen.showSearchResults) return null;
    return (
      <View style={styles.searchResultsHeader}>
        <Text size="sm" weight="semibold" tone="secondary">
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
          hitSlop={8}
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
      <TabScreenHeader
        label={t('recipes.mainSubtitle')}
        title={t('recipes.mainTitle')}
        headerRight={headerRight}
      />
      <RecipeSearchInput
        ref={searchInputRef}
        onSearch={screen.handleTextSearch}
        initialQuery={screen.searchQuery}
        onClear={screen.clearSearch}
        extraActions={searchBarExtraActions}
      />
      {/* Filters only apply to text search (discovery + ingredient search
          can't take them) — only surface the active-filter row when a text
          search drives what's on screen. The header badge stays as the
          always-on indicator. */}
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
    <TabMainScreen testID="recipes-screen">
      {/* A search in flight always shows the skeleton so the tap gets instant
          feedback (and any stale prior results are replaced); discovery's
          initial load only skeletons when there's nothing on screen yet. */}
      {screen.searchLoading ||
      (screen.discovery.loading &&
        !screen.showSearchResults &&
        screen.items.length === 0) ? (
        <>
          {recipeListHeader}
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
              isFetchingMore={screen.searchLoading || screen.pantryLoadingMore}
              itemCount={screen.items.length}
              SkeletonComponent={RecipeSkeleton}
              skeletonCount={2}
            />
          }
        />
      )}

      <IngredientSelectorSheet
        ref={ingredientSheetRef}
        screen={screen}
        onSheetChange={open => {
          setIsSheetOpen(open);
          if (!open) {
            setIngredientSheetVisible(false);
          }
        }}
      />

      {/* Filter Bottom Sheet — lazy-mounted for performance */}
      <RecipeFilterSheet
        sheetRef={filterSheetRef}
        activeFilters={screen.activeFilters}
        setActiveFilters={screen.setActiveFilters}
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
              3: openIngredientSelector,
            };
            actions[tutorial.currentStep!.stepIndex]?.();
            tutorial.advance();
          }}
        />
      ) : null}
    </TabMainScreen>
  );
};

const noop = () => {};

const RecipeMainFallback: React.FC = () => {
  const { t } = useTranslation();
  return (
    <TabMainScreen testID="recipes-screen">
      <TabScreenHeader
        label={t('recipes.mainSubtitle')}
        title={t('recipes.mainTitle')}
      />
      <View style={styles.searchBarContainer}>
        <SearchBar
          value=""
          onChangeText={noop}
          placeholder={t('recipes.searchPlaceholder')}
          showSearchIcon
          editable={false}
        />
      </View>
      <RecipeSkeleton />
    </TabMainScreen>
  );
};

export const RecipeMain: React.FC = () => (
  <DeferredScreen
    fallback={<RecipeMainFallback />}
    component={RecipeMainInner}
  />
);

const styles = StyleSheet.create(theme => ({
  searchBarContainer: { paddingHorizontal: theme.spacing['3'] },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  suggestedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing['3'],
    marginVertical: theme.spacing.xs,
    borderRadius: theme.radii.md,
  },
  suggestedTextContainer: { flex: 1 },
  suggestedSubtitle: {
    marginTop: 2,
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
    marginHorizontal: theme.spacing['3'],
    marginTop: theme.spacing.sm,
  },
  filterIconWrapper: {
    // Anchors the absolutely-positioned count badge to the icon bounds
    position: 'relative',
  },
  filterCountBadge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 16,
    height: 16,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterCountBadgeText: {
    color: theme.colors.onPrimary,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  pressed: { opacity: theme.opacity.pressed },
}));
