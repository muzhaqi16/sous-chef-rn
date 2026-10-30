/**
 * A refused template-item edit must leave the row's recipe link where it was.
 *
 * The revert snapshot is built from `readTemplateItem`, which reads the editor's
 * cached row with `returnPartialData`. If the editor's own query does not select
 * `recipe`, the key is simply ABSENT — and a snapshot that coerces absence to
 * `null` writes null over a link it never read. That is not a restore, it is a
 * deletion, and on the local-first path there is no next fetch to repair it.
 *
 * The fix is to make the editor's query select the field its writes change, so
 * "absent" once again means "the cache genuinely holds no recipe" — which is the
 * only reading under which `?? null` is correct.
 */
import { makeCache } from '#/apollo/cache';
import { MealType, TemplateCategory } from '#/graphql/generated/schemaTypes';
import { GetMealTemplateForEditDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import { readTemplateItem } from '../mealTemplateItem';
import { seedQuery } from '#/test-utils/apolloMockProvider';

function seedTemplateWithRecipeBackedRow() {
  const cache = makeCache();
  seedQuery(cache, {
    query: GetMealTemplateForEditDocument,
    variables: { id: 'tpl-1', itemsFirst: MEALS_PAGE_SIZE },
    data: {
      __typename: 'Query',
      mealTemplate: {
        __typename: 'MealTemplate',
        id: 'tpl-1',
        name: 'Week A',
        description: null,
        category: TemplateCategory.Custom,
        defaultServings: 2,
        tags: [],
        updatedAt: '2026-08-01T00:00:00.000Z',
        itemsConnection: {
          __typename: 'MealTemplateItemConnection',
          totalCount: 1,
          edges: [
            {
              __typename: 'MealTemplateItemEdge',
              node: {
                __typename: 'MealTemplateItem',
                id: 'item-1',
                dayOffset: 0,
                mealType: MealType.Dinner,
                customMealName: null,
                servings: 2,
                notes: null,
                recipe: {
                  __typename: 'Recipe',
                  version: 1,
                  id: 'rec-9',
                  name: 'Ragu',
                  imageUrl: null,
                  servings: 4,
                  totalTimeMinutes: 90,
                },
              },
            },
          ],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    },
  });
  return cache;
}

describe('the template editor snapshots the recipe it can overwrite', () => {
  it('reads the recipe back for a row the editor query loaded', () => {
    const cache = seedTemplateWithRecipeBackedRow();

    const snapshot = readTemplateItem(cache, 'item-1');

    // Present, not absent — so the revert restores the link instead of
    // coercing an unread field to null and destroying it.
    expect(snapshot).not.toBeNull();
    expect('recipe' in (snapshot as object)).toBe(true);
    expect(snapshot?.recipe?.id).toBe('rec-9');
  });

  it('still reports a genuinely absent recipe as null', () => {
    const cache = makeCache();
    seedQuery(cache, {
      query: GetMealTemplateForEditDocument,
      variables: { id: 'tpl-2', itemsFirst: MEALS_PAGE_SIZE },
      data: {
        __typename: 'Query',
        mealTemplate: {
          __typename: 'MealTemplate',
          id: 'tpl-2',
          name: 'Week B',
          description: null,
          category: TemplateCategory.Custom,
          defaultServings: 2,
          tags: [],
          updatedAt: '2026-08-01T00:00:00.000Z',
          itemsConnection: {
            __typename: 'MealTemplateItemConnection',
            totalCount: 1,
            edges: [
              {
                __typename: 'MealTemplateItemEdge',
                node: {
                  __typename: 'MealTemplateItem',
                  id: 'item-2',
                  dayOffset: 1,
                  mealType: MealType.Lunch,
                  customMealName: 'Leftovers',
                  servings: 1,
                  notes: null,
                  recipe: null,
                },
              },
            ],
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      },
    });

    const snapshot = readTemplateItem(cache, 'item-2');

    expect(snapshot?.recipe ?? null).toBeNull();
  });
});
