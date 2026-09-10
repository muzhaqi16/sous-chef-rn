import { generateEntityId } from '#/utils/generateEntityId';
import { mealReferenceOf } from '#features/mealPlan/utils/mealReference';
import type {
  CreateMealPlanInput,
  CreateMealPlanItemInput,
  MealPlanType,
  MealType,
} from '#/graphql/generated/schemaTypes';

/** The source plan, as `useDuplicateMealPlan_mealPlan` caches it. */
export interface SourcePlan {
  id: string;
  description?: string | null;
  planType: MealPlanType;
  servings?: number | null;
  budgetAmount?: number | null;
  homeId?: string | null;
  startDate: string;
  endDate: string;
  mealPlanItems: SourceMeal[];
}

export interface SourceMeal {
  id: string;
  date: string;
  mealType: MealType;
  servings?: number | null;
  notes?: string | null;
  customMealName?: string | null;
  recipe?: { id: string } | null;
}

export interface DuplicatedPlan {
  plan: CreateMealPlanInput;
  items: CreateMealPlanItemInput[];
  skipped: Array<{ sourceId: string; reason: 'meal-has-no-reference' }>;
}

export type DuplicateRefusal = 'duration-differs';

interface DuplicateOptions {
  newName: string;
  newStartDate: string;
  newEndDate: string;
  mintId?: () => string;
}

const dayMs = (iso: string) => new Date(iso).getTime();

/**
 * Recreate a plan under new dates as the primitives it decomposes into. Pure, so
 * the caller reads the cache and fires the writes and this stays fixture-tested.
 * Returns the refusal string when the server would refuse, rather than throwing.
 */
export function duplicatePlan(
  source: SourcePlan,
  options: DuplicateOptions,
): DuplicatedPlan | DuplicateRefusal {
  const originalSpan = dayMs(source.endDate) - dayMs(source.startDate);
  const newSpan = dayMs(options.newEndDate) - dayMs(options.newStartDate);
  // The server refuses a range of a different length, so the same range that
  // fails online must fail here rather than queueing a write bound to fail.
  if (originalSpan !== newSpan) return 'duration-differs';

  const mint = options.mintId ?? generateEntityId;
  const shift = dayMs(options.newStartDate) - dayMs(source.startDate);
  const planId = mint();

  const plan: CreateMealPlanInput = {
    id: planId,
    name: options.newName,
    startDate: options.newStartDate,
    endDate: options.newEndDate,
    planType: source.planType,
    ...(source.description != null && { description: source.description }),
    ...(source.servings != null && { servings: source.servings }),
    ...(source.budgetAmount != null && { budgetAmount: source.budgetAmount }),
    ...(source.homeId != null && { homeId: source.homeId }),
  };

  const items: CreateMealPlanItemInput[] = [];
  const skipped: DuplicatedPlan['skipped'] = [];

  for (const meal of source.mealPlanItems) {
    // The server's own copy maps only the recipe id, so a custom meal loses its
    // name and keeps a nameless row. The input cannot express that.
    const reference = mealReferenceOf(meal);
    if (!reference) {
      skipped.push({ sourceId: meal.id, reason: 'meal-has-no-reference' });
      continue;
    }

    items.push({
      id: mint(),
      mealPlanId: planId,
      date: new Date(dayMs(meal.date) + shift).toISOString(),
      mealType: meal.mealType,
      meal: reference,
      ...(meal.servings != null && { servings: meal.servings }),
      ...(meal.notes != null && { notes: meal.notes }),
    });
  }

  return { plan, items, skipped };
}
