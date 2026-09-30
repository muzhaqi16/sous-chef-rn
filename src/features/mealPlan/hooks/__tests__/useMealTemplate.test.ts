import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GetMealTemplateDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import {
  MealTemplateItemFragmentDoc,
  type MealTemplateItemFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { MealType } from '#/graphql/generated/schemaTypes';
import { useMealTemplate } from '../useMealTemplate';

jest.mock('#/apollo/links/tokenScheduler');

const item = (id: string, dayOffset: number): MealTemplateItemFragment => ({
  __typename: 'MealTemplateItem',
  id,
  dayOffset,
  mealType: MealType.Dinner,
  customMealName: `Meal ${id}`,
  servings: 2,
  notes: null,
  recipe: null,
});

async function loadTemplate() {
  const cache = makeCache();
  const get = recordMock(GetMealTemplateDocument, {
    data: {
      mealTemplate: {
        __typename: 'MealTemplate',
        id: 't1',
        items: [item('i1', 0), item('i2', 1)],
      },
    },
  });
  const rendered = renderHookWithApollo(() => useMealTemplate('t1'), {
    operationMocks: [get.mock],
    cache,
  });
  await waitFor(() =>
    expect(rendered.result.current.groupedByDay).toHaveLength(2),
  );
  return { cache, ...rendered };
}

const daysOf = (groups: { dayOffset: number; items: { id: string }[] }[]) =>
  groups.map(g => [g.dayOffset, g.items.map(i => i.id)]);

describe('useMealTemplate', () => {
  it('groups the items by day', async () => {
    const { result } = await loadTemplate();

    expect(daysOf(result.current.groupedByDay)).toEqual([
      [0, ['i1']],
      [1, ['i2']],
    ]);
  });

  // Moving an item edits only the item, so the template query's result stays
  // the same object.
  it('regroups an item moved to another day', async () => {
    const { cache, result } = await loadTemplate();

    await act(async () => {
      cache.writeFragment({
        fragment: MealTemplateItemFragmentDoc,
        fragmentName: 'MealTemplateItemFragment',
        data: item('i2', 0),
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(daysOf(result.current.groupedByDay)).toEqual([[0, ['i1', 'i2']]]),
    );
  });
});
