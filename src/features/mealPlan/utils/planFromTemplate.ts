import { generateEntityId } from '#/utils/generateEntityId';
import { mealReferenceOf } from '#features/mealPlan/utils/mealReference';
import type {
  CreateMealPlanInput,
  CreateMealPlanItemInput,
  MealPlanType,
  MealType,
} from '#/graphql/generated/schemaTypes';

/** The template a plan is built from, as the cache holds it. */
export interface TemplateToPlan {
  id: string;
  name: string;
  description?: string | null;
  durationDays?: number | null;
  defaultServings?: number | null;
  homeId?: string | null;
  items: Array<{
    id: string;
    dayOffset: number;
    mealType: MealType;
    servings?: number | null;
    notes?: string | null;
    customMealName?: string | null;
    recipe?: { id: string } | null;
  }>;
}

export interface DerivedPlan {
  plan: CreateMealPlanInput;
  items: CreateMealPlanItemInput[];
  skipped: Array<{ sourceId: string; reason: 'meal-has-no-reference' }>;
}

interface Options {
  startDate: string;
  name?: string | null;
  servings?: number | null;
  budgetAmount?: number | null;
  dietaryProfileId?: string | null;
  planType: MealPlanType;
  mintId?: () => string;
}

const DAY_MS = 86_400_000;

/**
 * Lay a template's meals onto real dates. A template's day offset plus the
 * chosen start is the whole conversion; the plan ends on its last covered day.
 */
export function planFromTemplate(
  source: TemplateToPlan,
  options: Options,
): DerivedPlan {
  const mint = options.mintId ?? generateEntityId;
  const start = new Date(options.startDate).getTime();
  const planId = mint();
  // Inclusive, so a one-day template starts and ends on the same date.
  const span = Math.max(source.durationDays ?? 1, 1) - 1;

  const servings = options.servings ?? source.defaultServings;

  const plan: CreateMealPlanInput = {
    id: planId,
    name: options.name?.trim() || source.name,
    startDate: options.startDate,
    endDate: new Date(start + span * DAY_MS).toISOString(),
    planType: options.planType,
    ...(source.description != null && { description: source.description }),
    ...(options.budgetAmount != null && {
      budgetAmount: options.budgetAmount,
    }),
    ...(options.dietaryProfileId != null && {
      dietaryProfileId: options.dietaryProfileId,
    }),
    ...(servings != null && { servings }),
    ...(source.homeId != null && { homeId: source.homeId }),
  };

  const items: CreateMealPlanItemInput[] = [];
  const skipped: DerivedPlan['skipped'] = [];

  for (const meal of source.items) {
    const reference = mealReferenceOf(meal);
    if (!reference) {
      skipped.push({ sourceId: meal.id, reason: 'meal-has-no-reference' });
      continue;
    }
    items.push({
      id: mint(),
      mealPlanId: planId,
      date: new Date(start + meal.dayOffset * DAY_MS).toISOString(),
      mealType: meal.mealType,
      meal: reference,
      ...(meal.servings != null && { servings: meal.servings }),
      ...(meal.notes != null && { notes: meal.notes }),
    });
  }

  return { plan, items, skipped };
}
