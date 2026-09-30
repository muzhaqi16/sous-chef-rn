import { act, waitFor } from '@testing-library/react-native';
import type { InMemoryCache } from '@apollo/client';
import {
  renderHookWithApollo,
  seedCache,
  toFragmentRef,
} from '#/test-utils/apolloMockProvider';
import { useDailyMeals, type DailyMealsItem } from '../useDailyMeals';
import {
  DailyMeals_ItemFragmentDoc,
  type DailyMeals_ItemFragment,
} from '../useDailyMeals.generated';
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
  }>,
): DailyMeals_ItemFragment => {
  const { recipe, ...rest } = overrides;
  const name = recipe?.name ?? 'Omelette';
  return {
    __typename: 'MealPlanItem',
    id: 'item-1',
    date: todayISO,
    mealType: MealType.Breakfast,
    customMealName: null,
    recipe:
      recipe === null
        ? null
        : {
            __typename: 'Recipe',
            // One recipe entity per name: the cache normalizes by id.
            id: `recipe-${name}`,
            name,
          },
    ...rest,
  };
};

const seed = (items: DailyMeals_ItemFragment[]) =>
  seedCache(
    items.map(data => ({
      data,
      fragment: DailyMeals_ItemFragmentDoc,
      fragmentName: 'DailyMeals_item',
    })),
  );

/** The plan's masked refs, as `useMealPlan` hands them over. */
const refsOf = (items: DailyMeals_ItemFragment[]): DailyMealsItem[] =>
  items.map(({ id }) => ({
    ...toFragmentRef<typeof DailyMeals_ItemFragmentDoc>({
      __typename: 'MealPlanItem',
      id,
    }),
    id,
  }));

const renderDailyMeals = (
  items: DailyMeals_ItemFragment[],
  cache: InMemoryCache = seed(items),
) => renderHookWithApollo(() => useDailyMeals(refsOf(items), today), { cache });

describe('useDailyMeals', () => {
  it('returns empty state when no items match the date', () => {
    const items = [makeItem({ date: otherDayISO })];

    const { result } = renderDailyMeals(items);

    expect(result.current.dailyMeals).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
  });

  it('groups items by meal type in correct order', () => {
    const items = [
      makeItem({
        id: 'i1',
        mealType: MealType.Dinner,
        recipe: { name: 'Steak' },
      }),
      makeItem({
        id: 'i2',
        mealType: MealType.Breakfast,
        recipe: { name: 'Omelette' },
      }),
      makeItem({
        id: 'i3',
        mealType: MealType.Lunch,
        recipe: { name: 'Salad' },
      }),
    ];

    const { result } = renderDailyMeals(items);

    // Core slots are always shown once a day has any meal — the empty Snack
    // slot appears between Lunch and Dinner per MEAL_TYPE_ORDER.
    expect(result.current.isEmpty).toBe(false);
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

    const { result } = renderDailyMeals(items);

    // [1] is now the empty Lunch core slot; Snack moves to [2].
    expect(result.current.dailyMeals[0]!.label).toBe('Breakfast');
    expect(result.current.dailyMeals[2]!.label).toBe('Snack');
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

    const { result } = renderDailyMeals(items);

    expect(result.current.dailyMeals[0]!.items[0]!.id).toBe('i2'); // Eggs before Waffles
    expect(result.current.dailyMeals[0]!.items[1]!.id).toBe('i1');
  });

  it('shows core meal slots (even empty) once a day has any meal', () => {
    const items = [
      makeItem({
        id: 'i1',
        mealType: MealType.Dinner,
        recipe: { name: 'Steak' },
      }),
    ];

    const { result } = renderDailyMeals(items);

    // Core slots Breakfast/Lunch/Snack/Dinner all render (Dinner holds the meal,
    // the rest are empty add-affordances); non-core empties (Brunch/Dessert) stay
    // hidden.
    expect(result.current.isEmpty).toBe(false);
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

    const { result } = renderDailyMeals(items);

    expect(
      result.current.dailyMeals.find(g => g.mealType === 'LUNCH')?.items,
    ).toHaveLength(1);
  });
  it('regroups a meal moved to another slot without a new query result', async () => {
    const items = [
      makeItem({ id: 'i1', mealType: MealType.Breakfast }),
      makeItem({
        id: 'i2',
        mealType: MealType.Lunch,
        recipe: { name: 'Soup' },
      }),
    ];
    const cache = seed(items);
    const { result } = renderDailyMeals(items, cache);

    await act(async () => {
      cache.writeFragment({
        fragment: DailyMeals_ItemFragmentDoc,
        fragmentName: 'DailyMeals_item',
        data: makeItem({ id: 'i1', mealType: MealType.Dinner }),
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(
        result.current.dailyMeals
          .find(g => g.mealType === 'DINNER')
          ?.items.map(i => i.id),
      ).toEqual(['i1']),
    );
    expect(
      result.current.dailyMeals.find(g => g.mealType === 'BREAKFAST')?.items,
    ).toHaveLength(0);
  });

  it('marks every day holding a meal, and follows a meal moved to another day', async () => {
    const items = [makeItem({ id: 'i1' })];
    const cache = seed(items);
    const { result } = renderDailyMeals(items, cache);

    expect([...result.current.daysWithMeals]).toHaveLength(1);
    const [before] = [...result.current.daysWithMeals];

    await act(async () => {
      cache.writeFragment({
        fragment: DailyMeals_ItemFragmentDoc,
        fragmentName: 'DailyMeals_item',
        data: makeItem({ id: 'i1', date: otherDayISO }),
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect([...result.current.daysWithMeals]).not.toEqual([before]),
    );
    expect(result.current.isEmpty).toBe(true);
  });
});
