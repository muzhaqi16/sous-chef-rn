import { renderHook } from '@testing-library/react-native';
import { useDailyMeals, type DailyMealsItem } from '../useDailyMeals';
import { MealType } from '#/graphql/generated/schemaTypes';

const today = new Date(2025, 5, 15); // June 15, 2025
const todayISO = '2025-06-15T12:00:00Z';
const otherDayISO = '2025-06-16T12:00:00Z';

const makeItem = (
  overrides: Partial<{
    id: string;
    date: string;
    mealType: MealType;
    recipe: { name: string } | null;
    customMealName: string | null;
    calories: number | null;
    isCompleted: boolean;
  }>,
): DailyMealsItem => {
  const { recipe, ...rest } = overrides;
  return {
    __typename: 'MealPlanItem',
    id: 'item-1',
    date: todayISO,
    mealType: MealType.Breakfast,
    customMealName: null,
    calories: 300,
    isCompleted: false,
    servings: null,
    usedPantryItems: [],
    recipe:
      recipe === undefined
        ? {
            __typename: 'Recipe',
            id: 'recipe-1',
            name: 'Omelette',
            imageUrl: null,
            totalTimeMinutes: null,
          }
        : recipe === null
        ? null
        : {
            __typename: 'Recipe',
            id: 'recipe-1',
            imageUrl: null,
            totalTimeMinutes: null,
            name: recipe.name,
          },
    ...rest,
  };
};

describe('useDailyMeals', () => {
  it('returns empty state when no items match the date', () => {
    const items = [makeItem({ date: otherDayISO })];

    const { result } = renderHook(() => useDailyMeals(items, today));

    expect(result.current.dailyMeals).toEqual([]);
    expect(result.current.totalMeals).toBe(0);
    expect(result.current.totalCalories).toBe(0);
    expect(result.current.isEmpty).toBe(true);
  });

  it('groups items by meal type in correct order', () => {
    const items = [
      makeItem({
        id: 'i1',
        mealType: MealType.Dinner,
        recipe: { name: 'Steak' },
        calories: 600,
      }),
      makeItem({
        id: 'i2',
        mealType: MealType.Breakfast,
        recipe: { name: 'Omelette' },
        calories: 300,
      }),
      makeItem({
        id: 'i3',
        mealType: MealType.Lunch,
        recipe: { name: 'Salad' },
        calories: 200,
      }),
    ];

    const { result } = renderHook(() => useDailyMeals(items, today));

    // Core slots are always shown once a day has any meal — the empty Snack
    // slot appears between Lunch and Dinner per MEAL_TYPE_ORDER.
    expect(result.current.dailyMeals.map(g => g.mealType)).toEqual([
      'BREAKFAST',
      'LUNCH',
      'SNACK',
      'DINNER',
    ]);
  });

  it('provides correct labels for meal types', () => {
    const items = [
      makeItem({ id: 'i1', mealType: MealType.Breakfast }),
      makeItem({
        id: 'i2',
        mealType: MealType.Snack,
        recipe: { name: 'Chips' },
      }),
    ];

    const { result } = renderHook(() => useDailyMeals(items, today));

    // [1] is now the empty Lunch core slot; Snack moves to [2].
    expect(result.current.dailyMeals[0].label).toBe('Breakfast');
    expect(result.current.dailyMeals[2].label).toBe('Snack');
  });

  it('sorts items within a group by recipe name', () => {
    const items = [
      makeItem({
        id: 'i1',
        mealType: MealType.Breakfast,
        recipe: { name: 'Waffles' },
      }),
      makeItem({
        id: 'i2',
        mealType: MealType.Breakfast,
        recipe: { name: 'Eggs' },
      }),
    ];

    const { result } = renderHook(() => useDailyMeals(items, today));

    expect(result.current.dailyMeals[0].items[0].id).toBe('i2'); // Eggs before Waffles
    expect(result.current.dailyMeals[0].items[1].id).toBe('i1');
  });

  it('computes totalMeals and totalCalories', () => {
    const items = [
      makeItem({ id: 'i1', mealType: MealType.Breakfast, calories: 300 }),
      makeItem({
        id: 'i2',
        mealType: MealType.Lunch,
        recipe: { name: 'Salad' },
        calories: 200,
      }),
      makeItem({
        id: 'i3',
        mealType: MealType.Dinner,
        recipe: { name: 'Steak' },
        calories: null,
      }),
    ];

    const { result } = renderHook(() => useDailyMeals(items, today));

    expect(result.current.totalMeals).toBe(3);
    expect(result.current.totalCalories).toBe(500); // 300 + 200 + 0
    expect(result.current.isEmpty).toBe(false);
  });

  it('shows core meal slots (even empty) once a day has any meal', () => {
    const items = [
      makeItem({
        id: 'i1',
        mealType: MealType.Dinner,
        recipe: { name: 'Steak' },
      }),
    ];

    const { result } = renderHook(() => useDailyMeals(items, today));

    // Core slots Breakfast/Lunch/Snack/Dinner all render (Dinner holds the meal,
    // the rest are empty add-affordances); non-core empties (Brunch/Dessert) stay
    // hidden.
    expect(result.current.dailyMeals.map(g => g.mealType)).toEqual([
      'BREAKFAST',
      'LUNCH',
      'SNACK',
      'DINNER',
    ]);
    expect(
      result.current.dailyMeals.find(g => g.mealType === 'DINNER')?.items,
    ).toHaveLength(1);
    expect(
      result.current.dailyMeals.find(g => g.mealType === 'BREAKFAST')?.items,
    ).toHaveLength(0);
  });

  it('handles customMealName when recipe is null', () => {
    const items = [
      makeItem({
        id: 'i1',
        mealType: MealType.Lunch,
        recipe: null,
        customMealName: 'Leftover soup',
      }),
    ];

    const { result } = renderHook(() => useDailyMeals(items, today));

    expect(result.current.totalMeals).toBe(1);
    expect(
      result.current.dailyMeals.find(g => g.mealType === 'LUNCH')?.items,
    ).toHaveLength(1);
  });
});
