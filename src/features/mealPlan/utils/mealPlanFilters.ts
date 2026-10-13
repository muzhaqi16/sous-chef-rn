import type {
  MealPlanFilters,
  MealPlanType,
} from '#/graphql/generated/schemaTypes';
import { matchesTerm } from '#hooks/search/useLocalSearch';

export interface MealPlanFilterState {
  search: string;
  activeOnly: boolean;
  planType: MealPlanType | null;
}

export const EMPTY_MEAL_PLAN_FILTERS: MealPlanFilterState = {
  search: '',
  activeOnly: false,
  planType: null,
};

/** A plan's first and last day, as `LocalDate` keys; both are days of the plan. */
interface PlanWindow {
  startDate: string;
  endDate: string;
}

interface FilterablePlan extends PlanWindow {
  name: string;
  description?: string | null;
  planType: MealPlanType;
}

/**
 * Whether `today` (a `LocalDate` key) is one of the plan's days. Keys of one
 * format order as their days do; compared as instants, a date-only last day
 * would end at its own midnight and the plan would lapse a day early.
 */
export function isPlanActiveOn(plan: PlanWindow, today: string): boolean {
  return plan.startDate <= today && plan.endDate >= today;
}

export function hasMealPlanFilter(filters: MealPlanFilterState): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.activeOnly ||
    filters.planType !== null
  );
}

/**
 * The server's `MealPlanFilters` for the selector state, or `undefined` when no
 * filter is set. Unset keys are omitted, not `undefined`: `filters` is the
 * connection's cache key, and one state must name one stored variant.
 * `isActive` is judged on the day the device states, so it carries `today`.
 */
export function toMealPlanServerFilters(
  filters: MealPlanFilterState,
  today: string,
): MealPlanFilters | undefined {
  if (!hasMealPlanFilter(filters)) return undefined;
  const search = filters.search.trim();
  return {
    ...(search ? { search } : {}),
    ...(filters.activeOnly ? { isActive: true, today } : {}),
    ...(filters.planType ? { planType: filters.planType } : {}),
  };
}

/**
 * The selector filters applied to plans already in hand, with the server's
 * semantics (substring of name or description, `isActive` as today within the
 * plan's range). It also re-checks server results, since a local create lands
 * in every cached filter variant and an `isActive` page goes stale.
 */
export function filterMealPlans<T extends FilterablePlan>(
  plans: readonly T[],
  filters: MealPlanFilterState,
  today: string,
): T[] {
  return plans.filter(plan => {
    if (!matchesTerm(plan, filters.search, ['name', 'description'])) {
      return false;
    }
    if (filters.planType && plan.planType !== filters.planType) return false;
    if (filters.activeOnly && !isPlanActiveOn(plan, today)) return false;
    return true;
  });
}

/** Active (latest-starting on a tie) beats the nearest upcoming; else `null`. */
export function resolveCurrentMealPlan<T extends PlanWindow>(
  plans: readonly T[],
  today: string,
): T | null {
  let active: T | null = null;
  let upcoming: T | null = null;
  for (const plan of plans) {
    const start = plan.startDate;
    if (start > today) {
      if (!upcoming || start < upcoming.startDate) upcoming = plan;
    } else if (plan.endDate >= today && (!active || start > active.startDate)) {
      active = plan;
    }
  }
  return active ?? upcoming;
}
