import {
  duplicatePlan,
  type SourcePlan,
} from '#features/mealPlan/utils/duplicatePlan';
import { MealPlanType, MealType } from '#/graphql/generated/schemaTypes';

/**
 * The copy rules are the server's, read out of `MealPlanService.duplicateMealPlan`:
 * the same span or nothing, every meal shifted by the same offset, and the plan's
 * own settings carried over.
 */

let next = 0;
const mintId = () => `minted-${++next}`;
beforeEach(() => {
  next = 0;
});

const source: SourcePlan = {
  id: 'plan-1',
  description: 'A week of food',
  planType: MealPlanType.Weekly,
  servings: 4,
  budgetAmount: 90,
  homeId: 'home-1',
  startDate: '2026-01-05T00:00:00.000Z',
  endDate: '2026-01-11T00:00:00.000Z',
  mealPlanItems: [
    {
      id: 'mpi-1',
      date: '2026-01-05T00:00:00.000Z',
      mealType: MealType.Dinner,
      servings: 2,
      notes: 'double the sauce',
      customMealName: null,
      recipe: { id: 'recipe-1' },
    },
    {
      id: 'mpi-2',
      date: '2026-01-07T00:00:00.000Z',
      mealType: MealType.Lunch,
      servings: null,
      notes: null,
      customMealName: 'Leftovers',
      recipe: null,
    },
  ],
};

const nextWeek = {
  newName: 'Week Two',
  newStartDate: '2026-01-12T00:00:00.000Z',
  newEndDate: '2026-01-18T00:00:00.000Z',
  mintId,
};

describe('duplicating a meal plan from the cache', () => {
  it('refuses a range of a different length, as the server does', () => {
    expect(
      duplicatePlan(source, {
        ...nextWeek,
        newEndDate: '2026-01-19T00:00:00.000Z',
      }),
    ).toBe('duration-differs');
  });

  it('carries the plan settings over under the new name and dates', () => {
    const result = duplicatePlan(source, nextWeek);
    if (typeof result === 'string') throw new Error(result);

    expect(result.plan).toEqual({
      id: 'minted-1',
      name: 'Week Two',
      startDate: '2026-01-12T00:00:00.000Z',
      endDate: '2026-01-18T00:00:00.000Z',
      planType: MealPlanType.Weekly,
      description: 'A week of food',
      servings: 4,
      budgetAmount: 90,
      homeId: 'home-1',
    });
  });

  it('shifts every meal by the same offset', () => {
    const result = duplicatePlan(source, nextWeek);
    if (typeof result === 'string') throw new Error(result);

    expect(result.items.map(i => i.date)).toEqual([
      '2026-01-12T00:00:00.000Z',
      '2026-01-14T00:00:00.000Z',
    ]);
  });

  it('names every meal by its recipe or its own name', () => {
    const result = duplicatePlan(source, nextWeek);
    if (typeof result === 'string') throw new Error(result);

    expect(result.items.map(i => i.meal)).toEqual([
      { recipeId: 'recipe-1' },
      { customMealName: 'Leftovers' },
    ]);
  });

  it('parents every meal to the minted plan and mints its own id', () => {
    const result = duplicatePlan(source, nextWeek);
    if (typeof result === 'string') throw new Error(result);

    expect(result.items.map(i => i.mealPlanId)).toEqual([
      'minted-1',
      'minted-1',
    ]);
    expect(result.items.map(i => i.id)).toEqual(['minted-2', 'minted-3']);
  });

  it('omits a meal that names neither a recipe nor itself', () => {
    const result = duplicatePlan(
      {
        ...source,
        mealPlanItems: [
          { ...source.mealPlanItems[0]!, recipe: null, customMealName: null },
          source.mealPlanItems[1]!,
        ],
      },
      nextWeek,
    );
    if (typeof result === 'string') throw new Error(result);

    // `MealRefInput` is @oneOf and non-null: there is nothing to send.
    expect(result.items).toHaveLength(1);
    expect(result.skipped).toEqual([
      { sourceId: 'mpi-1', reason: 'meal-has-no-reference' },
    ]);
  });

  it('leaves an absent servings or note off the input entirely', () => {
    const result = duplicatePlan(source, nextWeek);
    if (typeof result === 'string') throw new Error(result);

    expect(result.items[1]).not.toHaveProperty('servings');
    expect(result.items[1]).not.toHaveProperty('notes');
    expect(result.items[0]?.servings).toBe(2);
    expect(result.items[0]?.notes).toBe('double the sauce');
  });
});
