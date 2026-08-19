import { isSameDay } from 'date-fns';
import { useTranslation } from '#/i18n';
import { MealType } from '#/graphql/generated/schemaTypes';
import { type DailyMeals_ItemFragment } from './useDailyMeals.generated';
import { type MealPlanItemCard_ItemFragment } from '#features/mealPlan/components/MealPlanItemCard.generated';

// Hook input items must satisfy this hook's own fragment AND the downstream
// MealPlanItemCard fragment (since items flow through MealTypeSection → MealPlanItemCard).
// The page-level GetMealPlan query spreads both, so its result naturally satisfies this.
export type DailyMealsItem = DailyMeals_ItemFragment &
  MealPlanItemCard_ItemFragment;

const MEAL_TYPE_ORDER: MealType[] = [
  MealType.Breakfast,
  MealType.Brunch,
  MealType.Lunch,
  MealType.Snack,
  MealType.Dinner,
  MealType.Dessert,
];

// Core daily slots always shown (even empty) once a day has any meal planned,
// so the day reads as a structured plan with per-slot "add" affordances instead
// of collapsing to a single section above a large dead space. Brunch/Dessert
// stay hidden unless they actually hold a meal, to avoid clutter.
const CORE_MEAL_TYPES: MealType[] = [
  MealType.Breakfast,
  MealType.Lunch,
  MealType.Dinner,
  MealType.Snack,
];

export interface MealTypeGroup {
  mealType: MealType;
  label: string;
  items: DailyMealsItem[];
}

// i18n keys for meal-type section headers (reuses the AddMealSheet set, which
// is complete and present in every locale).
const MEAL_TYPE_LABEL_KEYS: Partial<Record<MealType, string>> = {
  [MealType.Breakfast]: 'addMealSheet.mealBreakfast',
  [MealType.Brunch]: 'addMealSheet.mealBrunch',
  [MealType.Lunch]: 'addMealSheet.mealLunch',
  [MealType.Snack]: 'addMealSheet.mealSnack',
  [MealType.Dinner]: 'addMealSheet.mealDinner',
  [MealType.Dessert]: 'addMealSheet.mealDessert',
};

export function useDailyMeals(items: DailyMealsItem[], selectedDate: Date) {
  const { t } = useTranslation();
  const dailyMeals = (() => {
    // Filter items for the selected date
    const dayItems = items.filter(item =>
      isSameDay(new Date(item.date), selectedDate),
    );
    // Core slots are only surfaced once the day has at least one meal; a fully
    // empty day returns no groups so the dedicated EmptyDayState shows instead.
    const hasAnyMeal = dayItems.length > 0;

    // Group by meal type, maintaining defined order
    const groups: MealTypeGroup[] = MEAL_TYPE_ORDER.map(mealType => ({
      mealType,
      label: t(MEAL_TYPE_LABEL_KEYS[mealType] ?? mealType),
      items: dayItems
        .filter(item => item.mealType === mealType)
        .sort((a, b) => {
          // Sort by recipe name within each group
          const nameA = a.recipe?.name ?? a.customMealName ?? '';
          const nameB = b.recipe?.name ?? b.customMealName ?? '';
          return nameA.localeCompare(nameB);
        }),
    })).filter(
      group =>
        group.items.length > 0 ||
        (hasAnyMeal && CORE_MEAL_TYPES.includes(group.mealType)),
    );

    return groups;
  })();

  const totalMeals = dailyMeals.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );

  const totalCalories = dailyMeals.reduce(
    (sum, group) =>
      sum + group.items.reduce((s, item) => s + (item.calories ?? 0), 0),
    0,
  );

  return {
    dailyMeals,
    totalMeals,
    totalCalories,
    isEmpty: totalMeals === 0,
  };
}
