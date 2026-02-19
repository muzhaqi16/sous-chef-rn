import React, { useCallback, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { format } from 'date-fns';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { WeekStrip } from '#components/mealPlan/WeekStrip';
import { MonthCalendar } from '#components/mealPlan/MonthCalendar';
import { DayMealList } from '#components/mealPlan/DayMealList';
import { MealPlanEmptyState } from '#components/mealPlan/MealPlanEmptyState';
import { AddMealSheet, type AddMealSheetRef } from '#components/mealPlan/AddMealSheet';
import { useProfileData } from '#hooks/profile/useProfileData';
import { useAppStore } from '#store/useAppStore';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { useMealPlans } from '#hooks/mealPlan/useMealPlans';
import { useMealPlan } from '#hooks/mealPlan/useMealPlan';
import { useMealPlanItemActions } from '#hooks/mealPlan/useMealPlanItemActions';
import { useMealPlanCalendar } from '#hooks/mealPlan/useMealPlanCalendar';
import { useDailyMeals } from '#hooks/mealPlan/useDailyMeals';
import { MealType } from '#generated';

const VIEW_OPTIONS = ['Week', 'Month'] as const;

export const MealPlanMain: React.FC = React.memo(() => {
  const { profile } = useProfileData();
  const unreadCount = useAppStore(state => state.unreadCount);
  const { navigate } = useAppNavigation();
  const addMealSheetRef = useRef<AddMealSheetRef>(null);

  // Fetch meal plans and auto-select current one
  const { currentPlan, mealPlans, loading: plansLoading } = useMealPlans();
  const activePlanId = currentPlan?.id ?? mealPlans[0]?.id ?? null;

  // Fetch the active plan with items
  const { items } = useMealPlan(activePlanId);

  // Calendar state
  const calendar = useMealPlanCalendar();

  // Daily meals for selected date
  const { dailyMeals, totalCalories, isEmpty } = useDailyMeals(
    items,
    calendar.selectedDate,
  );

  // Meal plan item actions
  const { createItem, toggleCompleted, deleteItem } =
    useMealPlanItemActions(activePlanId);

  // Compute days with meals for calendar indicators
  const daysWithMeals = useMemo(() => {
    const days = new Set<string>();
    items.forEach(item => {
      days.add(format(new Date(item.date), 'yyyy-MM-dd'));
    });
    return days;
  }, [items]);

  // Register add button - opens add meal sheet
  useTabBarAddButton(() => {
    addMealSheetRef.current?.open();
  });

  const handleToggleCompleted = useCallback(
    (id: string, isCompleted: boolean) => {
      toggleCompleted(id, isCompleted);
    },
    [toggleCompleted],
  );

  const handleDeleteItem = useCallback(
    (id: string) => {
      deleteItem(id);
    },
    [deleteItem],
  );

  const handleAddRecipe = useCallback(
    (recipeId: string, mealType: MealType) => {
      if (!activePlanId) return;
      createItem({
        mealPlanId: activePlanId,
        recipeId,
        mealType,
        date: calendar.selectedDate.toISOString(),
      });
    },
    [activePlanId, createItem, calendar.selectedDate],
  );

  const handleAddCustomMeal = useCallback(
    (name: string, mealType: MealType) => {
      if (!activePlanId) return;
      createItem({
        mealPlanId: activePlanId,
        customMealName: name,
        mealType,
        date: calendar.selectedDate.toISOString(),
      });
    },
    [activePlanId, createItem, calendar.selectedDate],
  );

  const handleOpenAddMeal = useCallback(
    (mealType?: MealType) => {
      addMealSheetRef.current?.open(mealType);
    },
    [],
  );

  const handleItemPress = useCallback(
    (item: any) => {
      if (item.recipe?.id) {
        navigate('RecipeDetail', { recipeId: item.recipe.id });
      }
    },
    [navigate],
  );

  const handleViewModeChange = useCallback(
    (value: string) => {
      calendar.setViewMode(value === 'Week' ? 'week' : 'month');
    },
    [calendar],
  );

  const handleCreatePlan = useCallback(() => {
    navigate('CreateMealPlan');
  }, [navigate]);

  // Show empty state if no plans exist and not loading
  if (!plansLoading && mealPlans.length === 0) {
    return (
      <View style={styles.container} testID="meal-plan-screen">
        <TabScreenHeader
          label="Plan your meals"
          title="Meal Plan"
          avatarUrl={profile?.avatar}
          notificationCount={unreadCount}
          onAvatarPress={() => navigate('Profile')}
          onNotificationPress={() => navigate('Notifications')}
        />
        <MealPlanEmptyState onCreatePlan={handleCreatePlan} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="meal-plan-screen">
      <TabScreenHeader
        label="Plan your meals"
        title={currentPlan?.name ?? 'Meal Plan'}
        avatarUrl={profile?.avatar}
        notificationCount={unreadCount}
        onAvatarPress={() => navigate('Profile')}
        onNotificationPress={() => navigate('Notifications')}
      />

      {/* Week/Month toggle */}
      <View style={styles.segmentContainer}>
        <SegmentedControl
          options={VIEW_OPTIONS}
          value={calendar.viewMode === 'week' ? 'Week' : 'Month'}
          onChange={handleViewModeChange}
        />
      </View>

      {/* Calendar view */}
      {calendar.viewMode === 'week' ? (
        <WeekStrip
          weekDays={calendar.weekDays}
          selectedDate={calendar.selectedDate}
          onSelectDate={calendar.selectDate}
          onPrevWeek={calendar.goToPrevWeek}
          onNextWeek={calendar.goToNextWeek}
          daysWithMeals={daysWithMeals}
        />
      ) : (
        <MonthCalendar
          selectedDate={calendar.selectedDate}
          onSelectDate={calendar.selectDate}
          daysWithMeals={daysWithMeals}
        />
      )}

      {/* Daily meals */}
      <DayMealList
        selectedDate={calendar.selectedDate}
        dailyMeals={dailyMeals}
        totalCalories={totalCalories}
        isEmpty={isEmpty}
        onToggleCompleted={handleToggleCompleted}
        onItemPress={handleItemPress}
        onDeleteItem={handleDeleteItem}
        onAddMeal={handleOpenAddMeal}
      />

      {/* Add meal bottom sheet */}
      <AddMealSheet
        ref={addMealSheetRef}
        selectedDate={calendar.selectedDate}
        onAddRecipe={handleAddRecipe}
        onAddCustomMeal={handleAddCustomMeal}
      />
    </View>
  );
});

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  segmentContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
}));
