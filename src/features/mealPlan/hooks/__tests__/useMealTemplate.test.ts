import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  GetMealTemplateDocument,
  GetMealTemplateForEditDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import {
  MealTemplateItemFragmentDoc,
  type MealTemplateItemFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { MealType } from '#/graphql/generated/schemaTypes';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import { useMealTemplate } from '../useMealTemplate';
import { useMealTemplateForEdit } from '../useMealTemplateForEdit';

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

const page = (
  items: MealTemplateItemFragment[],
  pageInfo: { hasNextPage: boolean; endCursor: string | null },
): MockDataFor<typeof GetMealTemplateDocument> => ({
  mealTemplate: {
    __typename: 'MealTemplate',
    id: 't1',
    itemsConnection: { edges: items.map(node => ({ node })), pageInfo },
  },
});

async function loadTemplate() {
  const cache = makeCache();
  const get = recordMock(GetMealTemplateDocument, {
    data: page([item('i1', 0), item('i2', 1)], {
      hasNextPage: false,
      endCursor: null,
    }),
  });
  const rendered = renderHookWithApollo(() => useMealTemplate('t1'), {
    operationMocks: [get.mock],
    cache,
  });
  await waitFor(() =>
    expect(rendered.result.current.groupedByDay).toHaveLength(2),
  );
  return { cache, get, ...rendered };
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

  it('reads a template that fits one page with one request, at the largest page', async () => {
    const { get } = await loadTemplate();

    expect(get.fired).toEqual([{ id: 't1', itemsFirst: MEALS_PAGE_SIZE }]);
  });

  it('follows the cursor, so a preview groups every meal and not the first page', async () => {
    const first = recordMock(GetMealTemplateDocument, {
      match: vars => vars.itemsAfter == null,
      data: page([item('i1', 0), item('i2', 1)], {
        hasNextPage: true,
        endCursor: 'cursor-2',
      }),
    });
    const second = recordMock(GetMealTemplateDocument, {
      match: vars => vars.itemsAfter === 'cursor-2',
      data: page([item('i3', 1), item('i4', 2)], {
        hasNextPage: false,
        endCursor: 'cursor-4',
      }),
    });

    const { result } = renderHookWithApollo(() => useMealTemplate('t1'), {
      operationMocks: [first.mock, second.mock],
      cache: makeCache(),
    });

    await waitFor(() =>
      expect(daysOf(result.current.groupedByDay)).toEqual([
        [0, ['i1']],
        [1, ['i2', 'i3']],
        [2, ['i4']],
      ]),
    );
    expect(second.fired).toEqual([
      { id: 't1', itemsFirst: MEALS_PAGE_SIZE, itemsAfter: 'cursor-2' },
    ]);
  });

  it('sends nothing without a template', () => {
    const get = recordMock(GetMealTemplateDocument, {
      error: new Error('should not fire without an id'),
    });

    const { result } = renderHookWithApollo(() => useMealTemplate(undefined), {
      operationMocks: [get.mock],
    });

    expect(get.fired).toHaveLength(0);
    expect(result.current.groupedByDay).toEqual([]);
    expect(result.current.hasResult).toBe(false);
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

describe('useMealTemplateForEdit', () => {
  const editPage = (
    ids: string[],
    pageInfo: { hasNextPage: boolean; endCursor: string | null },
  ): MockDataFor<typeof GetMealTemplateForEditDocument> => ({
    mealTemplate: {
      __typename: 'MealTemplate',
      id: 't2',
      name: 'Week A',
      itemsConnection: {
        edges: ids.map((id, dayOffset) => ({
          node: { ...item(id, dayOffset) },
        })),
        pageInfo,
      },
    },
  });

  it('returns the template and its meals as a flat list', async () => {
    const get = recordMock(GetMealTemplateForEditDocument, {
      data: editPage(['i1', 'i2'], { hasNextPage: false, endCursor: null }),
    });

    const { result } = renderHookWithApollo(
      () => useMealTemplateForEdit('t2'),
      {
        operationMocks: [get.mock],
        cache: makeCache(),
      },
    );

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.template?.name).toBe('Week A');
    expect(result.current.items.map(meal => [meal.id, meal.dayOffset])).toEqual(
      [
        ['i1', 0],
        ['i2', 1],
      ],
    );
    expect(get.fired).toEqual([{ id: 't2', itemsFirst: MEALS_PAGE_SIZE }]);
  });

  it('follows the cursor: the editor saves against every meal, not the first page', async () => {
    const first = recordMock(GetMealTemplateForEditDocument, {
      match: vars => vars.itemsAfter == null,
      data: editPage(['i1', 'i2'], {
        hasNextPage: true,
        endCursor: 'cursor-2',
      }),
    });
    const second = recordMock(GetMealTemplateForEditDocument, {
      match: vars => vars.itemsAfter === 'cursor-2',
      data: editPage(['i3'], { hasNextPage: false, endCursor: 'cursor-3' }),
    });

    const { result } = renderHookWithApollo(
      () => useMealTemplateForEdit('t2'),
      {
        operationMocks: [first.mock, second.mock],
        cache: makeCache(),
      },
    );

    await waitFor(() =>
      expect(result.current.items.map(meal => meal.id)).toEqual([
        'i1',
        'i2',
        'i3',
      ]),
    );
    expect(second.fired).toEqual([
      { id: 't2', itemsFirst: MEALS_PAGE_SIZE, itemsAfter: 'cursor-2' },
    ]);
  });

  it('holds no template and no meals while creating a new one', () => {
    const get = recordMock(GetMealTemplateForEditDocument, {
      error: new Error('should not fire without an id'),
    });

    const { result } = renderHookWithApollo(
      () => useMealTemplateForEdit(undefined),
      { operationMocks: [get.mock] },
    );

    expect(get.fired).toHaveLength(0);
    expect(result.current.template).toBeUndefined();
    expect(result.current.items).toEqual([]);
  });
});
