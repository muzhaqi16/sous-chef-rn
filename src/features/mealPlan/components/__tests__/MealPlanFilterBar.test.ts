import { MealPlanType } from '#/graphql/generated/schemaTypes';
import { filterMealPlans, EMPTY_MEAL_PLAN_FILTERS } from '../MealPlanFilterBar';

const NOW = new Date('2026-03-10T12:00:00Z');

const plans = [
  {
    name: 'Weekly Groceries',
    planType: MealPlanType.Weekly,
    startDate: '2026-03-08T00:00:00Z',
    endDate: '2026-03-14T00:00:00Z', // active (contains NOW)
  },
  {
    name: 'March Monthly',
    planType: MealPlanType.Monthly,
    startDate: '2026-03-01T00:00:00Z',
    endDate: '2026-03-31T00:00:00Z', // active
  },
  {
    name: 'Old Weekly',
    planType: MealPlanType.Weekly,
    startDate: '2026-02-01T00:00:00Z',
    endDate: '2026-02-07T00:00:00Z', // past (not active)
  },
];

describe('filterMealPlans', () => {
  it('returns all plans with the empty filter', () => {
    expect(filterMealPlans(plans, EMPTY_MEAL_PLAN_FILTERS, NOW)).toHaveLength(
      3,
    );
  });

  it('filters by case-insensitive name search', () => {
    const result = filterMealPlans(
      plans,
      { ...EMPTY_MEAL_PLAN_FILTERS, search: 'monthly' },
      NOW,
    );
    expect(result.map(p => p.name)).toEqual(['March Monthly']);
  });

  it('filters by plan type', () => {
    const result = filterMealPlans(
      plans,
      { ...EMPTY_MEAL_PLAN_FILTERS, planType: MealPlanType.Weekly },
      NOW,
    );
    expect(result.map(p => p.name)).toEqual(['Weekly Groceries', 'Old Weekly']);
  });

  it('filters to only currently-active plans by date range', () => {
    const result = filterMealPlans(
      plans,
      { ...EMPTY_MEAL_PLAN_FILTERS, activeOnly: true },
      NOW,
    );
    expect(result.map(p => p.name)).toEqual([
      'Weekly Groceries',
      'March Monthly',
    ]);
  });

  it('combines filters (active + weekly)', () => {
    const result = filterMealPlans(
      plans,
      { search: '', activeOnly: true, planType: MealPlanType.Weekly },
      NOW,
    );
    expect(result.map(p => p.name)).toEqual(['Weekly Groceries']);
  });
});
