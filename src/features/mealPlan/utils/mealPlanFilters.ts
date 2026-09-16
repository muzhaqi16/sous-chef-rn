import { parseISO } from 'date-fns';
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

interface PlanWindow {
  startDate: string;
  endDate: string;
}

interface FilterablePlan extends PlanWindow {
  name: string;
  description?: string | null;
  planType: MealPlanType;
}

export function isPlanActiveAt(plan: PlanWindow, now: Date): boolean {
  return parseISO(plan.startDate) <= now && parseISO(plan.endDate) >= now;
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
 */
export function toMealPlanServerFilters(
  filters: MealPlanFilterState,
): MealPlanFilters | undefined {
  if (!hasMealPlanFilter(filters)) return undefined;
  const search = filters.search.trim();
  return {
    ...(search ? { search } : {}),
    ...(filters.activeOnly ? { isActive: true } : {}),
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
  now: Date,
): T[] {
  return plans.filter(plan => {
    if (!matchesTerm(plan, filters.search, ['name', 'description'])) {
      return false;
    }
    if (filters.planType && plan.planType !== filters.planType) return false;
    if (filters.activeOnly && !isPlanActiveAt(plan, now)) return false;
    return true;
  });
}

/** Active (latest-starting on a tie) beats the nearest upcoming; else `null`. */
export function resolveCurrentMealPlan<T extends PlanWindow>(
  plans: readonly T[],
  now: Date,
): T | null {
  let active: T | null = null;
  let upcoming: T | null = null;
  for (const plan of plans) {
    const start = parseISO(plan.startDate);
    if (start > now) {
      if (!upcoming || start < parseISO(upcoming.startDate)) upcoming = plan;
    } else if (
      parseISO(plan.endDate) >= now &&
      (!active || start > parseISO(active.startDate))
    ) {
      active = plan;
    }
  }
  return active ?? upcoming;
}
