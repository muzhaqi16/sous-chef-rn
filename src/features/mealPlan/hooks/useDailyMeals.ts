import { isSameDay } from 'date-fns';
import { useTranslation } from '#/i18n';
import {
  MEAL_TYPE_LABEL_KEYS,
  MEAL_TYPE_ORDER,
} from '#features/mealPlan/utils/mealPlanEnumLabels';
import { MealType } from '#/graphql/generated/schemaTypes';
import type { DailyMeals_ItemFragment } from './useDailyMeals.generated';
import type { MealPlanItemCard_ItemFragment } from '#features/mealPlan/components/MealPlanItemCard.generated';

// Hook input items must satisfy this hook's own fragment AND the downstream
// MealPlanItemCard fragment (since items flow through MealTypeSection → MealPlanItemCard).
// The page-level GetMealPlan query spreads both, so its result naturally satisfies this.
export type DailyMealsItem = DailyMeals_ItemFragment &
  MealPlanItemCard_ItemFragment;

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
      label: t(MEAL_TYPE_LABEL_KEYS[mealType]),
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

  return {
    dailyMeals,
    // A day with no meal yields no groups, core slots included.
    isEmpty: dailyMeals.length === 0,
  };
}
