import { MealPlanType } from '#/graphql/generated/schemaTypes';
import {
  EMPTY_MEAL_PLAN_FILTERS,
  filterMealPlans,
  resolveCurrentMealPlan,
  toMealPlanServerFilters,
} from '../mealPlanFilters';

const NOW = new Date('2026-03-10T12:00:00Z');

const plans = [
  {
    id: 'weekly',
    name: 'Weekly Groceries',
    description: null,
    planType: MealPlanType.Weekly,
    startDate: '2026-03-08T00:00:00Z',
    endDate: '2026-03-14T00:00:00Z', // active (contains NOW)
  },
  {
    id: 'march',
    name: 'March Monthly',
    description: 'Batch cooking',
    planType: MealPlanType.Monthly,
    startDate: '2026-03-01T00:00:00Z',
    endDate: '2026-03-31T00:00:00Z', // active
  },
  {
    id: 'old',
    name: 'Old Weekly',
    description: null,
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

  it('matches the description too, as the server search does', () => {
    const result = filterMealPlans(
      plans,
      { ...EMPTY_MEAL_PLAN_FILTERS, search: ' batch ' },
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

describe('toMealPlanServerFilters', () => {
  it('sends nothing when no filter is set, whitespace search included', () => {
    expect(toMealPlanServerFilters(EMPTY_MEAL_PLAN_FILTERS)).toBeUndefined();
    expect(
      toMealPlanServerFilters({ ...EMPTY_MEAL_PLAN_FILTERS, search: '  ' }),
    ).toBeUndefined();
  });

  it('names only the filters that are set, search trimmed', () => {
    expect(
      toMealPlanServerFilters({
        search: ' soup ',
        activeOnly: true,
        planType: null,
      }),
    ).toEqual({ search: 'soup', isActive: true });
    expect(
      toMealPlanServerFilters({
        ...EMPTY_MEAL_PLAN_FILTERS,
        planType: MealPlanType.Monthly,
      }),
    ).toEqual({ planType: MealPlanType.Monthly });
  });
});

describe('resolveCurrentMealPlan', () => {
  const upcomingSoon = {
    id: 'soon',
    startDate: '2026-03-12T00:00:00Z',
    endDate: '2026-03-18T00:00:00Z',
  };
  const upcomingLater = {
    id: 'later',
    startDate: '2026-04-01T00:00:00Z',
    endDate: '2026-04-07T00:00:00Z',
  };

  it('prefers the latest-starting active plan', () => {
    expect(resolveCurrentMealPlan(plans, NOW)?.id).toBe('weekly');
  });

  it('takes the nearest upcoming plan when none is active, in any order', () => {
    expect(
      resolveCurrentMealPlan([upcomingLater, plans[2]!, upcomingSoon], NOW)?.id,
    ).toBe('soon');
  });

  it('is null when every plan has ended', () => {
    expect(resolveCurrentMealPlan([plans[2]!], NOW)).toBeNull();
  });
});
