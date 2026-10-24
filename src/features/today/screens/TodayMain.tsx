import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { sizes } from '#/theme/foundations/sizes';
import { useTranslation } from '#/i18n';
import { Screen } from '#components/templates/Screen';
import type { BarAction } from '#components/molecules/BarActions';
import type { EmptyStateProps } from '#components/molecules/EmptyState';
import { SectionHeaderRow } from '#components/molecules/SectionHeaderRow';
import { StatCard } from '#components/molecules/StatCard';
import { ItemCard } from '#components/organisms/ItemCard';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import {
  SpotlightCoachMark,
  type TargetRect,
} from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { kitTestIDs } from '#components/testIDs';
import { useTabBarState } from '#/context/TabBarActionsContext';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddMenu } from '#hooks/navigation/useTabBarAddMenu';
import { useTutorialSequence } from '#hooks/ui/useTutorialSequence';
import { useIsScreenFocused } from '#hooks/utils/useIsScreenFocused';
import {
  useSetPendingTabAdd,
  useShoppingListState,
  useUser,
} from '#store/useAppStore';
import { MealPlanItemCard } from '#features/mealPlan/ui/MealPlanItemCard';
import { todayTestIDs } from '#features/today/testIDs';
import { useMarkFullyDrawn } from './useMarkFullyDrawn';
import { useTodayOverview } from './useTodayOverview';

