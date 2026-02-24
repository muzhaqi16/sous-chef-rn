import { useMemo } from 'react';
import { isSameDay } from 'date-fns';
import { MealType, type MealPlanItemFragment } from '#generated';

const MEAL_TYPE_ORDER: MealType[] = [
  MealType.Breakfast,
  MealType.Brunch,
  MealType.Lunch,
  MealType.Snack,
  MealType.Dinner,
  MealType.Dessert,
];

export interface MealTypeGroup {
  mealType: MealType;
  label: string;
  items: MealPlanItemFragment[];
}

function getMealTypeLabel(mealType: MealType): string {
  switch (mealType) {
    case MealType.Breakfast:
      return 'Breakfast';
    case MealType.Brunch:
      return 'Brunch';
    case MealType.Lunch:
      return 'Lunch';
    case MealType.Snack:
      return 'Snack';
    case MealType.Dinner:
      return 'Dinner';
    case MealType.Dessert:
      return 'Dessert';
    default:
      return mealType;
  }
}

export function useDailyMeals(
  items: MealPlanItemFragment[],
  selectedDate: Date,
) {
  const dailyMeals = useMemo(() => {
    // Filter items for the selected date
    const dayItems = items.filter(item =>
      isSameDay(new Date(item.date), selectedDate),
    );

    // Group by meal type, maintaining defined order
    const groups: MealTypeGroup[] = MEAL_TYPE_ORDER
      .map(mealType => ({
        mealType,
        label: getMealTypeLabel(mealType),
        items: dayItems
          .filter(item => item.mealType === mealType)
          .sort((a, b) => {
            // Sort by recipe name within each group
            const nameA = a.recipe?.name ?? a.customMealName ?? '';
            const nameB = b.recipe?.name ?? b.customMealName ?? '';
            return nameA.localeCompare(nameB);
          }),
      }))
      .filter(group => group.items.length > 0);

    return groups;
  }, [items, selectedDate]);

  const totalMeals = useMemo(
    () => dailyMeals.reduce((sum, group) => sum + group.items.length, 0),
    [dailyMeals],
  );

  const totalCalories = useMemo(
    () =>
      dailyMeals.reduce(
        (sum, group) =>
          sum +
          group.items.reduce((s, item) => s + (item.calories ?? 0), 0),
        0,
      ),
    [dailyMeals],
  );

  return {
    dailyMeals,
    totalMeals,
    totalCalories,
    isEmpty: totalMeals === 0,
  };
}
