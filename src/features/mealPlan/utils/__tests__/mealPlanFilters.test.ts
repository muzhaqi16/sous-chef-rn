import { MealPlanType } from '#/graphql/generated/schemaTypes';
import {
  EMPTY_MEAL_PLAN_FILTERS,
  filterMealPlans,
  isPlanActiveOn,
  resolveCurrentMealPlan,
  toMealPlanServerFilters,
} from '../mealPlanFilters';

const TODAY = '2026-03-10';

const plans = [
  {
    id: 'weekly',
    name: 'Weekly Groceries',
    description: null,
    planType: MealPlanType.Weekly,
    startDate: '2026-03-08',
    endDate: '2026-03-14', // active (contains TODAY)
  },
  {
    id: 'march',
    name: 'March Monthly',
    description: 'Batch cooking',
    planType: MealPlanType.Monthly,
    startDate: '2026-03-01',
    endDate: '2026-03-31', // active
  },
  {
    id: 'old',
    name: 'Old Weekly',
    description: null,
    planType: MealPlanType.Weekly,
    startDate: '2026-02-01',
    endDate: '2026-02-07', // past (not active)
  },
];

describe('isPlanActiveOn', () => {
  const week = { startDate: '2026-03-08', endDate: '2026-03-14' };

  it('is active on a day inside the plan', () => {
    expect(isPlanActiveOn(week, '2026-03-10')).toBe(true);
  });

  it('is active on its first day and not the day before', () => {
    expect(isPlanActiveOn(week, '2026-03-08')).toBe(true);
    expect(isPlanActiveOn(week, '2026-03-07')).toBe(false);
  });

  it('is active through the whole of its last day and not the day after', () => {
    expect(isPlanActiveOn(week, '2026-03-14')).toBe(true);
    expect(isPlanActiveOn(week, '2026-03-15')).toBe(false);
  });

  it('is active on the one day of a one-day plan, and on no other', () => {
    const oneDay = { startDate: '2026-03-10', endDate: '2026-03-10' };

    expect(isPlanActiveOn(oneDay, '2026-03-09')).toBe(false);
    expect(isPlanActiveOn(oneDay, '2026-03-10')).toBe(true);
    expect(isPlanActiveOn(oneDay, '2026-03-11')).toBe(false);
  });

  it('orders days across a month and a year boundary', () => {
    const overNewYear = { startDate: '2026-12-28', endDate: '2027-01-03' };

    expect(isPlanActiveOn(overNewYear, '2026-12-31')).toBe(true);
    expect(isPlanActiveOn(overNewYear, '2027-01-03')).toBe(true);
    expect(isPlanActiveOn(overNewYear, '2027-01-04')).toBe(false);
    expect(isPlanActiveOn(overNewYear, '2026-12-27')).toBe(false);
  });
});

describe('filterMealPlans', () => {
  it('returns all plans with the empty filter', () => {
    expect(filterMealPlans(plans, EMPTY_MEAL_PLAN_FILTERS, TODAY)).toHaveLength(
      3,
    );
  });

  it('filters by case-insensitive name search', () => {
    const result = filterMealPlans(
      plans,
      { ...EMPTY_MEAL_PLAN_FILTERS, search: 'monthly' },
      TODAY,
    );
    expect(result.map(p => p.name)).toEqual(['March Monthly']);
  });

  it('matches the description too, as the server search does', () => {
    const result = filterMealPlans(
      plans,
      { ...EMPTY_MEAL_PLAN_FILTERS, search: ' batch ' },
      TODAY,
    );
    expect(result.map(p => p.name)).toEqual(['March Monthly']);
  });

  it('filters by plan type', () => {
    const result = filterMealPlans(
      plans,
      { ...EMPTY_MEAL_PLAN_FILTERS, planType: MealPlanType.Weekly },
      TODAY,
    );
    expect(result.map(p => p.name)).toEqual(['Weekly Groceries', 'Old Weekly']);
  });

  it('filters to only currently-active plans by date range', () => {
    const result = filterMealPlans(
      plans,
      { ...EMPTY_MEAL_PLAN_FILTERS, activeOnly: true },
      TODAY,
    );
    expect(result.map(p => p.name)).toEqual([
      'Weekly Groceries',
      'March Monthly',
    ]);
  });

  it('keeps a plan on its last day and drops it the day after', () => {
    const activeOnly = { ...EMPTY_MEAL_PLAN_FILTERS, activeOnly: true };

    expect(
      filterMealPlans(plans, activeOnly, '2026-03-14').map(p => p.id),
    ).toEqual(['weekly', 'march']);
    expect(
      filterMealPlans(plans, activeOnly, '2026-03-15').map(p => p.id),
    ).toEqual(['march']);
  });

  it('combines filters (active + weekly)', () => {
    const result = filterMealPlans(
      plans,
      { search: '', activeOnly: true, planType: MealPlanType.Weekly },
      TODAY,
    );
    expect(result.map(p => p.name)).toEqual(['Weekly Groceries']);
  });
});