/** The app's first tab: the household's overview and its app-wide controls. */
export const TodayMain: React.FC = () => {
  const { t } = useTranslation();
  const {
    toHomeManagement,
    toNotifications,
    toProfile,
    toFilteredPantryItems,
    toRecipeDetail,
    toPantryMain,
    toShoppingListMain,
    toRecipeMain,
    toMealPlanMain,
  } = useAppNavigation();
  const overview = useTodayOverview();
  // A first run is content too: a new account's launch would otherwise never mark.
  useMarkFullyDrawn(overview.state === 'ready' || overview.state === 'empty');
  const setPendingTabAdd = useSetPendingTabAdd();
  const { setSelectedShoppingListId } = useShoppingListState();
  const user = useUser();

  // Pantry's old step, under its old id, so whoever saw it there is not shown it again.
  const [householdRect, setHouseholdRect] = useState<TargetRect | null>(null);
  const isFocused = useIsScreenFocused();
  const { isOverlayOpen } = useTabBarState();
  const tutorial = useTutorialSequence({
    steps: [
      {
        featureId: 'pantry_tutorial_home',
        title: t('today.tutorialHouseholdTitle'),
        subtitle: t('today.tutorialHouseholdSubtitle'),
        rectKey: 'household',
      },
    ],
    targetRects: { household: householdRect },
    canStart: overview.state === 'ready',
    isPaused: !isFocused || isOverlayOpen,
  });

  // The owning tab runs its own add once it has focus (`useTabBarAddMenu`).
  const addPantryItem = () => {
    setPendingTabAdd({ tab: 'Pantry', actionKey: 'search' });
    toPantryMain();
  };
  useTabBarAddMenu([
    {
      key: 'pantry',
      label: t('labels.addPantryItem'),
      icon: 'home-outline',
      onPress: addPantryItem,
    },
    {
      key: 'list',
      label: t('labels.addToShoppingList'),
      icon: 'list-outline',
      onPress: () => {
        setPendingTabAdd({ tab: 'ShoppingList', actionKey: 'search' });
        toShoppingListMain();
      },
    },
    {
      key: 'meal',
      label: t('labels.addMeal'),
      icon: 'calendar-outline',
      onPress: () => {
        setPendingTabAdd({ tab: 'MealPlan', actionKey: 'meal' });
        toMealPlanMain();
      },
    },
    {
      key: 'recipe',
      label: t('labels.addRecipe'),
      icon: 'book-outline',
      onPress: () => {
        setPendingTabAdd({ tab: 'Recipe' });
        toRecipeMain();
      },
    },
  ]);

  const openHousehold = () =>
    toHomeManagement({
      selectedHomeId: overview.selectedHomeId ?? undefined,
    });

  const actions: BarAction[] = [
    {
      icon: 'notifications-outline',
      onPress: toNotifications,
      accessibilityLabel: t('labels.notifications'),
      badge: overview.unreadCount,
      testID: todayTestIDs.notificationsButton,
    },
    {
      icon: 'person-circle-outline',
      photoUri: user?.profilePicture,
      // An avatar reads at a larger size than the glyphs beside it.
      size: sizes.icon.lg,
      onPress: toProfile,
      accessibilityLabel: t('a11y.openProfile'),
      testID: kitTestIDs.tab('Profile'),
    },
  ];

  const firstRun: EmptyStateProps = overview.needsHousehold
    ? {
        icon: 'home-outline',
        title: t('pantryScreen.noHomeTitle'),
        description: t('pantryScreen.noHomeDescription'),
        action: { label: t('labels.getStarted'), onPress: openHousehold },
        testID: todayTestIDs.firstRun,
      }
    : {
        icon: 'basket-outline',
        title: t('today.firstRunTitle'),
        description: t('today.firstRunDescription'),
        action: {
          label: t('labels.addPantryItem'),
          icon: 'add',
          onPress: addPantryItem,
        },
        testID: todayTestIDs.firstRun,
      };

  const { counts, meals, suggestions, shopping } = overview;

  return (
    <Screen
      header={{
        variant: 'tab',
        title: overview.householdName ?? t('today.householdFallback'),
        actions,
        switchable: {
          onPress: openHousehold,
          accessibilityHint: t('today.householdHint'),
          testID: todayTestIDs.householdTitle,
          onMeasure: setHouseholdRect,
        },
      }}
      scroll="scroll"
      state={{
        value: overview.state,
        onRetry: overview.retry,
        empty: firstRun,
      }}
      testID={todayTestIDs.screen}
    >
      <View style={styles.sections}>
        {counts ? (
          <View style={styles.stats}>
            <StatCard
              count={counts.expired}
              label={t('filteredPantry.expiredTitle')}
              tone="error"
              onPress={() => toFilteredPantryItems({ mode: 'expired' })}
              accessibilityLabel={t('pantryScreen.expiredCount', {
                count: counts.expired,
              })}
              testID={todayTestIDs.statCard('expired')}
            />
            <StatCard
              count={counts.expiring}
              label={t('filteredPantry.expiringTitle')}
              tone="warning"
              onPress={() => toFilteredPantryItems({ mode: 'expiring' })}
              accessibilityLabel={t('pantryScreen.expiringCount', {
                count: counts.expiring,
              })}
              testID={todayTestIDs.statCard('expiring')}
            />
            <StatCard
              count={counts.lowStock}
              label={t('filteredPantry.lowStockTitle')}
              tone="info"
              onPress={() => toFilteredPantryItems({ mode: 'lowStock' })}
              accessibilityLabel={t('pantryScreen.lowStockCount', {
                count: counts.lowStock,
              })}
              testID={todayTestIDs.statCard('lowStock')}
            />
          </View>
        ) : null}

        <View>
          <SectionHeaderRow
            title={t('today.mealsTitle')}
            style={styles.sectionHeader}
          />
          {meals.length > 0 ? (
            meals.map(({ id, item, mealTypeLabel, recipeId }) => (
              <View key={id} testID={todayTestIDs.mealRow(id)}>
                <MealPlanItemCard
                  item={item}
                  mealTypeLabel={mealTypeLabel}
                  onPress={
                    recipeId ? () => toRecipeDetail({ recipeId }) : undefined
                  }
                />
              </View>
            ))
          ) : (
            <ItemCard
              id="nothing-planned"
              title={t('today.nothingPlanned')}
              subtitle={t('today.planMeal')}
              onPress={toMealPlanMain}
              testID={todayTestIDs.nothingPlanned}
            />
          )}
        </View>

        {suggestions.length > 0 ? (
          <View>
            <SectionHeaderRow
              title={t('recipes.basedOnPantry')}
              action={{
                label: t('labels.seeAll'),
                onPress: toRecipeMain,
                testID: todayTestIDs.suggestionsSeeAll,
              }}
              style={styles.sectionHeader}
            />
            {suggestions.map(suggestion => (
              <ItemCard
                key={suggestion.id}
                id={suggestion.id}
                title={suggestion.title}
                subtitle={suggestion.subtitle}
                badge={suggestion.badge}
                leftElement={<RowThumbnail uri={suggestion.imageUrl} />}
                onPress={() => toRecipeDetail(suggestion.target)}
              />
            ))}
          </View>
        ) : null}

        {shopping ? (
          <View>
            <SectionHeaderRow
              title={t('labels.shoppingList')}
              style={styles.sectionHeader}
            />
            <ItemCard
              id={shopping.id}
              title={shopping.name}
              subtitle={t('today.itemsLeft', { count: shopping.itemsLeft })}
              onPress={() => {
                setSelectedShoppingListId(shopping.id);
                toShoppingListMain();
              }}
              testID={todayTestIDs.shoppingRow}
            />
          </View>
        ) : null}
      </View>
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
            tutorial.advance();
            openHousehold();
          }}
        />
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  // The household title is spaced from the first section as sections are from
  // each other.
  sections: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  stats: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  sectionHeader: {
    marginBottom: theme.spacing.sm,
  },
}));
