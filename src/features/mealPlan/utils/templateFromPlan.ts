import { generateEntityId } from '#/utils/generateEntityId';
import { mealReferenceOf } from '#features/mealPlan/utils/mealReference';
import type {
  CreateMealTemplateInput,
  MealType,
  TemplateCategory,
} from '#/graphql/generated/schemaTypes';

/** The plan a template is cut from, as the cache holds it. */
export interface PlanToTemplate {
  id: string;
  description?: string | null;
  servings?: number | null;
  homeId?: string | null;
  startDate: string;
  endDate: string;
  mealPlanItems: Array<{
    id: string;
    date: string;
    mealType: MealType;
    servings?: number | null;
    notes?: string | null;
    customMealName?: string | null;
    recipe?: { id: string } | null;
  }>;
}

export interface DerivedTemplate {
  template: CreateMealTemplateInput;
  skipped: Array<{ sourceId: string; reason: 'meal-has-no-reference' }>;
}

interface Options {
  name: string;
  description?: string | null;
  category?: TemplateCategory | null;
  tags?: string[] | null;
  mintId?: () => string;
}

const DAY_MS = 86_400_000;
const at = (iso: string) => new Date(iso).getTime();

/**
 * Cut a reusable template from a plan. A plan's meals carry absolute dates and a
 * template's carry a day offset from its start, which is the whole conversion.
 */
export function templateFromPlan(
  source: PlanToTemplate,
  options: Options,
): DerivedTemplate {
  const mint = options.mintId ?? generateEntityId;
  const start = at(source.startDate);
  const skipped: DerivedTemplate['skipped'] = [];
  const items: NonNullable<CreateMealTemplateInput['items']> = [];

  for (const meal of source.mealPlanItems) {
    const reference = mealReferenceOf(meal);
    if (!reference) {
      skipped.push({ sourceId: meal.id, reason: 'meal-has-no-reference' });
      continue;
    }
    items.push({
      id: mint(),
      dayOffset: Math.round((at(meal.date) - start) / DAY_MS),
      mealType: meal.mealType,
      meal: reference,
      ...(meal.servings != null && { servings: meal.servings }),
      ...(meal.notes != null && { notes: meal.notes }),
    });
  }

  // The span the plan actually covers, counted inclusively: a Monday-to-Sunday
  // plan is seven days, not the six its endpoints differ by.
  const durationDays = Math.round((at(source.endDate) - start) / DAY_MS) + 1;

  return {
    template: {
      id: mint(),
      name: options.name,
      durationDays,
      items,
      ...(options.description != null && { description: options.description }),
      ...(options.category != null && { category: options.category }),
      ...(options.tags != null && { tags: options.tags }),
      ...(source.servings != null && { defaultServings: source.servings }),
      ...(source.homeId != null && { homeId: source.homeId }),
    },
    skipped,
  };
}