describe('toMealPlanServerFilters', () => {
  it('sends nothing when no filter is set, whitespace search included', () => {
    expect(
      toMealPlanServerFilters(EMPTY_MEAL_PLAN_FILTERS, TODAY),
    ).toBeUndefined();
    expect(
      toMealPlanServerFilters(
        { ...EMPTY_MEAL_PLAN_FILTERS, search: '  ' },
        TODAY,
      ),
    ).toBeUndefined();
  });

  it('names only the filters that are set, search trimmed', () => {
    expect(
      toMealPlanServerFilters(
        { search: ' soup ', activeOnly: true, planType: null },
        TODAY,
      ),
    ).toEqual({ search: 'soup', isActive: true, today: TODAY });
    expect(
      toMealPlanServerFilters(
        { ...EMPTY_MEAL_PLAN_FILTERS, planType: MealPlanType.Monthly },
        TODAY,
      ),
    ).toEqual({ planType: MealPlanType.Monthly });
  });

  it('states the device day beside isActive, and only there', () => {
    expect(
      toMealPlanServerFilters(
        { ...EMPTY_MEAL_PLAN_FILTERS, activeOnly: true },
        '2026-12-31',
      ),
    ).toEqual({ isActive: true, today: '2026-12-31' });
    expect(
      toMealPlanServerFilters(
        { ...EMPTY_MEAL_PLAN_FILTERS, search: 'soup' },
        '2026-12-31',
      ),
    ).toEqual({ search: 'soup' });
  });
});

describe('resolveCurrentMealPlan', () => {
  const upcomingSoon = {
    id: 'soon',
    startDate: '2026-03-12',
    endDate: '2026-03-18',
  };
  const upcomingLater = {
    id: 'later',
    startDate: '2026-04-01',
    endDate: '2026-04-07',
  };

  it('prefers the latest-starting active plan', () => {
    expect(resolveCurrentMealPlan(plans, TODAY)?.id).toBe('weekly');
  });

  it('takes the nearest upcoming plan when none is active, in any order', () => {
    expect(
      resolveCurrentMealPlan([upcomingLater, plans[2]!, upcomingSoon], TODAY)
        ?.id,
    ).toBe('soon');
  });

  it('keeps a plan current through its last day, over one starting tomorrow', () => {
    const endingToday = {
      id: 'ending',
      startDate: '2026-03-05',
      endDate: '2026-03-11',
    };

    expect(
      resolveCurrentMealPlan([upcomingSoon, endingToday], '2026-03-11')?.id,
    ).toBe('ending');
    expect(
      resolveCurrentMealPlan([upcomingSoon, endingToday], '2026-03-12')?.id,
    ).toBe('soon');
  });

  it('takes a plan that starts today as active, not as upcoming', () => {
    expect(
      resolveCurrentMealPlan([upcomingLater, upcomingSoon], '2026-03-12')?.id,
    ).toBe('soon');
    expect(
      resolveCurrentMealPlan([upcomingSoon, plans[1]!], '2026-03-12')?.id,
    ).toBe('soon');
  });

  it('is null when every plan has ended', () => {
    expect(resolveCurrentMealPlan([plans[2]!], TODAY)).toBeNull();
  });
});
