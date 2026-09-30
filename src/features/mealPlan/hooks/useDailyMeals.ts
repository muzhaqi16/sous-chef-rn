import { isSameDay } from 'date-fns';
import type { FragmentType } from '@apollo/client/masking';
import { useTranslation } from '#/i18n';
import {
  MEAL_TYPE_LABEL_KEYS,
  MEAL_TYPE_ORDER,
} from '#features/mealPlan/utils/mealPlanEnumLabels';
import { MealType } from '#/graphql/generated/schemaTypes';
import { useFragmentList } from '#hooks/apollo/useFragmentList';
import { toDateKey } from '#/utils/dateUtils';
import {
  DailyMeals_ItemFragmentDoc,
  type DailyMeals_ItemFragment,
} from './useDailyMeals.generated';

/** A plan's item as its query holds it; the group hands it on unchanged. */
export type DailyMealsItem = FragmentType<typeof DailyMeals_ItemFragmentDoc> & {
  id: string;
};

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

export interface MealTypeGroup<TItem> {
  mealType: MealType;
  label: string;
  items: TItem[];
}

interface Meal<TItem> {
  ref: TItem;
  fields: DailyMeals_ItemFragment;
}

const mealName = ({ fields }: Meal<unknown>) =>
  fields.recipe?.name ?? fields.customMealName ?? '';

export function useDailyMeals<TItem extends DailyMealsItem>(
  items: TItem[],
  selectedDate: Date,
) {
  const { t } = useTranslation();
  // Live per item: moving a meal to another day or slot edits only the item.
  const entries = useFragmentList({
    fragment: DailyMeals_ItemFragmentDoc,
    fragmentName: 'DailyMeals_item',
    from: items,
  });
  const meals = items.flatMap((ref, index): Meal<TItem>[] => {
    const fields = entries[index];
    return fields ? [{ ref, fields }] : [];
  });

  const dailyMeals = (() => {
    const dayMeals = meals.filter(meal =>
      isSameDay(new Date(meal.fields.date), selectedDate),
    );
    // Core slots are only surfaced once the day has at least one meal; a fully
    // empty day returns no groups so the dedicated EmptyDayState shows instead.
    const hasAnyMeal = dayMeals.length > 0;

    // Group by meal type, maintaining defined order, by name within a type.
    const groups: MealTypeGroup<TItem>[] = MEAL_TYPE_ORDER.map(mealType => ({
      mealType,
      label: t(MEAL_TYPE_LABEL_KEYS[mealType]),
      items: dayMeals
        .filter(meal => meal.fields.mealType === mealType)
        .sort((a, b) => mealName(a).localeCompare(mealName(b)))
        .map(meal => meal.ref),
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
    /** Date keys of every day holding a meal, for the calendar's markers. */
    daysWithMeals: new Set(
      meals.map(meal => toDateKey(new Date(meal.fields.date))),
    ),
  };
}
