import {
  duplicatePlan,
  type SourcePlan,
} from '#features/mealPlan/utils/duplicatePlan';
import { MealPlanType } from '#/graphql/generated/schemaTypes';
import {
  leftoversLunch,
  planSource,
  recipeDinner,
} from '#/test-utils/fixtures/mealPlanFixtures';

/**
 * The copy rules are the server's, read out of `MealPlanService.duplicateMealPlan`:
 * the same span or nothing, every meal shifted by the same offset, and the plan's
 * own settings carried over. Every day is a `LocalDate` key, counted as a
 * calendar day.
 */

let next = 0;
const mintId = () => `minted-${++next}`;
beforeEach(() => {
  next = 0;
});

const source: SourcePlan = planSource({
  mealPlanItems: [
    recipeDinner({ notes: 'double the sauce' }),
    leftoversLunch(),
  ],
});

const nextWeek = {
  newName: 'Week Two',
  newStartDate: '2026-01-12',
  newEndDate: '2026-01-18',
  mintId,
};

describe('duplicating a meal plan from the cache', () => {
  it('refuses a range of a different length, as the server does', () => {
    expect(
      duplicatePlan(source, {
        ...nextWeek,
        newEndDate: '2026-01-19',
      }),
    ).toBe('duration-differs');
  });

  it('carries the plan settings over under the new name and dates', () => {
    const result = duplicatePlan(source, nextWeek);
    if (typeof result === 'string') throw new Error(result);

    expect(result.plan).toEqual({
      id: 'minted-1',
      name: 'Week Two',
      startDate: '2026-01-12',
      endDate: '2026-01-18',
      planType: MealPlanType.Weekly,
      description: 'A week of food',
      servings: 4,
      budgetAmount: 90,
      homeId: 'home-1',
    });
  });

  it('refuses a range one day shorter too', () => {
    expect(
      duplicatePlan(source, { ...nextWeek, newEndDate: '2026-01-17' }),
    ).toBe('duration-differs');
  });

  it('copies a one-day plan onto one day', () => {
    const result = duplicatePlan(
      {
        ...source,
        startDate: '2026-01-05',
        endDate: '2026-01-05',
        mealPlanItems: [source.mealPlanItems[0]!],
      },
      { ...nextWeek, newStartDate: '2026-02-01', newEndDate: '2026-02-01' },
    );
    if (typeof result === 'string') throw new Error(result);

    expect(result.plan.startDate).toBe('2026-02-01');
    expect(result.plan.endDate).toBe('2026-02-01');
    expect(result.items.map(i => i.date)).toEqual(['2026-02-01']);
  });

  it('shifts every meal by the same offset', () => {
    const result = duplicatePlan(source, nextWeek);
    if (typeof result === 'string') throw new Error(result);

    expect(result.items.map(i => i.date)).toEqual(['2026-01-12', '2026-01-14']);
  });

  it('keeps each meal on its day of the plan across a month boundary', () => {
    const result = duplicatePlan(source, {
      ...nextWeek,
      newStartDate: '2026-01-28',
      newEndDate: '2026-02-03',
    });
    if (typeof result === 'string') throw new Error(result);

    // The first day and the third: the 28th and, past the 31st, the 30th.
    expect(result.items.map(i => i.date)).toEqual(['2026-01-28', '2026-01-30']);
  });

  it('counts a week holding a 23-hour day as seven days, and shifts by days', () => {
    // 8 March 2026 loses an hour in the US; 29 March does in Europe.
    const springWeek: SourcePlan = {
      ...source,
      startDate: '2026-03-02',
      endDate: '2026-03-08',
      mealPlanItems: [
        { ...source.mealPlanItems[0]!, date: '2026-03-02' },
        { ...source.mealPlanItems[1]!, date: '2026-03-08' },
      ],
    };

    const result = duplicatePlan(springWeek, {
      ...nextWeek,
      newStartDate: '2026-03-23',
      newEndDate: '2026-03-29',
    });
    if (typeof result === 'string') throw new Error(result);

    expect(result.items.map(i => i.date)).toEqual(['2026-03-23', '2026-03-29']);
  });

  it('copies a plan back onto earlier dates', () => {
    const result = duplicatePlan(source, {
      ...nextWeek,
      newStartDate: '2025-12-29',
      newEndDate: '2026-01-04',
    });
    if (typeof result === 'string') throw new Error(result);

    expect(result.items.map(i => i.date)).toEqual(['2025-12-29', '2025-12-31']);
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
