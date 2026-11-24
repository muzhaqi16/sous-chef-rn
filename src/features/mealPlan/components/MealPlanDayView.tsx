import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import type { MealType } from '#/graphql/generated/schemaTypes';
import { MonthCalendar } from '#components/atoms/MonthCalendar';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { CalendarToggleBar } from '#features/mealPlan/components/CalendarToggleBar';
import { DayMealList } from '#features/mealPlan/components/DayMealList';
import { NutritionSummaryCard } from '#features/mealPlan/components/NutritionSummaryCard';
import { WeekStrip } from '#features/mealPlan/components/WeekStrip';
import type { useDailyMeals } from '#features/mealPlan/hooks/useDailyMeals';
import type { useMealPlanCalendar } from '#features/mealPlan/hooks/useMealPlanCalendar';
import type { ActiveMealPlan } from '#features/mealPlan/screens/useActiveMealPlan';
import type { MealPlanItemHandlers } from '#features/mealPlan/screens/useMealPlanItemHandlers';
import { mealPlanTestIDs } from '#features/mealPlan/testIDs';

interface MealPlanDayViewProps {
  plan: ActiveMealPlan;
  calendar: ReturnType<typeof useMealPlanCalendar>;
  day: ReturnType<typeof useDailyMeals<ActiveMealPlan['items'][number]>>;
  items: MealPlanItemHandlers;
  /** Absent where the user may not change the plan. */
  onAddMeal: ((mealType?: MealType) => void) | undefined;
  refreshing: boolean;
  onRefresh: () => void;
}

/** The plan's calendar, week or month, over the selected day's meals. */
export const MealPlanDayView: React.FC<MealPlanDayViewProps> = ({
  plan,
  calendar,
  day,
  items,
  onAddMeal,
  refreshing,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const canEdit = !!onAddMeal;
  const isMonth = calendar.viewMode === 'month';

  return (
    <>
      {isMonth ? (
        <MonthCalendar
          selectedDate={calendar.selectedDate}
          onSelectDate={calendar.selectDate}
          markedDays={day.daysWithMeals}
          minDate={calendar.minDate}
          maxDate={calendar.maxDate}
        />
      ) : (
        <WeekStrip
          weekDays={calendar.weekDays}
          selectedDate={calendar.selectedDate}
          onSelectDate={calendar.selectDate}
          onPrevWeek={calendar.goToPrevWeek}
          onNextWeek={calendar.goToNextWeek}
          daysWithMeals={day.daysWithMeals}
          canGoPrev={calendar.canGoPrevWeek}
          canGoNext={calendar.canGoNextWeek}
          minDate={calendar.minDate}
          maxDate={calendar.maxDate}
        />
      )}

      <CalendarToggleBar
        isExpanded={isMonth}
        onToggle={() => calendar.setViewMode(isMonth ? 'week' : 'month')}
      />

      <DayMealList
        selectedDate={calendar.selectedDate}
        dailyMeals={day.dailyMeals}
        isEmpty={day.isEmpty}
        onToggleCompleted={canEdit ? items.toggle : undefined}
        onItemPress={items.open}
        onDeleteItem={canEdit ? items.remove : undefined}
        onAddMeal={onAddMeal}
        refreshing={refreshing}
        onRefresh={onRefresh}
        listHeader={
          <>
            {plan.mealsIncomplete ? (
              <View style={styles.headerBlock}>
                <AlertBanner
                  variant="warning"
                  icon="cloud-offline-outline"
                  iconLibrary="Ionicons"
                  title={t('mealPlanMain.mealsIncompleteTitle')}
                  subtitle={t('mealPlanMain.mealsIncompleteBody')}
                  onPress={plan.retryRemainingMeals}
                  showChevron={false}
                  testID={mealPlanTestIDs.mealsIncomplete}
                />
              </View>
            ) : null}
            {plan.nutritionSummary ? (
              <View style={styles.headerBlock}>
                <NutritionSummaryCard
                  nutritionSummary={plan.nutritionSummary}
                  nutritionGoalProgress={plan.mealPlan?.nutritionGoalProgress}
                />
              </View>
            ) : null}
          </>
        }
      />
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  headerBlock: {
    marginBottom: theme.spacing.sm,
  },
}));
