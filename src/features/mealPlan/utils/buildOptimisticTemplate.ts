import type { ApolloCache } from '@apollo/client';
import {
  MealTemplateDisplayFragmentDoc,
  type MealTemplateDisplayFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import {
  TemplateCategory,
  type CreateMealTemplateInput,
} from '#/graphql/generated/schemaTypes';

/**
 * The template a local-first create writes before firing. Every field the
 * display fragment selects has to be here — one missing field makes the whole
 * cache read incomplete and the card never renders.
 */
export function buildOptimisticTemplate(
  input: CreateMealTemplateInput,
  ownerId: string,
): MealTemplateDisplayFragment {
  const now = new Date().toISOString();
  return {
    __typename: 'MealTemplate',
    id: input.id ?? '',
    name: input.name,
    description: input.description ?? null,
    category: input.category ?? TemplateCategory.Custom,
    durationDays: input.durationDays ?? 1,
    defaultServings: input.defaultServings ?? 1,
    tags: input.tags ?? [],
    usageCount: 0,
    lastUsedAt: null,
    homeId: input.homeId ?? null,
    home: null,
    user: { __typename: 'User', id: ownerId },
    createdAt: now,
    updatedAt: now,
  };
}

/** Write it, or leave the cache untouched if the shape cannot be identified. */
export function writeOptimisticTemplate(
  cache: ApolloCache,
  template: MealTemplateDisplayFragment,
): void {
  const id = cache.identify(template);
  if (!id) return;
  cache.writeFragment({
    id,
    fragment: MealTemplateDisplayFragmentDoc,
    fragmentName: 'MealTemplateDisplay',
    data: template,
  });
}
