import type { ApolloCache } from '@apollo/client';
import {
  TemplateCategory,
  type CreateMealTemplateInput,
  type MealTemplate,
} from '#/graphql/generated/schemaTypes';
import {
  createAddToQueryConnectionUpdater,
  skipUnmatchedFilterVariants,
} from '#/apollo/utils/cacheUpdaters';
import {
  hideEntity,
  isHeld,
  writeLocalEntity,
} from '#/apollo/utils/writeLocalEntity';
import { MealTemplate_RowFragmentDoc } from './mealTemplate.generated';
import {
  NEUTRAL_LOCAL_MEAL_TEMPLATE,
  NEUTRAL_LOCAL_MEAL_TEMPLATE_BY_TYPE,
} from './mealTemplateRowNeutral.generated';
import { localTemplateItem } from './mealTemplateItem';
import { removeFromMealTemplates } from './removals';

const addTemplateEdge = createAddToQueryConnectionUpdater(
  'mealTemplates',
  'MealTemplate',
);

/**
 * First in each cached `mealTemplates` variant the template belongs to: the
 * browser sheet caches one per category or search, and a modify fans out to all.
 */
export const addToMealTemplates = (
  cache: ApolloCache,
  template: Pick<MealTemplate, 'id' | 'category'> & {
    __typename: 'MealTemplate';
  },
) =>
  addTemplateEdge(cache, template, {
    position: 'start',
    skipStoreField: skipUnmatchedFilterVariants({
      category: template.category,
    }),
  });

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
  now: string,
): { __typename: 'MealTemplate'; id: string; category: TemplateCategory } {
  const category = input.category ?? TemplateCategory.Custom;
  const home = input.homeId ? { __typename: 'Home', id: input.homeId } : null;
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
      durationDays: input.durationDays ?? 7,
      defaultServings: input.defaultServings ?? 4,
      tags: input.tags ?? [],
      homeId: input.homeId ?? null,
      home: home && isHeld(cache, home) ? home : null,
      user: { __typename: 'User', id: ownerId },
      itemsConnection: {
        __typename: 'MealTemplateItemConnection',
        edges: (input.items ?? []).flatMap(({ id: itemId, ...item }) =>
          itemId
            ? [
                {
                  __typename: 'MealTemplateItemEdge',
                  node: localTemplateItem(cache, itemId, item),
                },
              ]
            : [],
        ),
        // Everything the template holds is in this write: there is no next page.
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
      },
      createdAt: now,
      updatedAt: now,
    },
  });
  return { __typename: 'MealTemplate', id, category };
}

/** Takes a template out from a layer; one already hidden changes nothing. */
export function hideMealTemplate(cache: ApolloCache, templateId: string): void {
  const template = { __typename: 'MealTemplate', id: templateId };
  if (!isHeld(cache, template)) return;
  removeFromMealTemplates(cache, templateId);
  hideEntity(cache, template);
}
