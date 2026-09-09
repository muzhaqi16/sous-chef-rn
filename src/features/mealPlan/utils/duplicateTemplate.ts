import { generateEntityId } from '#/utils/generateEntityId';
import { mealReferenceOf } from '#features/mealPlan/utils/mealReference';
import type {
  CreateMealTemplateInput,
  MealType,
  TemplateCategory,
} from '#/graphql/generated/schemaTypes';

/** The template being copied, as the cache holds it. */
export interface SourceTemplate {
  id: string;
  description?: string | null;
  category?: TemplateCategory | null;
  durationDays?: number | null;
  defaultServings?: number | null;
  tags?: string[] | null;
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

export interface DuplicatedTemplate {
  template: CreateMealTemplateInput;
  skipped: Array<{ sourceId: string; reason: 'meal-has-no-reference' }>;
}

/**
 * Copy a template under a new name. Every row is minted fresh, so a replay
 * converges on this copy rather than making a third.
 */
export function duplicateTemplate(
  source: SourceTemplate,
  options: { newName: string; mintId?: () => string },
): DuplicatedTemplate {
  const mint = options.mintId ?? generateEntityId;
  const skipped: DuplicatedTemplate['skipped'] = [];
  const items: NonNullable<CreateMealTemplateInput['items']> = [];

  for (const meal of source.items) {
    const reference = mealReferenceOf(meal);
    if (!reference) {
      skipped.push({ sourceId: meal.id, reason: 'meal-has-no-reference' });
      continue;
    }
    items.push({
      id: mint(),
      dayOffset: meal.dayOffset,
      mealType: meal.mealType,
      meal: reference,
      ...(meal.servings != null && { servings: meal.servings }),
      ...(meal.notes != null && { notes: meal.notes }),
    });
  }

  return {
    template: {
      id: mint(),
      name: options.newName,
      items,
      ...(source.description != null && { description: source.description }),
      ...(source.category != null && { category: source.category }),
      ...(source.durationDays != null && { durationDays: source.durationDays }),
      ...(source.defaultServings != null && {
        defaultServings: source.defaultServings,
      }),
      ...(source.tags != null && { tags: source.tags }),
      ...(source.homeId != null && { homeId: source.homeId }),
    },
    skipped,
  };
}
