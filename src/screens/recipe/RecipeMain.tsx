import React, { useState, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
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
import {
  IngredientSelectorSheet,
  type IngredientSelectorSheetRef,
} from './RecipeSearch/IngredientSelectorSheet';
import { useRecipeScreen } from '#/hooks/recipe/useRecipeScreen';
import { RecipeFilterSheet } from './RecipeFilterSheet';

// ── Recipe tutorial steps ──
const RECIPE_TUTORIAL_STEPS: TutorialStep[] = [
  {
    featureId: 'recipe_tutorial_saved',
    title: 'Saved recipes',
    subtitle: 'View all your saved and favorited recipes in one place',
    rectKey: 'savedButton',
  },
  {
    featureId: 'recipe_tutorial_my_recipes',
    title: 'My recipes',
    subtitle: 'Create and manage your own custom recipes',
    rectKey: 'myRecipesButton',
  },
  {
    featureId: 'recipe_tutorial_dietary',
    title: 'Dietary restrictions',
    subtitle: 'Set your dietary preferences to filter recipe results',
    rectKey: 'dietaryButton',
  },
  {
    featureId: 'recipe_tutorial_pantry',
    title: 'Cook with what you have',
    subtitle: 'Search for recipes based on ingredients in your pantry',
    rectKey: 'pantryButton',
  },
];

// ── Inner component (thin — delegates to useRecipeScreen facade) ──

const RecipeMainInner: React.FC = () => {
  useRenderTime('RecipeMain');
  const { navigate } = useAppNavigation();
  const { theme } = useUnistyles();

  // Single facade hook for all data + state
  const screen = useRecipeScreen();

  // ── Scroll direction tracking (tab bar hide on scroll down) ──
  const { scrollTabBarHidden } = useTabBarSetters();
  const { scrollHandler, isScrolledDown } = useCollapsibleScroll();

  useAnimatedReaction(
    () => isScrolledDown.value,
    hidden => {
      scrollTabBarHidden.set(hidden);
    },
  );

  const [isRecipeFocused, setIsRecipeFocused] = useState(true);
  const [onRecipeFocus] = useState(() => () => {
    setIsRecipeFocused(true);
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

  const filterSheetRef = useRef<BottomSheetModal>(null);
  const ingredientSheetRef = useRef<IngredientSelectorSheetRef>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const tutorial = useTutorialSequence({
    steps: RECIPE_TUTORIAL_STEPS,
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

  useTabBarAddButton(() => navigate('RecipeCreate'));

  const openIngredientSelector = () => {
    ingredientSheetRef.current?.present();
  };

  const openFilterSheet = () => {
    filterSheetRef.current?.present();
  };

  // Track sheet open/close via BottomSheetModal's onChange (-1 = closed, 0+ = open)
  const handleSheetChange = (index: number) => {
    const closing = isSheetOpen && index < 0;
    setIsSheetOpen(index >= 0);
    if (closing && screen.searchPerformed && screen.searchQuery.trim()) {
      screen.handleTextSearch();
    }
  };

  const handleItemPress = (id: string | number) => {
    const idStr = String(id);
    const externalId = idStr.startsWith('spoonacular-')
      ? idStr.replace('spoonacular-', '')
      : idStr;
    navigate('RecipeDetail', { externalSource: 'SPOONACULAR', externalId });
  };

  const searchBarRightActions: SearchBarAction[] = [
    ...(screen.hasPantryItems
      ? [
          {
            icon: 'restaurant',
            onPress: openIngredientSelector,
            color:
              screen.selectedIngredients.size > 0
                ? theme.colors.white
                : theme.colors.primary,
            backgroundColor:
              screen.selectedIngredients.size > 0
                ? theme.colors.primary
                : theme.colors.surface,
            badge:
              screen.selectedIngredients.size > 0
                ? screen.selectedIngredients.size
                : undefined,
            onButtonLayout: (rect: LayoutRect) =>
              setButtonRect('pantryButton', rect),
          },
        ]
      : []),
    {
      icon: 'search',
      onPress: screen.handleTextSearch,
      color: theme.colors.primary,
      backgroundColor: theme.colors.surface,
      testID: 'recipe-main-search-submit',
    },
  ];

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
          onPress={() => navigate('SavedRecipes')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Saved recipes"
        >
          <Icon
            name="bookmark-outline"
            size={24}
            color={theme.colors.textSecondary}
          />
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
          onPress={() => navigate('MyRecipes')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="My recipes"
        >
          <Icon
            name="create-outline"
            size={24}
            color={theme.colors.textSecondary}
          />
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
          onPress={
            screen.selectedIngredients.size === 0 ? openFilterSheet : undefined
          }
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dietary restrictions"
          disabled={screen.selectedIngredients.size > 0}
        >
          <Icon
            name="options-outline"
            size={24}
            color={
              screen.selectedIngredients.size > 0
                ? theme.colors.textTertiary
                : screen.activeFilterCount > 0
                ? theme.colors.primary
                : theme.colors.textSecondary
            }
          />
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
          <Text style={styles.suggestedTitle}>
            {isPantry ? 'Based on your pantry' : 'Need inspiration?'}
          </Text>
          <Text style={styles.suggestedSubtitle}>
            {isPantry
              ? 'Recipes you can make with your ingredients'
              : 'Here are some recipe ideas to try'}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.pressed,
          ]}
          onPress={screen.discovery.refresh}
          disabled={screen.discovery.loading}
          accessibilityRole="button"
          accessibilityLabel="Refresh recipe suggestions"
        >
          <Icon
            name="refresh"
            size={20}
            color={
              screen.discovery.loading
                ? theme.colors.textSecondary
                : theme.colors.primary
            }
          />
        </Pressable>
      </View>
    );
  })();

  const SearchResultsHeader = (() => {
    if (!screen.showSearchResults) return null;
    return (
      <View style={styles.searchResultsHeader}>
        <Text style={styles.searchResultsText}>
          {screen.searchResults.length} result
          {screen.searchResults.length !== 1 ? 's' : ''}
        </Text>
        <Pressable
          onPress={screen.clearSearch}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search results"
        >
          <Icon name="close" size={20} color={theme.colors.textSecondary} />
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
        label="What to cook?"
        title="Recipes"
        headerRight={headerRight}
      />
      <View style={styles.searchBarContainer}>
        <SearchBar
          value={screen.searchQuery}
          onChangeText={screen.setSearchQuery}
          onSubmitEditing={screen.handleTextSearch}
          returnKeyType="search"
          placeholder="Search recipes..."
          rightActions={searchBarRightActions}
          testID="recipe-main-search-input"
        />
      </View>
      {ListHeader}
    </>
  );

  return (
    <View style={styles.container} testID="recipes-screen">
      {screen.discovery.loading && !screen.showSearchResults ? (
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
        onSheetChange={open => setIsSheetOpen(open)}
      />

      {/* Filter Bottom Sheet — lazy-mounted for performance */}
      <RecipeFilterSheet
        sheetRef={filterSheetRef}
        activeFilters={screen.activeFilters}
        setActiveFilters={screen.setActiveFilters}
        onSheetChange={handleSheetChange}
      />

      {tutorial.currentStep ? (
        <SpotlightCoachMark
          targetRect={tutorial.currentStep.targetRect}
          title={tutorial.currentStep.title}
          subtitle={tutorial.currentStep.subtitle}
          stepIndex={tutorial.currentStep.stepIndex}
          totalSteps={tutorial.currentStep.totalSteps}
          onDismiss={tutorial.skipAll}
          onTargetPress={() => {
            const actions: Record<number, () => void> = {
              0: () => navigate('SavedRecipes'),
              1: () => navigate('MyRecipes'),
              2: openFilterSheet,
              3: openIngredientSelector,
            };
            actions[tutorial.currentStep!.stepIndex]?.();
            tutorial.advance();
          }}
        />
      ) : null}
    </View>
  );
};

const noop = () => {};

export const RecipeMain: React.FC = () => (
  <DeferredScreen
    fallback={
      <View style={styles.container} testID="recipes-screen">
        <TabScreenHeader label="What to cook?" title="Recipes" />
        <View style={styles.searchBarContainer}>
          <SearchBar
            value=""
            onChangeText={noop}
            placeholder="Search recipes..."
            showSearchIcon
            editable={false}
          />
        </View>
        <RecipeSkeleton />
      </View>
    }
    component={RecipeMainInner}
  />
);

const styles = StyleSheet.create(theme => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
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
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing['3'],
    marginTop: theme.spacing.sm,
    borderRadius: theme.radii.md,
  },
  suggestedTextContainer: { flex: 1 },
  suggestedTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  suggestedSubtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
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
  searchResultsText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
  },
  pressed: { opacity: theme.opacity.pressed },
}));
