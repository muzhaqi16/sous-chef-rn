import type { ApolloCache } from '@apollo/client';
import {
  TemplateCategory,
  type CreateMealTemplateInput,
} from '#/graphql/generated/schemaTypes';
import { isHeld, writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import { MealTemplate_RowFragmentDoc } from './mealTemplate.generated';
import {
  NEUTRAL_LOCAL_MEAL_TEMPLATE,
  NEUTRAL_LOCAL_MEAL_TEMPLATE_BY_TYPE,
} from './mealTemplateRowNeutral.generated';
import { localTemplateItem } from './mealTemplateItem';

/**
 * Writes a local-first template complete for every query reading one, with the
 * items it was created with (a template from a plan mints them). Its home is
 * named only when the cache holds it.
 */
export function writeLocalMealTemplate(
  cache: ApolloCache,
  id: string,
  input: CreateMealTemplateInput,
  ownerId: string,
): { __typename: 'MealTemplate'; id: string; category: TemplateCategory } {
  const category = input.category ?? TemplateCategory.Custom;
  const home = input.homeId ? { __typename: 'Home', id: input.homeId } : null;
  const now = new Date().toISOString();
  writeLocalEntity(cache, {
    fragment: MealTemplate_RowFragmentDoc,
    fragmentName: 'mealTemplate_row',
    neutral: NEUTRAL_LOCAL_MEAL_TEMPLATE,
    neutralByType: NEUTRAL_LOCAL_MEAL_TEMPLATE_BY_TYPE,
    known: {
      __typename: 'MealTemplate',
      id,
      name: input.name,
      description: input.description ?? null,
      category,
      durationDays: input.durationDays ?? 1,
      defaultServings: input.defaultServings ?? 1,
      tags: input.tags ?? [],
      homeId: input.homeId ?? null,
      home: home && isHeld(cache, home) ? home : null,
      user: { __typename: 'User', id: ownerId },
      items: (input.items ?? []).flatMap(({ id: itemId, ...item }) =>
        itemId ? [localTemplateItem(cache, itemId, item)] : [],
      ),
      createdAt: now,
      updatedAt: now,
    },
  });
  return { __typename: 'MealTemplate', id, category };
}
